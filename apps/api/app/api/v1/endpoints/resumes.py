"""Resume versions API endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import CandidateProfile, ResumeTemplate, ResumeVersion, User
from app.schemas.schemas import (
    PaginatedResponse,
    ResumeVersionCreate,
    ResumeVersionResponse,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.post("/", response_model=ResumeVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_resume(
    payload: ResumeVersionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResumeVersion:
    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create a candidate profile first",
        )

    resume = ResumeVersion(
        user_id=current_user.id,
        profile_id=profile.id,
        **payload.model_dump(),
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)
    return resume


@router.get("/", response_model=PaginatedResponse)
async def list_resumes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(ResumeVersion).where(ResumeVersion.user_id == current_user.id)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    offset = (page - 1) * limit
    result = await db.execute(
        query.offset(offset).limit(limit).order_by(ResumeVersion.updated_at.desc())
    )
    items = result.scalars().all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{resume_id}", response_model=ResumeVersionResponse)
async def get_resume(
    resume_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResumeVersion:
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return resume


@router.put("/{resume_id}", response_model=ResumeVersionResponse)
async def update_resume(
    resume_id: UUID,
    payload: ResumeVersionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResumeVersion:
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(resume, field, value)
    await db.flush()
    await db.refresh(resume)
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    await db.delete(resume)


@router.get("/templates", response_model=list[dict])
async def list_templates(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.is_active == True)  # noqa: E712
    )
    templates = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "format": t.format.value if hasattr(t.format, "value") else t.format,
            "description": t.description,
            "thumbnail_url": t.thumbnail_url,
            "theme_tokens": t.theme_tokens,
            "section_order": t.section_order,
        }
        for t in templates
    ]
