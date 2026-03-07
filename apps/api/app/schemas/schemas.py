"""Pydantic schemas for API request/response serialization."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseSchema):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseSchema):
    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseSchema):
    refresh_token: str


class UserResponse(BaseSchema):
    id: UUID
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Profile schemas
# ---------------------------------------------------------------------------


class WorkExperienceCreate(BaseSchema):
    company: str
    title: str
    location: str | None = None
    start_date: str
    end_date: str | None = None
    is_current: bool = False
    description: str | None = None
    achievements: list[str] = []
    technologies: list[str] = []


class WorkExperienceResponse(WorkExperienceCreate):
    id: UUID
    profile_id: UUID


class EducationCreate(BaseSchema):
    institution: str
    degree: str
    field_of_study: str | None = None
    start_date: str
    end_date: str | None = None
    gpa: float | None = None
    description: str | None = None


class EducationResponse(EducationCreate):
    id: UUID
    profile_id: UUID


class ProjectCreate(BaseSchema):
    name: str
    description: str | None = None
    url: str | None = None
    repo_url: str | None = None
    technologies: list[str] = []
    start_date: str | None = None
    end_date: str | None = None


class ProjectResponse(ProjectCreate):
    id: UUID
    profile_id: UUID


class CertificationCreate(BaseSchema):
    name: str
    issuer: str
    issued_date: str | None = None
    expiry_date: str | None = None
    credential_id: str | None = None
    credential_url: str | None = None


class CertificationResponse(CertificationCreate):
    id: UUID
    profile_id: UUID


class SkillCreate(BaseSchema):
    name: str
    category: str = "technical"
    proficiency: str | None = None


class SkillResponse(SkillCreate):
    id: UUID
    profile_id: UUID


class CandidateProfileCreate(BaseSchema):
    headline: str | None = None
    summary: str | None = None
    phone: str | None = None
    location: str | None = None
    website_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    years_of_experience: int | None = None


class CandidateProfileUpdate(CandidateProfileCreate):
    pass


class CandidateProfileResponse(CandidateProfileCreate):
    id: UUID
    user_id: UUID
    work_experiences: list[WorkExperienceResponse] = []
    education: list[EducationResponse] = []
    projects: list[ProjectResponse] = []
    certifications: list[CertificationResponse] = []
    skills: list[SkillResponse] = []
    created_at: datetime
    updated_at: datetime


class CandidatePreferenceCreate(BaseSchema):
    desired_roles: list[str] = []
    desired_locations: list[str] = []
    remote_preference: str = "any"
    employment_types: list[str] = []
    min_salary: int | None = None
    max_salary: int | None = None
    salary_currency: str = "USD"
    desired_industries: list[str] = []
    excluded_companies: list[str] = []
    willing_to_relocate: bool = False
    notice_period_days: int | None = None


class CandidatePreferenceResponse(CandidatePreferenceCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Job schemas
# ---------------------------------------------------------------------------


class JobPostingCreate(BaseSchema):
    title: str
    company: str
    location: str | None = None
    remote_type: str | None = None
    employment_type: str | None = None
    description: str
    requirements: list[str] = []
    nice_to_haves: list[str] = []
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    source: str
    source_url: str | None = None
    source_job_id: str | None = None


class JobPostingResponse(JobPostingCreate):
    id: UUID
    is_active: bool
    posted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class JobParseResultResponse(BaseSchema):
    id: UUID
    job_posting_id: UUID
    required_skills: list[str]
    preferred_skills: list[str]
    required_experience_years: int | None
    required_education: str | None
    keywords: list[str]
    responsibilities: list[str]
    benefits: list[str]
    parsed_at: datetime
    parser_version: str | None


class JobMatchResponse(BaseSchema):
    id: UUID
    user_id: UUID
    job_posting_id: UUID
    profile_id: UUID
    overall_score: float
    skill_score: float
    experience_score: float
    education_score: float
    location_score: float
    salary_score: float
    missing_skills: list[str]
    matching_skills: list[str]
    disqualifiers: list[str]
    recommendation: str
    explanation: str | None
    computed_at: datetime


# ---------------------------------------------------------------------------
# Resume schemas
# ---------------------------------------------------------------------------


class ResumeVersionCreate(BaseSchema):
    name: str
    format: str
    template_id: UUID | None = None
    job_posting_id: UUID | None = None
    sections: list[dict] = []
    theme_overrides: dict | None = None


class ResumeVersionResponse(ResumeVersionCreate):
    id: UUID
    user_id: UUID
    profile_id: UUID
    ai_tailored: bool
    ai_generation_metadata: dict | None
    status: str
    created_at: datetime
    updated_at: datetime


class CoverLetterCreate(BaseSchema):
    content: str
    job_posting_id: UUID | None = None


class CoverLetterResponse(CoverLetterCreate):
    id: UUID
    user_id: UUID
    ai_generated: bool
    ai_generation_metadata: dict | None
    status: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Application schemas
# ---------------------------------------------------------------------------


class ApplicationCreate(BaseSchema):
    job_posting_id: UUID
    resume_version_id: UUID | None = None
    cover_letter_version_id: UUID | None = None
    notes: str | None = None
    source: str = "manual"


class ApplicationStatusUpdate(BaseSchema):
    status: str
    notes: str | None = None


class ApplicationResponse(BaseSchema):
    id: UUID
    user_id: UUID
    job_posting_id: UUID
    resume_version_id: UUID | None
    cover_letter_version_id: UUID | None
    status: str
    applied_at: datetime | None
    notes: str | None
    source: str
    created_at: datetime
    updated_at: datetime


class ApplicationAnswerCreate(BaseSchema):
    question: str
    answer: str
    ai_generated: bool = False


class ApplicationAnswerResponse(ApplicationAnswerCreate):
    id: UUID
    application_id: UUID
    reviewed: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseSchema):
    items: list
    total: int
    page: int
    limit: int
    pages: int
