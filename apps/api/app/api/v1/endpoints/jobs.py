"""Jobs API endpoints: create, list, get job postings."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import JobParseResult, JobPosting, User
from app.services.external_jobs import ExternalJobSearchService
from app.services.job_ai import ExtractionResult, JobExtractionService
from app.schemas.schemas import (
    ExternalJobImportRequest,
    ExternalJobSearchRequest,
    ExternalJobSearchResponse,
    JobExtractionPreviewResponse,
    JobExtractionRequest,
    JobIngestionResponse,
    JobParseResultResponse,
    JobPostingCreate,
    JobPostingResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])
job_extraction_service = JobExtractionService()
external_job_search_service = ExternalJobSearchService()


async def _create_job_with_parse_result(
    *,
    db: AsyncSession,
    payload: JobPostingCreate,
    extraction: ExtractionResult,
    user_id: UUID,
) -> tuple[JobPosting, JobParseResult]:
    job = JobPosting(**payload.model_dump(), user_id=user_id)
    db.add(job)
    await db.flush()

    parse_result = JobParseResult(
        job_posting_id=job.id,
        parser_version=extraction.extraction_method,
        raw_output={
            "confidence_notes": extraction.confidence_notes,
            "job": extraction.job,
            "parse_result": extraction.parse_result,
        },
        **extraction.parse_result,
    )
    db.add(parse_result)
    await db.flush()
    await db.refresh(job)
    await db.refresh(parse_result)
    return job, parse_result


@router.post("", response_model=JobPostingResponse, status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    payload: JobPostingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobPosting:
    job = JobPosting(**payload.model_dump(), user_id=current_user.id)
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.post("/search/external", response_model=ExternalJobSearchResponse)
async def search_external_jobs(
    payload: ExternalJobSearchRequest,
    _current_user: User = Depends(get_current_user),
) -> ExternalJobSearchResponse:
    items = await external_job_search_service.search_jobs(
        role=payload.role,
        location=payload.location,
        remote_only=payload.remote_only,
        limit=payload.limit,
    )
    return ExternalJobSearchResponse(items=items, total=len(items))


@router.post("/extract", response_model=JobExtractionPreviewResponse)
async def extract_job_from_text(
    payload: JobExtractionRequest,
    _current_user: User = Depends(get_current_user),
) -> JobExtractionPreviewResponse:
    extraction = await job_extraction_service.extract_job(
        payload.job_text, source_url=payload.source_url
    )
    return JobExtractionPreviewResponse(
        job=extraction.job,
        parse_result=extraction.parse_result,
        extraction_method=extraction.extraction_method,
        confidence_notes=extraction.confidence_notes,
    )


@router.post(
    "/ingest-manual",
    response_model=JobIngestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_manual_job(
    payload: JobExtractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobIngestionResponse:
    extraction = await job_extraction_service.extract_job(
        payload.job_text, source_url=payload.source_url
    )
    job_payload = JobPostingCreate(**extraction.job)
    job, parse_result = await _create_job_with_parse_result(
        db=db,
        payload=job_payload,
        extraction=extraction,
        user_id=current_user.id,
    )
    return JobIngestionResponse(
        job=job,
        parse_result=parse_result,
        extraction_method=extraction.extraction_method,
    )


@router.post(
    "/import-external",
    response_model=JobIngestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_external_job(
    payload: ExternalJobImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobIngestionResponse:
    extraction = await job_extraction_service.extract_job(
        payload.description,
        source_url=payload.source_url,
    )

    job_payload = payload.model_copy(
        update={
            "requirements": payload.requirements or extraction.job["requirements"],
            "nice_to_haves": payload.nice_to_haves or extraction.job["nice_to_haves"],
            "source": payload.source if payload.source in {"linkedin", "indeed", "glassdoor", "greenhouse", "lever", "workday", "manual", "other"} else "other",
        }
    )
    job, parse_result = await _create_job_with_parse_result(
        db=db,
        payload=JobPostingCreate(**job_payload.model_dump(exclude={"provider"})),
        extraction=extraction,
        user_id=current_user.id,
    )
    return JobIngestionResponse(
        job=job,
        parse_result=parse_result,
        extraction_method=extraction.extraction_method,
    )


@router.get("", response_model=PaginatedResponse)
async def list_job_postings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    source: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(JobPosting).where(
        JobPosting.is_active == True,  # noqa: E712
        JobPosting.user_id == current_user.id,
    )
    if search:
        query = query.where(
            JobPosting.title.ilike(f"%{search}%") | JobPosting.company.ilike(f"%{search}%")
        )
    if source:
        query = query.where(JobPosting.source == source)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(JobPosting.created_at.desc()))
    items = result.scalars().all()
    serialized_items = [
        JobPostingResponse.model_validate(item).model_dump(mode="json") for item in items
    ]

    return {
        "items": serialized_items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{job_id}", response_model=JobPostingResponse)
async def get_job_posting(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobPosting:
    result = await db.execute(
        select(JobPosting).where(
            JobPosting.id == job_id,
            JobPosting.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
    return job


@router.get("/{job_id}/parse-result", response_model=JobParseResultResponse)
async def get_job_parse_result(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobParseResult:
    # Verify job belongs to this user first
    job_result = await db.execute(
        select(JobPosting).where(
            JobPosting.id == job_id,
            JobPosting.user_id == current_user.id,
        )
    )
    if not job_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")

    result = await db.execute(
        select(JobParseResult).where(JobParseResult.job_posting_id == job_id)
    )
    parse_result = result.scalar_one_or_none()
    if not parse_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parse result not found"
        )
    return parse_result
