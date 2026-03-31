"""Automation pipeline enhancements — scheduling, approval queue, discovery rules, confidence tiers.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- AutomationPipelineSettings: new columns ---
    # Scheduling
    op.add_column("automation_pipeline_settings", sa.Column("schedule_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("automation_pipeline_settings", sa.Column("schedule_cron", sa.String(100), nullable=True))
    op.add_column("automation_pipeline_settings", sa.Column("schedule_timezone", sa.String(60), nullable=False, server_default=sa.text("'UTC'")))
    op.add_column("automation_pipeline_settings", sa.Column("schedule_paused", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("automation_pipeline_settings", sa.Column("run_window_start", sa.Integer(), nullable=True))
    op.add_column("automation_pipeline_settings", sa.Column("run_window_end", sa.Integer(), nullable=True))
    op.add_column("automation_pipeline_settings", sa.Column("next_scheduled_at", sa.DateTime(timezone=True), nullable=True))

    # Enhanced discovery
    op.add_column("automation_pipeline_settings", sa.Column("freshness_days", sa.Integer(), nullable=False, server_default=sa.text("30")))
    op.add_column("automation_pipeline_settings", sa.Column("company_blacklist", ARRAY(sa.String(200)), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("automation_pipeline_settings", sa.Column("company_whitelist", ARRAY(sa.String(200)), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("automation_pipeline_settings", sa.Column("min_salary_floor", sa.Integer(), nullable=True))
    op.add_column("automation_pipeline_settings", sa.Column("experience_levels", ARRAY(sa.String(50)), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("automation_pipeline_settings", sa.Column("employment_types", ARRAY(sa.String(50)), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("automation_pipeline_settings", sa.Column("target_industries", ARRAY(sa.String(200)), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("automation_pipeline_settings", sa.Column("excluded_industries", ARRAY(sa.String(200)), nullable=False, server_default=sa.text("'{}'")))

    # Confidence tiers
    op.add_column("automation_pipeline_settings", sa.Column("confidence_auto_apply_threshold", sa.Float(), nullable=False, server_default=sa.text("90.0")))
    op.add_column("automation_pipeline_settings", sa.Column("confidence_review_threshold", sa.Float(), nullable=False, server_default=sa.text("75.0")))
    op.add_column("automation_pipeline_settings", sa.Column("confidence_save_threshold", sa.Float(), nullable=False, server_default=sa.text("65.0")))

    # Persona-based pipeline
    op.add_column("automation_pipeline_settings", sa.Column("persona_id", UUID(as_uuid=True), sa.ForeignKey("personas.id", ondelete="SET NULL"), nullable=True))

    # Notifications
    op.add_column("automation_pipeline_settings", sa.Column("email_digest_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("automation_pipeline_settings", sa.Column("email_digest_frequency", sa.String(20), nullable=False, server_default=sa.text("'weekly'")))
    op.add_column("automation_pipeline_settings", sa.Column("high_match_alert_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("automation_pipeline_settings", sa.Column("high_match_alert_threshold", sa.Float(), nullable=False, server_default=sa.text("90.0")))

    # --- AutomationPipelineRun: enhanced columns ---
    op.add_column("automation_pipeline_runs", sa.Column("scoring_duration_ms", sa.Integer(), nullable=True))
    op.add_column("automation_pipeline_runs", sa.Column("total_duration_ms", sa.Integer(), nullable=True))
    op.add_column("automation_pipeline_runs", sa.Column("jobs_evaluated", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("automation_pipeline_runs", sa.Column("new_matches_count", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("automation_pipeline_runs", sa.Column("expired_since_last_run", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("automation_pipeline_runs", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("automation_pipeline_runs", sa.Column("queued_for_review_count", sa.Integer(), nullable=False, server_default=sa.text("0")))

    # --- New table: automation_approval_queue ---
    op.create_table(
        "automation_approval_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("job_posting_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_match_id", UUID(as_uuid=True), sa.ForeignKey("job_matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pipeline_run_id", UUID(as_uuid=True), sa.ForeignKey("automation_pipeline_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("recommendation", sa.String(50), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_approval_queue_user_status", "automation_approval_queue", ["user_id", "status"])

    # --- New table: automation_notifications ---
    op.create_table(
        "automation_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("data", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("automation_notifications")
    op.drop_index("ix_approval_queue_user_status", table_name="automation_approval_queue")
    op.drop_table("automation_approval_queue")

    # AutomationPipelineRun columns
    for col in ["scoring_duration_ms", "total_duration_ms", "jobs_evaluated", "new_matches_count", "expired_since_last_run", "error_message", "queued_for_review_count"]:
        op.drop_column("automation_pipeline_runs", col)

    # AutomationPipelineSettings columns
    for col in [
        "schedule_enabled", "schedule_cron", "schedule_timezone", "schedule_paused",
        "run_window_start", "run_window_end", "next_scheduled_at",
        "freshness_days", "company_blacklist", "company_whitelist", "min_salary_floor",
        "experience_levels", "employment_types", "target_industries", "excluded_industries",
        "confidence_auto_apply_threshold", "confidence_review_threshold", "confidence_save_threshold",
        "persona_id",
        "email_digest_enabled", "email_digest_frequency", "high_match_alert_enabled", "high_match_alert_threshold",
    ]:
        op.drop_column("automation_pipeline_settings", col)
