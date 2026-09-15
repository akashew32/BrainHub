"""Initial BrainHub schema."""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("is_timed", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "game_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_slug", sa.String(80), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_slug", sa.String(80), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("won", sa.Boolean(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "user_game_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_slug", sa.String(80), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("best_score", sa.Float(), nullable=False),
        sa.Column("average_score", sa.Float(), nullable=False),
        sa.Column("total_duration_ms", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "game_slug"),
    )
    op.create_table(
        "fermi_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("prompt", sa.String(300), nullable=False, unique=True),
        sa.Column("reference", sa.Float(), nullable=False),
        sa.Column("lower_bound", sa.Float(), nullable=False),
        sa.Column("upper_bound", sa.Float(), nullable=False),
        sa.Column("reasoning", sa.String(600), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
    )
    op.create_index("ix_game_sessions_game_slug", "game_sessions", ["game_slug"])
    op.create_index("ix_attempts_user_id", "attempts", ["user_id"])
    op.create_index("ix_attempts_game_slug", "attempts", ["game_slug"])
    op.create_index("ix_attempts_created_at", "attempts", ["created_at"])
    op.create_index("ix_fermi_questions_category", "fermi_questions", ["category"])


def downgrade() -> None:
    for table in (
        "fermi_questions",
        "user_game_stats",
        "attempts",
        "game_sessions",
        "games",
        "users",
    ):
        op.drop_table(table)
