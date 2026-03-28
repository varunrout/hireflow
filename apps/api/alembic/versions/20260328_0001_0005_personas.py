"""Add personas table and persona_id to resume_versions.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-28
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create personas table
    op.create_table(
        "personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("target_roles", postgresql.ARRAY(sa.String(200)), nullable=True, server_default="{}"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_personas_user_id", "personas", ["user_id"])

    # Add persona_id to resume_versions
    op.add_column(
        "resume_versions",
        sa.Column(
            "persona_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("personas.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_resume_versions_persona_id", "resume_versions", ["persona_id"])


def downgrade() -> None:
    op.drop_index("ix_resume_versions_persona_id", table_name="resume_versions")
    op.drop_column("resume_versions", "persona_id")
    op.drop_index("ix_personas_user_id", table_name="personas")
    op.drop_table("personas")
