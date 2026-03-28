"""Resume versions API endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import CandidateProfile, Persona, ResumeTemplate, ResumeVersion, User
from app.schemas.schemas import (
    PaginatedResponse,
    ResumeVersionCreate,
    ResumeVersionResponse,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.post("", response_model=ResumeVersionResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("", response_model=PaginatedResponse)
async def list_resumes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    persona_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(ResumeVersion).where(ResumeVersion.user_id == current_user.id)
    if persona_id is not None:
        query = query.where(ResumeVersion.persona_id == persona_id)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    offset = (page - 1) * limit
    result = await db.execute(
        query.offset(offset).limit(limit).order_by(ResumeVersion.updated_at.desc())
    )
    items = result.scalars().all()
    serialized_items = [
        ResumeVersionResponse.model_validate(item).model_dump(mode="json") for item in items
    ]
    return {
        "items": serialized_items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


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


# ---------------------------------------------------------------------------
# Inline request models
# ---------------------------------------------------------------------------


class AiEditRequest(BaseModel):
    section_type: str          # e.g. "summary", "experience_item", "skills"
    content: str               # current text to improve
    instruction: str           # e.g. "make more impactful, quantify results"
    job_description: str | None = None  # optional JD for tailoring
    persona_name: str | None = None     # e.g. "Data Scientist"


class SectionPatchRequest(BaseModel):
    sections: list[dict]


# ---------------------------------------------------------------------------
# Seed from profile
# ---------------------------------------------------------------------------


@router.post("/{resume_id}/seed", response_model=ResumeVersionResponse)
async def seed_resume_from_profile(
    resume_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResumeVersion:
    """Populate resume sections from the user's profile data."""
    resume_result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    from sqlalchemy.orm import selectinload

    profile_result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == current_user.id)
        .options(
            selectinload(CandidateProfile.work_experiences),
            selectinload(CandidateProfile.education),
            selectinload(CandidateProfile.projects),
            selectinload(CandidateProfile.certifications),
            selectinload(CandidateProfile.skills),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    from app.models.models import User as UserModel
    user_result = await db.execute(select(UserModel).where(UserModel.id == current_user.id))
    user = user_result.scalar_one()

    # Group skills by category
    skill_groups: dict[str, list[str]] = {}
    for s in profile.skills:
        skill_groups.setdefault(s.category, []).append(s.name)

    sections = [
        {
            "type": "header",
            "full_name": user.full_name,
            "headline": profile.headline or "",
            "email": user.email,
            "phone": profile.phone or "",
            "location": profile.location or "",
            "website_url": profile.website_url or "",
            "linkedin_url": profile.linkedin_url or "",
            "github_url": profile.github_url or "",
        },
        {"type": "summary", "content": profile.summary or ""},
        {
            "type": "experience",
            "items": [
                {
                    "id": str(w.id),
                    "company": w.company,
                    "title": w.title,
                    "location": w.location or "",
                    "start_date": w.start_date,
                    "end_date": w.end_date or "",
                    "is_current": w.is_current,
                    "description": w.description or "",
                    "achievements": list(w.achievements or []),
                    "technologies": list(w.technologies or []),
                }
                for w in sorted(profile.work_experiences, key=lambda x: x.start_date, reverse=True)
            ],
        },
        {
            "type": "education",
            "items": [
                {
                    "id": str(e.id),
                    "institution": e.institution,
                    "degree": e.degree,
                    "field_of_study": e.field_of_study or "",
                    "start_date": e.start_date,
                    "end_date": e.end_date or "",
                    "gpa": e.gpa,
                    "description": e.description or "",
                }
                for e in profile.education
            ],
        },
        {
            "type": "skills",
            "groups": [
                {"category": cat, "items": items}
                for cat, items in skill_groups.items()
            ],
        },
        {
            "type": "projects",
            "items": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "description": p.description or "",
                    "url": p.url or "",
                    "repo_url": p.repo_url or "",
                    "technologies": list(p.technologies or []),
                    "start_date": p.start_date or "",
                    "end_date": p.end_date or "",
                }
                for p in profile.projects
            ],
        },
        {
            "type": "certifications",
            "items": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "issuer": c.issuer,
                    "issued_date": c.issued_date or "",
                    "expiry_date": c.expiry_date or "",
                    "credential_url": c.credential_url or "",
                }
                for c in profile.certifications
            ],
        },
    ]

    resume.sections = sections
    resume.ai_tailored = False
    await db.flush()
    await db.refresh(resume)
    return resume


# ---------------------------------------------------------------------------
# Save sections patch
# ---------------------------------------------------------------------------


@router.patch("/{resume_id}/sections", response_model=ResumeVersionResponse)
async def patch_resume_sections(
    resume_id: UUID,
    payload: SectionPatchRequest,
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
    resume.sections = payload.sections
    await db.flush()
    await db.refresh(resume)
    return resume


# ---------------------------------------------------------------------------
# AI edit
# ---------------------------------------------------------------------------


@router.post("/{resume_id}/ai-edit")
async def ai_edit_section(
    resume_id: UUID,
    payload: AiEditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Use AI to improve a resume section or bullet point."""
    # Verify ownership
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features not configured",
        )

    system_prompt = (
        "You are an expert resume writer helping a job seeker improve their CV. "
        "Respond with ONLY the improved text — no preamble, no explanation, no markdown fences. "
        "Keep the length similar to the original unless instructed otherwise. "
        "Use strong action verbs and quantify achievements where possible."
    )

    user_prompt_parts = [
        f"Section type: {payload.section_type}",
        f"Current content:\n{payload.content}",
        f"Instruction: {payload.instruction}",
    ]
    if payload.persona_name:
        user_prompt_parts.append(f"Target persona/role: {payload.persona_name}")
    if payload.job_description:
        user_prompt_parts.append(
            f"Job description to tailor for (highlight matching keywords):\n"
            f"{payload.job_description[:3000]}"
        )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=settings.OPENAI_FAST_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n\n".join(user_prompt_parts)},
        ],
        temperature=0.7,
        max_tokens=1024,
    )
    improved = response.choices[0].message.content or ""
    return {"improved": improved.strip()}
