"""Persist server-graded mathematics assessments and individual answers."""

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roadmap_topic_progress",
        sa.Column("mastery_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "roadmap_assessment_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("roadmap_slug", sa.String(80), nullable=False),
        sa.Column("topic_slug", sa.String(160), nullable=True),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("question_ids", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_roadmap_assessment_sessions_user_id", "roadmap_assessment_sessions", ["user_id"]
    )
    op.create_table(
        "roadmap_question_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("roadmap_assessment_sessions.id"),
            nullable=False,
        ),
        sa.Column("roadmap_slug", sa.String(80), nullable=False),
        sa.Column("topic_slug", sa.String(160), nullable=False),
        sa.Column("question_id", sa.String(220), nullable=False),
        sa.Column("concept", sa.String(160), nullable=False),
        sa.Column("answer", sa.JSON(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("session_id", "question_id"),
    )
    for name in ("user_id", "roadmap_slug", "question_id", "created_at"):
        op.create_index(f"ix_roadmap_question_attempts_{name}", "roadmap_question_attempts", [name])


def downgrade() -> None:
    op.drop_table("roadmap_question_attempts")
    op.drop_table("roadmap_assessment_sessions")
    op.drop_column("roadmap_topic_progress", "mastery_version")
