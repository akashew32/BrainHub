"""Store user-owned question reflections with optimistic revision control."""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roadmap_question_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("roadmap_slug", sa.String(80), nullable=False),
        sa.Column("question_id", sa.String(220), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "roadmap_slug", "question_id"),
    )
    op.create_index("ix_roadmap_question_notes_user_id", "roadmap_question_notes", ["user_id"])


def downgrade() -> None:
    op.drop_table("roadmap_question_notes")
