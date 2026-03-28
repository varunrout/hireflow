"""Candidate Profile API endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
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
    CompletenessResponse,
    EducationCreate,
    EducationResponse,
    ImportSummary,
    ParsedResumeImport,
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


# ---------------------------------------------------------------------------
# Profile completeness
# ---------------------------------------------------------------------------


@router.get("/me/completeness", response_model=CompletenessResponse)
async def get_profile_completeness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.resume_parser import compute_completeness

    profile = await _get_profile_or_404(current_user.id, db)
    return compute_completeness(profile)


# ---------------------------------------------------------------------------
# PDF resume import
# ---------------------------------------------------------------------------


@router.post(
    "/import-pdf",
    response_model=ParsedResumeImport,
    status_code=status.HTTP_200_OK,
)
async def import_resume_pdf(
    file: UploadFile = File(..., description="PDF resume file"),
    mode: str = Query("merge", pattern="^(merge|overwrite)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Upload a PDF resume → AI extracts all profile sections → upserts into the database.

    mode=merge   (default) – only fills fields that are currently blank/empty.
    mode=overwrite         – replaces all fields, adds all items fresh.
    """
    from app.services.resume_parser import compute_completeness, extract_text_from_pdf, parse_resume_with_ai

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are supported",
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="PDF file too large (max 10 MB)",
        )

    # 1. Extract text
    try:
        text = extract_text_from_pdf(pdf_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from PDF: {exc}",
        )

    if len(text) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF appears to be a scanned image — text extraction failed. Try a text-based PDF.",
        )

    # 2. AI parse
    parsed = await parse_resume_with_ai(text)

    # 3. Get or create profile
    result = await db.execute(
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
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CandidateProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    added: dict[str, int] = {}
    skipped: dict[str, int] = {}

    # 4. Update basic profile fields
    basic_fields = ["headline", "summary", "phone", "location",
                    "linkedin_url", "github_url", "website_url", "years_of_experience"]
    for field in basic_fields:
        value = parsed.get(field)
        if value is None:
            continue
        existing = getattr(profile, field, None)
        if mode == "overwrite" or not existing:
            setattr(profile, field, value)
        else:
            skipped[field] = skipped.get(field, 0) + 1

    # 5. Work experiences
    if mode == "overwrite":
        for exp in profile.work_experiences:
            await db.delete(exp)
        profile.work_experiences.clear()

    exp_count = 0
    for exp_data in parsed.get("work_experiences", []):
        if mode == "merge":
            # Skip if same company+title already exists
            exists = any(
                e.company == exp_data.get("company") and e.title == exp_data.get("title")
                for e in profile.work_experiences
            )
            if exists:
                skipped["work_experiences"] = skipped.get("work_experiences", 0) + 1
                continue
        exp = WorkExperience(
            profile_id=profile.id,
            company=exp_data.get("company", "Unknown"),
            title=exp_data.get("title", "Unknown"),
            location=exp_data.get("location"),
            start_date=exp_data.get("start_date", "2020"),
            end_date=exp_data.get("end_date"),
            is_current=exp_data.get("is_current", False),
            description=exp_data.get("description"),
            achievements=exp_data.get("achievements", []),
            technologies=exp_data.get("technologies", []),
        )
        db.add(exp)
        exp_count += 1
    if exp_count:
        added["work_experiences"] = exp_count

    # 6. Education
    if mode == "overwrite":
        for edu in profile.education:
            await db.delete(edu)
        profile.education.clear()

    edu_count = 0
    for edu_data in parsed.get("education", []):
        if mode == "merge":
            exists = any(
                e.institution == edu_data.get("institution")
                for e in profile.education
            )
            if exists:
                skipped["education"] = skipped.get("education", 0) + 1
                continue
        edu = Education(
            profile_id=profile.id,
            institution=edu_data.get("institution", "Unknown"),
            degree=edu_data.get("degree", "Unknown"),
            field_of_study=edu_data.get("field_of_study"),
            start_date=edu_data.get("start_date", "2020"),
            end_date=edu_data.get("end_date"),
            gpa=edu_data.get("gpa"),
            description=edu_data.get("description"),
        )
        db.add(edu)
        edu_count += 1
    if edu_count:
        added["education"] = edu_count

    # 7. Skills
    if mode == "overwrite":
        for skill in profile.skills:
            await db.delete(skill)
        profile.skills.clear()

    skill_count = 0
    existing_skill_names = {s.name.lower() for s in profile.skills}
    for skill_data in parsed.get("skills", []):
        name = skill_data.get("name", "")
        if not name:
            continue
        if mode == "merge" and name.lower() in existing_skill_names:
            skipped["skills"] = skipped.get("skills", 0) + 1
            continue
        skill = Skill(
            profile_id=profile.id,
            name=name,
            category=skill_data.get("category", "technical"),
            proficiency=skill_data.get("proficiency"),
        )
        db.add(skill)
        existing_skill_names.add(name.lower())
        skill_count += 1
    if skill_count:
        added["skills"] = skill_count

    # 8. Certifications
    if mode == "overwrite":
        for cert in profile.certifications:
            await db.delete(cert)
        profile.certifications.clear()

    cert_count = 0
    for cert_data in parsed.get("certifications", []):
        if mode == "merge":
            exists = any(c.name == cert_data.get("name") for c in profile.certifications)
            if exists:
                skipped["certifications"] = skipped.get("certifications", 0) + 1
                continue
        cert = Certification(
            profile_id=profile.id,
            name=cert_data.get("name", "Unknown"),
            issuer=cert_data.get("issuer", "Unknown"),
            issued_date=cert_data.get("issued_date"),
            expiry_date=cert_data.get("expiry_date"),
            credential_id=cert_data.get("credential_id"),
            credential_url=cert_data.get("credential_url"),
        )
        db.add(cert)
        cert_count += 1
    if cert_count:
        added["certifications"] = cert_count

    # 9. Projects
    if mode == "overwrite":
        for proj in profile.projects:
            await db.delete(proj)
        profile.projects.clear()

    proj_count = 0
    for proj_data in parsed.get("projects", []):
        if mode == "merge":
            exists = any(p.name == proj_data.get("name") for p in profile.projects)
            if exists:
                skipped["projects"] = skipped.get("projects", 0) + 1
                continue
        proj = Project(
            profile_id=profile.id,
            name=proj_data.get("name", "Unknown"),
            description=proj_data.get("description"),
            url=proj_data.get("url"),
            repo_url=proj_data.get("repo_url"),
            technologies=proj_data.get("technologies", []),
            start_date=proj_data.get("start_date"),
            end_date=proj_data.get("end_date"),
        )
        db.add(proj)
        proj_count += 1
    if proj_count:
        added["projects"] = proj_count

    await db.flush()

    # Re-fetch fully loaded profile for response
    updated_profile = await _get_profile_or_404(current_user.id, db)

    return {
        "profile": updated_profile,
        "summary": {"added": added, "skipped": skipped},
        "raw_parsed": parsed,
    }
