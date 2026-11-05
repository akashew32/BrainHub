"""Persist interactive roadmap lesson progress."""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roadmap_topic_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("roadmap_slug", sa.String(80), nullable=False),
        sa.Column("topic_slug", sa.String(160), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("quiz_score", sa.Integer(), nullable=False),
        sa.Column("quiz_attempts", sa.Integer(), nullable=False),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=False),
        sa.Column("last_viewed_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "roadmap_slug", "topic_slug"),
    )
    op.create_index("ix_roadmap_topic_progress_user_id", "roadmap_topic_progress", ["user_id"])
    op.create_index(
        "ix_roadmap_topic_progress_roadmap_slug",
        "roadmap_topic_progress",
        ["roadmap_slug"],
    )
    op.create_index(
        "ix_roadmap_topic_progress_last_viewed_at",
        "roadmap_topic_progress",
        ["last_viewed_at"],
    )


def downgrade() -> None:
    op.drop_table("roadmap_topic_progress")
