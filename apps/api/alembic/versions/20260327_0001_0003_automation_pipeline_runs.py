"""Add automation pipeline runs

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-27 00:01:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "automation_pipeline_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("triggered_by", sa.String(length=20), server_default="manual", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="completed", nullable=False),
        sa.Column("matched_jobs_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reviewed_jobs_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("applied_jobs_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_jobs_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("summary", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_automation_pipeline_runs_user_id",
        "automation_pipeline_runs",
        ["user_id"],
    )
    op.create_index(
        "ix_automation_pipeline_runs_started_at",
        "automation_pipeline_runs",
        ["started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_automation_pipeline_runs_started_at", table_name="automation_pipeline_runs")
    op.drop_index("ix_automation_pipeline_runs_user_id", table_name="automation_pipeline_runs")
    op.drop_table("automation_pipeline_runs")
