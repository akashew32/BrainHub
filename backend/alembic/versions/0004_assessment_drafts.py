"""Persist partial assessment answers for refresh and device recovery."""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roadmap_assessment_sessions",
        sa.Column("draft", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("roadmap_assessment_sessions", "draft")
