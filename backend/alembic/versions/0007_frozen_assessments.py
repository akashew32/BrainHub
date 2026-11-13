"""Freeze assigned questions and make assessment starts idempotent."""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roadmap_assessment_sessions", sa.Column("question_snapshot", sa.JSON(), nullable=True)
    )
    op.add_column(
        "roadmap_assessment_sessions", sa.Column("start_request_id", sa.String(36), nullable=True)
    )
    op.create_index(
        "uq_roadmap_assessment_user_request",
        "roadmap_assessment_sessions",
        ["user_id", "start_request_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_roadmap_assessment_user_request", table_name="roadmap_assessment_sessions")
    op.drop_column("roadmap_assessment_sessions", "start_request_id")
    op.drop_column("roadmap_assessment_sessions", "question_snapshot")
