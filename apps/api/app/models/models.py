"""SQLAlchemy ORM models for all core entities."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class EmploymentTypeEnum(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"
    freelance = "freelance"


class RemoteTypeEnum(str, enum.Enum):
    remote = "remote"
    hybrid = "hybrid"
    onsite = "onsite"


class ApplicationStatusEnum(str, enum.Enum):
    saved = "saved"
    applied = "applied"
    screening = "screening"
    phone_interview = "phone_interview"
    technical_interview = "technical_interview"
    onsite_interview = "onsite_interview"
    offer = "offer"
    rejected = "rejected"
    withdrawn = "withdrawn"
    accepted = "accepted"


class ResumeFormatEnum(str, enum.Enum):
    ats = "ats"
    designed = "designed"
    tailored = "tailored"


class JobSourceEnum(str, enum.Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    glassdoor = "glassdoor"
    greenhouse = "greenhouse"
    lever = "lever"
    workday = "workday"
    manual = "manual"
    other = "other"


class SkillCategoryEnum(str, enum.Enum):
    technical = "technical"
    soft = "soft"
    language = "language"
    tool = "tool"
    framework = "framework"
    other = "other"


class SkillProficiencyEnum(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"


class QuestionCategoryEnum(str, enum.Enum):
    behavioral = "behavioral"
    technical = "technical"
    situational = "situational"
    background = "background"
    motivation = "motivation"
    other = "other"


class DocumentStatusEnum(str, enum.Enum):
    draft = "draft"
    final = "final"
    archived = "archived"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    profile: Mapped["CandidateProfile | None"] = relationship(
        "CandidateProfile", back_populates="user", uselist=False
    )
    preferences: Mapped["CandidatePreference | None"] = relationship(
        "CandidatePreference", back_populates="user", uselist=False
    )
    automation_settings: Mapped["AutomationPipelineSettings | None"] = relationship(
        "AutomationPipelineSettings", back_populates="user", uselist=False
    )
    automation_runs: Mapped[list["AutomationPipelineRun"]] = relationship(
        "AutomationPipelineRun", back_populates="user"
    )
    resume_versions: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion", back_populates="user"
    )
    personas: Mapped[list["Persona"]] = relationship(
        "Persona", back_populates="user", cascade="all, delete-orphan"
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="user"
    )
    job_postings: Mapped[list["JobPosting"]] = relationship(
        "JobPosting", back_populates="user"
    )
    approval_queue: Mapped[list["AutomationApprovalQueueItem"]] = relationship(
        "AutomationApprovalQueueItem", back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["AutomationNotification"]] = relationship(
        "AutomationNotification", back_populates="user", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Candidate Profile
# ---------------------------------------------------------------------------


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    headline: Mapped[str | None] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(200))
    website_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))
    years_of_experience: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile")
    work_experiences: Mapped[list["WorkExperience"]] = relationship(
        "WorkExperience", back_populates="profile", cascade="all, delete-orphan"
    )
    education: Mapped[list["Education"]] = relationship(
        "Education", back_populates="profile", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="profile", cascade="all, delete-orphan"
    )
    certifications: Mapped[list["Certification"]] = relationship(
        "Certification", back_populates="profile", cascade="all, delete-orphan"
    )
    skills: Mapped[list["Skill"]] = relationship(
        "Skill", back_populates="profile", cascade="all, delete-orphan"
    )


class WorkExperience(Base):
    __tablename__ = "work_experiences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    start_date: Mapped[str] = mapped_column(String(7), nullable=False)
    end_date: Mapped[str | None] = mapped_column(String(7))
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    achievements: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    technologies: Mapped[list] = mapped_column(ARRAY(String(100)), default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="work_experiences"
    )


class Education(Base):
    __tablename__ = "education"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    field_of_study: Mapped[str | None] = mapped_column(String(200))
    start_date: Mapped[str] = mapped_column(String(7), nullable=False)
    end_date: Mapped[str | None] = mapped_column(String(7))
    gpa: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    profile: Mapped["CandidateProfile"] = relationship("CandidateProfile", back_populates="education")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(500))
    repo_url: Mapped[str | None] = mapped_column(String(500))
    technologies: Mapped[list] = mapped_column(ARRAY(String(100)), default=list)
    start_date: Mapped[str | None] = mapped_column(String(7))
    end_date: Mapped[str | None] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    profile: Mapped["CandidateProfile"] = relationship("CandidateProfile", back_populates="projects")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str] = mapped_column(String(200), nullable=False)
    issued_date: Mapped[str | None] = mapped_column(String(7))
    expiry_date: Mapped[str | None] = mapped_column(String(7))
    credential_id: Mapped[str | None] = mapped_column(String(200))
    credential_url: Mapped[str | None] = mapped_column(String(500))

    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="certifications"
    )


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[SkillCategoryEnum] = mapped_column(
        Enum(SkillCategoryEnum), nullable=False, default=SkillCategoryEnum.technical
    )
    proficiency: Mapped[SkillProficiencyEnum | None] = mapped_column(Enum(SkillProficiencyEnum))

    profile: Mapped["CandidateProfile"] = relationship("CandidateProfile", back_populates="skills")


class CandidatePreference(Base):
    __tablename__ = "candidate_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    desired_roles: Mapped[list] = mapped_column(ARRAY(String(200)), default=list)
    desired_locations: Mapped[list] = mapped_column(ARRAY(String(200)), default=list)
    remote_preference: Mapped[str] = mapped_column(String(20), default="any")
    employment_types: Mapped[list] = mapped_column(ARRAY(String(50)), default=list)
    min_salary: Mapped[int | None] = mapped_column(Integer)
    max_salary: Mapped[int | None] = mapped_column(Integer)
    salary_currency: Mapped[str] = mapped_column(String(3), default="USD")
    desired_industries: Mapped[list] = mapped_column(ARRAY(String(200)), default=list)
    excluded_companies: Mapped[list] = mapped_column(ARRAY(String(200)), default=list)
    willing_to_relocate: Mapped[bool] = mapped_column(Boolean, default=False)
    notice_period_days: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="preferences")


class AutomationPipelineSettings(Base):
    __tablename__ = "automation_pipeline_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_apply_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    require_human_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_tailor_resume: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_generate_cover_letter: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allowed_sources: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    search_terms: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    target_locations: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    excluded_keywords: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    min_match_score: Mapped[float] = mapped_column(Float, default=70.0, nullable=False)
    max_jobs_per_run: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    max_applications_per_day: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    # Scheduling
    schedule_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    schedule_cron: Mapped[str | None] = mapped_column(String(100))
    schedule_timezone: Mapped[str] = mapped_column(String(60), default="UTC", nullable=False)
    schedule_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    run_window_start: Mapped[int | None] = mapped_column(Integer)  # hour 0-23
    run_window_end: Mapped[int | None] = mapped_column(Integer)  # hour 0-23
    next_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Enhanced discovery
    freshness_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    company_blacklist: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    company_whitelist: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    min_salary_floor: Mapped[int | None] = mapped_column(Integer)
    experience_levels: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    employment_types: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    target_industries: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)
    excluded_industries: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list)

    # Confidence tiers
    confidence_auto_apply_threshold: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)
    confidence_review_threshold: Mapped[float] = mapped_column(Float, default=75.0, nullable=False)
    confidence_save_threshold: Mapped[float] = mapped_column(Float, default=65.0, nullable=False)

    # Persona link
    persona_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("personas.id", ondelete="SET NULL")
    )

    # Notifications
    email_digest_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_digest_frequency: Mapped[str] = mapped_column(String(20), default="weekly", nullable=False)
    high_match_alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    high_match_alert_threshold: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="automation_settings")
    persona: Mapped["Persona | None"] = relationship("Persona", foreign_keys=[persona_id])


class AutomationPipelineRun(Base):
    __tablename__ = "automation_pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    triggered_by: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    matched_jobs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reviewed_jobs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applied_jobs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_jobs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    queued_for_review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_evaluated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_matches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expired_since_last_run: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scoring_duration_ms: Mapped[int | None] = mapped_column(Integer)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="automation_runs")
    approval_queue_items: Mapped[list["AutomationApprovalQueueItem"]] = relationship(
        "AutomationApprovalQueueItem", back_populates="pipeline_run"
    )


class ApprovalStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    deferred = "deferred"
    expired = "expired"


class AutomationApprovalQueueItem(Base):
    __tablename__ = "automation_approval_queue"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False
    )
    job_match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_matches.id", ondelete="CASCADE"), nullable=False
    )
    pipeline_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("automation_pipeline_runs.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    recommendation: Mapped[str] = mapped_column(String(50), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="approval_queue")
    job_posting: Mapped["JobPosting"] = relationship("JobPosting")
    job_match: Mapped["JobMatch"] = relationship("JobMatch")
    pipeline_run: Mapped["AutomationPipelineRun | None"] = relationship(
        "AutomationPipelineRun", back_populates="approval_queue_items"
    )


class NotificationTypeEnum(str, enum.Enum):
    high_match = "high_match"
    run_completed = "run_completed"
    run_failed = "run_failed"
    daily_limit = "daily_limit"
    digest = "digest"


class AutomationNotification(Base):
    __tablename__ = "automation_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="notifications")


# ---------------------------------------------------------------------------
# Persona
# ---------------------------------------------------------------------------


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    target_roles: Mapped[list] = mapped_column(ARRAY(String(200)), default=list)
    color: Mapped[str | None] = mapped_column(String(20))  # hex color e.g. #3b82f6
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="personas")
    resumes: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion", back_populates="persona", foreign_keys="ResumeVersion.persona_id"
    )


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------


class ResumeTemplate(Base):
    __tablename__ = "resume_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    format: Mapped[ResumeFormatEnum] = mapped_column(Enum(ResumeFormatEnum), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    theme_tokens: Mapped[dict] = mapped_column(JSONB, default=dict)
    section_order: Mapped[list] = mapped_column(ARRAY(String(50)), default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resume_templates.id", ondelete="SET NULL")
    )
    job_posting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="SET NULL")
    )
    persona_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("personas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    format: Mapped[ResumeFormatEnum] = mapped_column(Enum(ResumeFormatEnum), nullable=False)
    sections: Mapped[list] = mapped_column(JSONB, default=list)
    theme_overrides: Mapped[dict | None] = mapped_column(JSONB)
    ai_tailored: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_generation_metadata: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[DocumentStatusEnum] = mapped_column(
        Enum(DocumentStatusEnum), default=DocumentStatusEnum.draft
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="resume_versions")
    persona: Mapped["Persona | None"] = relationship(
        "Persona", back_populates="resumes", foreign_keys=[persona_id]
    )


class CoverLetterVersion(Base):
    __tablename__ = "cover_letter_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_posting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_generation_metadata: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[DocumentStatusEnum] = mapped_column(
        Enum(DocumentStatusEnum), default=DocumentStatusEnum.draft
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# Job
# ---------------------------------------------------------------------------


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    remote_type: Mapped[RemoteTypeEnum | None] = mapped_column(Enum(RemoteTypeEnum))
    employment_type: Mapped[EmploymentTypeEnum | None] = mapped_column(Enum(EmploymentTypeEnum))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    nice_to_haves: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    salary_currency: Mapped[str] = mapped_column(String(3), default="USD")
    source: Mapped[JobSourceEnum] = mapped_column(Enum(JobSourceEnum), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048))
    source_job_id: Mapped[str | None] = mapped_column(String(500))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    raw_html: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    parse_result: Mapped["JobParseResult | None"] = relationship(
        "JobParseResult", back_populates="job_posting", uselist=False
    )
    user: Mapped["User | None"] = relationship("User", back_populates="job_postings")
    matches: Mapped[list["JobMatch"]] = relationship("JobMatch", back_populates="job_posting")
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="job_posting"
    )


class JobParseResult(Base):
    __tablename__ = "job_parse_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    required_skills: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    preferred_skills: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    required_experience_years: Mapped[int | None] = mapped_column(Integer)
    required_education: Mapped[str | None] = mapped_column(String(200))
    keywords: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    responsibilities: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    benefits: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    parsed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    parser_version: Mapped[str | None] = mapped_column(String(50))
    raw_output: Mapped[dict | None] = mapped_column(JSONB)

    job_posting: Mapped["JobPosting"] = relationship(
        "JobPosting", back_populates="parse_result"
    )


class JobMatch(Base):
    __tablename__ = "job_matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    skill_score: Mapped[float] = mapped_column(Float, nullable=False)
    experience_score: Mapped[float] = mapped_column(Float, nullable=False)
    education_score: Mapped[float] = mapped_column(Float, nullable=False)
    location_score: Mapped[float] = mapped_column(Float, nullable=False)
    salary_score: Mapped[float] = mapped_column(Float, nullable=False)
    missing_skills: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    matching_skills: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    disqualifiers: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    recommendation: Mapped[str] = mapped_column(String(50), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job_posting: Mapped["JobPosting"] = relationship("JobPosting", back_populates="matches")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resume_versions.id", ondelete="SET NULL")
    )
    cover_letter_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cover_letter_versions.id", ondelete="SET NULL")
    )
    status: Mapped[ApplicationStatusEnum] = mapped_column(
        Enum(ApplicationStatusEnum),
        default=ApplicationStatusEnum.saved,
        nullable=False,
        index=True,
    )
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="applications")
    job_posting: Mapped["JobPosting"] = relationship("JobPosting", back_populates="applications")
    answers: Mapped[list["ApplicationAnswer"]] = relationship(
        "ApplicationAnswer", back_populates="application", cascade="all, delete-orphan"
    )


class ApplicationAnswer(Base):
    __tablename__ = "application_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    application: Mapped["Application"] = relationship("Application", back_populates="answers")


class QuestionBankEntry(Base):
    __tablename__ = "question_bank_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[QuestionCategoryEnum] = mapped_column(
        Enum(QuestionCategoryEnum), nullable=False
    )
    tags: Mapped[list] = mapped_column(ARRAY(String(100)), default=list)
    times_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# Analytics / Audit
# ---------------------------------------------------------------------------


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(200))
    changes: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
