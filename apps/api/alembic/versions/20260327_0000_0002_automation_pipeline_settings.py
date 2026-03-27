"""Add automation pipeline settings

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "automation_pipeline_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("auto_apply_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("require_human_review", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("auto_tailor_resume", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("auto_generate_cover_letter", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("allowed_sources", postgresql.ARRAY(sa.String(length=50)), server_default="{}", nullable=False),
        sa.Column("search_terms", postgresql.ARRAY(sa.String(length=200)), server_default="{}", nullable=False),
        sa.Column("target_locations", postgresql.ARRAY(sa.String(length=200)), server_default="{}", nullable=False),
        sa.Column("excluded_keywords", postgresql.ARRAY(sa.String(length=200)), server_default="{}", nullable=False),
        sa.Column("min_match_score", sa.Float(), server_default="70", nullable=False),
        sa.Column("max_jobs_per_run", sa.Integer(), server_default="25", nullable=False),
        sa.Column("max_applications_per_day", sa.Integer(), server_default="5", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_automation_pipeline_settings_user_id",
        "automation_pipeline_settings",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_automation_pipeline_settings_user_id", table_name="automation_pipeline_settings")
    op.drop_table("automation_pipeline_settings")
