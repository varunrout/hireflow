"""Initial schema - all core tables

Revision ID: 0001
Revises: 
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enums ---
    employment_type = postgresql.ENUM(
        "full_time", "part_time", "contract", "internship", "freelance",
        name="employmenttypeenum",
        create_type=False,
    )
    remote_type = postgresql.ENUM("remote", "hybrid", "onsite", name="remotetypeenum", create_type=False)
    application_status = postgresql.ENUM(
        "saved", "applied", "screening", "phone_interview", "technical_interview",
        "onsite_interview", "offer", "rejected", "withdrawn", "accepted",
        name="applicationstatusenum",
        create_type=False,
    )
    resume_format = postgresql.ENUM("ats", "designed", "tailored", name="resumeformatenum", create_type=False)
    job_source = postgresql.ENUM(
        "linkedin", "indeed", "glassdoor", "greenhouse", "lever", "workday", "manual", "other",
        name="jobsourceenum",
        create_type=False,
    )
    skill_category = postgresql.ENUM(
        "technical", "soft", "language", "tool", "framework", "other",
        name="skillcategoryenum",
        create_type=False,
    )
    skill_proficiency = postgresql.ENUM(
        "beginner", "intermediate", "advanced", "expert",
        name="skillproficiencyenum",
        create_type=False,
    )
    question_category = postgresql.ENUM(
        "behavioral", "technical", "situational", "background", "motivation", "other",
        name="questioncategoryenum",
        create_type=False,
    )
    document_status = postgresql.ENUM("draft", "final", "archived", name="documentstatusenum", create_type=False)

    for enum in [
        employment_type, remote_type, application_status, resume_format,
        job_source, skill_category, skill_proficiency, question_category, document_status,
    ]:
        enum.create(op.get_bind(), checkfirst=True)

    # --- Users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # --- Candidate Profiles ---
    op.create_table(
        "candidate_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("headline", sa.String(300)),
        sa.Column("summary", sa.Text()),
        sa.Column("phone", sa.String(30)),
        sa.Column("location", sa.String(200)),
        sa.Column("website_url", sa.String(500)),
        sa.Column("linkedin_url", sa.String(500)),
        sa.Column("github_url", sa.String(500)),
        sa.Column("years_of_experience", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    # --- Work Experiences ---
    op.create_table(
        "work_experiences",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company", sa.String(200), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("location", sa.String(200)),
        sa.Column("start_date", sa.String(7), nullable=False),
        sa.Column("end_date", sa.String(7)),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("description", sa.Text()),
        sa.Column("achievements", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("technologies", postgresql.ARRAY(sa.String(100)), server_default="{}"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_experiences_profile_id", "work_experiences", ["profile_id"])

    # --- Education ---
    op.create_table(
        "education",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("institution", sa.String(200), nullable=False),
        sa.Column("degree", sa.String(200), nullable=False),
        sa.Column("field_of_study", sa.String(200)),
        sa.Column("start_date", sa.String(7), nullable=False),
        sa.Column("end_date", sa.String(7)),
        sa.Column("gpa", sa.Float()),
        sa.Column("description", sa.Text()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_education_profile_id", "education", ["profile_id"])

    # --- Projects ---
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("url", sa.String(500)),
        sa.Column("repo_url", sa.String(500)),
        sa.Column("technologies", postgresql.ARRAY(sa.String(100)), server_default="{}"),
        sa.Column("start_date", sa.String(7)),
        sa.Column("end_date", sa.String(7)),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_profile_id", "projects", ["profile_id"])

    # --- Certifications ---
    op.create_table(
        "certifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("issuer", sa.String(200), nullable=False),
        sa.Column("issued_date", sa.String(7)),
        sa.Column("expiry_date", sa.String(7)),
        sa.Column("credential_id", sa.String(200)),
        sa.Column("credential_url", sa.String(500)),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_certifications_profile_id", "certifications", ["profile_id"])

    # --- Skills ---
    op.create_table(
        "skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", skill_category, nullable=False),
        sa.Column("proficiency", skill_proficiency),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_skills_profile_id", "skills", ["profile_id"])

    # --- Candidate Preferences ---
    op.create_table(
        "candidate_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("desired_roles", postgresql.ARRAY(sa.String(200)), server_default="{}"),
        sa.Column("desired_locations", postgresql.ARRAY(sa.String(200)), server_default="{}"),
        sa.Column("remote_preference", sa.String(20), server_default="any"),
        sa.Column("employment_types", postgresql.ARRAY(sa.String(50)), server_default="{}"),
        sa.Column("min_salary", sa.Integer()),
        sa.Column("max_salary", sa.Integer()),
        sa.Column("salary_currency", sa.String(3), server_default="USD"),
        sa.Column("desired_industries", postgresql.ARRAY(sa.String(200)), server_default="{}"),
        sa.Column("excluded_companies", postgresql.ARRAY(sa.String(200)), server_default="{}"),
        sa.Column("willing_to_relocate", sa.Boolean(), server_default="false"),
        sa.Column("notice_period_days", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    # --- Job Postings ---
    op.create_table(
        "job_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("company", sa.String(200), nullable=False),
        sa.Column("location", sa.String(200)),
        sa.Column("remote_type", remote_type),
        sa.Column("employment_type", employment_type),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("requirements", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("nice_to_haves", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("salary_min", sa.Integer()),
        sa.Column("salary_max", sa.Integer()),
        sa.Column("salary_currency", sa.String(3), server_default="USD"),
        sa.Column("source", job_source, nullable=False),
        sa.Column("source_url", sa.String(2048)),
        sa.Column("source_job_id", sa.String(500)),
        sa.Column("posted_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("raw_html", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- Resume Templates ---
    op.create_table(
        "resume_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("format", resume_format, nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("thumbnail_url", sa.String(500)),
        sa.Column("theme_tokens", postgresql.JSONB(), server_default="{}"),
        sa.Column("section_order", postgresql.ARRAY(sa.String(50)), server_default="{}"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- Resume Versions ---
    op.create_table(
        "resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True)),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True)),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("format", resume_format, nullable=False),
        sa.Column("sections", postgresql.JSONB(), server_default="[]"),
        sa.Column("theme_overrides", postgresql.JSONB()),
        sa.Column("ai_tailored", sa.Boolean(), server_default="false"),
        sa.Column("ai_generation_metadata", postgresql.JSONB()),
        sa.Column("status", document_status, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["resume_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_versions_user_id", "resume_versions", ["user_id"])

    # --- Cover Letter Versions ---
    op.create_table(
        "cover_letter_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True)),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), server_default="false"),
        sa.Column("ai_generation_metadata", postgresql.JSONB()),
        sa.Column("status", document_status, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cover_letter_versions_user_id", "cover_letter_versions", ["user_id"])

    # --- Job Parse Results ---
    op.create_table(
        "job_parse_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("required_skills", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("preferred_skills", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("required_experience_years", sa.Integer()),
        sa.Column("required_education", sa.String(200)),
        sa.Column("keywords", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("responsibilities", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("benefits", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("parsed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("parser_version", sa.String(50)),
        sa.Column("raw_output", postgresql.JSONB()),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_posting_id"),
    )

    # --- Job Matches ---
    op.create_table(
        "job_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("skill_score", sa.Float(), nullable=False),
        sa.Column("experience_score", sa.Float(), nullable=False),
        sa.Column("education_score", sa.Float(), nullable=False),
        sa.Column("location_score", sa.Float(), nullable=False),
        sa.Column("salary_score", sa.Float(), nullable=False),
        sa.Column("missing_skills", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("matching_skills", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("disqualifiers", postgresql.ARRAY(sa.Text()), server_default="{}"),
        sa.Column("recommendation", sa.String(50), nullable=False),
        sa.Column("explanation", sa.Text()),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_matches_user_id", "job_matches", ["user_id"])
    op.create_index("ix_job_matches_job_posting_id", "job_matches", ["job_posting_id"])

    # --- Applications ---
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resume_version_id", postgresql.UUID(as_uuid=True)),
        sa.Column("cover_letter_version_id", postgresql.UUID(as_uuid=True)),
        sa.Column("status", application_status, server_default="saved", nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        sa.Column("source", sa.String(20), server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cover_letter_version_id"], ["cover_letter_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resume_version_id"], ["resume_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_index("ix_applications_job_posting_id", "applications", ["job_posting_id"])
    op.create_index("ix_applications_status", "applications", ["status"])

    # --- Application Answers ---
    op.create_table(
        "application_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), server_default="false"),
        sa.Column("reviewed", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_application_answers_application_id", "application_answers", ["application_id"])

    # --- Question Bank ---
    op.create_table(
        "question_bank_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("category", question_category, nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.String(100)), server_default="{}"),
        sa.Column("times_used", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_bank_entries_user_id", "question_bank_entries", ["user_id"])

    # --- Analytics Events ---
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("properties", postgresql.JSONB(), server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"])
    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"])

    # --- Audit Logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(200)),
        sa.Column("changes", postgresql.JSONB()),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_occurred_at", "audit_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("analytics_events")
    op.drop_table("question_bank_entries")
    op.drop_table("application_answers")
    op.drop_table("applications")
    op.drop_table("job_matches")
    op.drop_table("job_parse_results")
    op.drop_table("cover_letter_versions")
    op.drop_table("resume_versions")
    op.drop_table("resume_templates")
    op.drop_table("job_postings")
    op.drop_table("candidate_preferences")
    op.drop_table("skills")
    op.drop_table("certifications")
    op.drop_table("projects")
    op.drop_table("education")
    op.drop_table("work_experiences")
    op.drop_table("candidate_profiles")
    op.drop_table("users")

    for enum_name in [
        "employmenttypeenum", "remotetypeenum", "applicationstatusenum", "resumeformatenum",
        "jobsourceenum", "skillcategoryenum", "skillproficiencyenum",
        "questioncategoryenum", "documentstatusenum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
