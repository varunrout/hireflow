"""Candidate Profile API endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import (
    CandidatePreference,
    CandidateProfile,
    Certification,
    Education,
    Project,
    Skill,
    User,
    WorkExperience,
)
from app.schemas.schemas import (
    CandidatePreferenceCreate,
    CandidatePreferenceResponse,
    CandidateProfileCreate,
    CandidateProfileResponse,
    CandidateProfileUpdate,
    CertificationCreate,
    CertificationResponse,
    EducationCreate,
    EducationResponse,
    ProjectCreate,
    ProjectResponse,
    SkillCreate,
    SkillResponse,
    WorkExperienceCreate,
    WorkExperienceResponse,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


async def _get_profile_or_404(user_id: UUID, db: AsyncSession) -> CandidateProfile:
    result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user_id)
        .options(
            selectinload(CandidateProfile.work_experiences),
            selectinload(CandidateProfile.education),
            selectinload(CandidateProfile.projects),
            selectinload(CandidateProfile.certifications),
            selectinload(CandidateProfile.skills),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


@router.get("/me", response_model=CandidateProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CandidateProfile:
    return await _get_profile_or_404(current_user.id, db)


@router.post("/me", response_model=CandidateProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: CandidateProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CandidateProfile:
    existing = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Profile already exists"
        )
    profile = CandidateProfile(user_id=current_user.id, **payload.model_dump())
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return await _get_profile_or_404(current_user.id, db)


@router.put("/me", response_model=CandidateProfileResponse)
async def update_profile(
    payload: CandidateProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CandidateProfile:
    profile = await _get_profile_or_404(current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()
    return await _get_profile_or_404(current_user.id, db)


# ---------------------------------------------------------------------------
# Work Experience
# ---------------------------------------------------------------------------


@router.post(
    "/me/experiences",
    response_model=WorkExperienceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_experience(
    payload: WorkExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkExperience:
    profile = await _get_profile_or_404(current_user.id, db)
    experience = WorkExperience(profile_id=profile.id, **payload.model_dump())
    db.add(experience)
    await db.flush()
    await db.refresh(experience)
    return experience


@router.put(
    "/me/experiences/{experience_id}",
    response_model=WorkExperienceResponse,
)
async def update_experience(
    experience_id: UUID,
    payload: WorkExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkExperience:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(WorkExperience).where(
            WorkExperience.id == experience_id,
            WorkExperience.profile_id == profile.id,
        )
    )
    experience = result.scalar_one_or_none()
    if not experience:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experience not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(experience, field, value)
    await db.flush()
    await db.refresh(experience)
    return experience


@router.delete("/me/experiences/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_experience(
    experience_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(WorkExperience).where(
            WorkExperience.id == experience_id,
            WorkExperience.profile_id == profile.id,
        )
    )
    experience = result.scalar_one_or_none()
    if not experience:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experience not found")
    await db.delete(experience)


# ---------------------------------------------------------------------------
# Education
# ---------------------------------------------------------------------------


@router.post(
    "/me/education",
    response_model=EducationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_education(
    payload: EducationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Education:
    profile = await _get_profile_or_404(current_user.id, db)
    edu = Education(profile_id=profile.id, **payload.model_dump())
    db.add(edu)
    await db.flush()
    await db.refresh(edu)
    return edu


@router.delete("/me/education/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_education(
    education_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Education).where(
            Education.id == education_id, Education.profile_id == profile.id
        )
    )
    edu = result.scalar_one_or_none()
    if not edu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Education not found")
    await db.delete(edu)


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------


@router.post(
    "/me/skills",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_skill(
    payload: SkillCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Skill:
    profile = await _get_profile_or_404(current_user.id, db)
    skill = Skill(profile_id=profile.id, **payload.model_dump())
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.delete("/me/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.profile_id == profile.id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    await db.delete(skill)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.post(
    "/me/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    profile = await _get_profile_or_404(current_user.id, db)
    project = Project(profile_id=profile.id, **payload.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/me/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.profile_id == profile.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await db.delete(project)


# ---------------------------------------------------------------------------
# Certifications
# ---------------------------------------------------------------------------


@router.post(
    "/me/certifications",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_certification(
    payload: CertificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Certification:
    profile = await _get_profile_or_404(current_user.id, db)
    cert = Certification(profile_id=profile.id, **payload.model_dump())
    db.add(cert)
    await db.flush()
    await db.refresh(cert)
    return cert


@router.delete(
    "/me/certifications/{certification_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_certification(
    certification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    profile = await _get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Certification).where(
            Certification.id == certification_id, Certification.profile_id == profile.id
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found"
        )
    await db.delete(cert)


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


@router.get("/me/preferences", response_model=CandidatePreferenceResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CandidatePreference:
    result = await db.execute(
        select(CandidatePreference).where(CandidatePreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found"
        )
    return prefs


@router.put("/me/preferences", response_model=CandidatePreferenceResponse)
async def upsert_preferences(
    payload: CandidatePreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CandidatePreference:
    result = await db.execute(
        select(CandidatePreference).where(CandidatePreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if prefs:
        for field, value in payload.model_dump().items():
            setattr(prefs, field, value)
    else:
        prefs = CandidatePreference(user_id=current_user.id, **payload.model_dump())
        db.add(prefs)
    await db.flush()
    await db.refresh(prefs)
    return prefs
