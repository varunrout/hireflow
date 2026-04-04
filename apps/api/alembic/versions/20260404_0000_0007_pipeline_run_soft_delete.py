"""Add deleted_at to automation_pipeline_runs for soft-delete support.

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "automation_pipeline_runs",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("automation_pipeline_runs", "deleted_at")
