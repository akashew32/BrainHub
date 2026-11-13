"""Add owned revisioned topic bookmarks, retaining removal tombstones."""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roadmap_bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("roadmap_slug", sa.String(80), nullable=False),
        sa.Column("topic_slug", sa.String(160), nullable=False),
        sa.Column("bookmarked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id", "roadmap_slug", "topic_slug", name="uq_roadmap_bookmark_owner_topic"
        ),
    )
    op.create_index("ix_roadmap_bookmarks_user_id", "roadmap_bookmarks", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_roadmap_bookmarks_user_id", table_name="roadmap_bookmarks")
    op.drop_table("roadmap_bookmarks")
