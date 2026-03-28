"""Add user_id to job_postings for data isolation

Revision ID: 20260328_0000_0004
Revises: 20260327_0001_0003
Create Date: 2026-03-28

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_postings",
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_job_postings_user_id",
        "job_postings",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_job_postings_user_id", "job_postings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_job_postings_user_id", table_name="job_postings")
    op.drop_constraint("fk_job_postings_user_id", "job_postings", type_="foreignkey")
    op.drop_column("job_postings", "user_id")
