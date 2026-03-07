"""Jobs API endpoints: create, list, get job postings."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import JobParseResult, JobPosting, User
from app.schemas.schemas import (
    JobParseResultResponse,
    JobPostingCreate,
    JobPostingResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=JobPostingResponse, status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    payload: JobPostingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobPosting:
    job = JobPosting(**payload.model_dump())
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.get("/", response_model=PaginatedResponse)
async def list_job_postings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    source: str | None = Query(None),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(JobPosting).where(JobPosting.is_active == True)  # noqa: E712
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

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{job_id}", response_model=JobPostingResponse)
async def get_job_posting(
    job_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobPosting:
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
    return job


@router.get("/{job_id}/parse-result", response_model=JobParseResultResponse)
async def get_job_parse_result(
    job_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobParseResult:
    result = await db.execute(
        select(JobParseResult).where(JobParseResult.job_posting_id == job_id)
    )
    parse_result = result.scalar_one_or_none()
    if not parse_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parse result not found"
        )
    return parse_result
