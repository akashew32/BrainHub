"""Track revealed hints and distinguish independent assessment evidence."""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing sessions remain NULL: earlier releases exposed all practice
    # hints, so absence of recorded requests cannot prove independent work.
    op.add_column("roadmap_assessment_sessions", sa.Column("hint_usage", sa.JSON(), nullable=True))
    op.add_column(
        "roadmap_assessment_sessions",
        sa.Column("hint_revision", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("roadmap_question_attempts", sa.Column("hints_used", sa.Integer(), nullable=True))
    op.add_column(
        "roadmap_topic_progress", sa.Column("independent_score", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("roadmap_topic_progress", "independent_score")
    op.drop_column("roadmap_question_attempts", "hints_used")
    op.drop_column("roadmap_assessment_sessions", "hint_revision")
    op.drop_column("roadmap_assessment_sessions", "hint_usage")
