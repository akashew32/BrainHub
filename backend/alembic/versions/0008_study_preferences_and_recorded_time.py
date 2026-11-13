"""Add study preferences and immutable submitted visible-time evidence."""

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "study_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("goal_minutes", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("session_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("preferred_roadmap_slug", sa.String(80), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.add_column(
        "roadmap_assessment_sessions", sa.Column("recorded_intervals", sa.JSON(), nullable=True)
    )
    op.add_column(
        "roadmap_assessment_sessions", sa.Column("recorded_seconds", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("roadmap_assessment_sessions", "recorded_seconds")
    op.drop_column("roadmap_assessment_sessions", "recorded_intervals")
    op.drop_table("study_preferences")
