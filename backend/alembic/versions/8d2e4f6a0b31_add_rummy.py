"""add Rummy

Revision ID: 8d2e4f6a0b31
Revises: 7c1d3e5f9a20
Create Date: 2026-10-27 12:00:00.000000

"""
from datetime import UTC, datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d2e4f6a0b31'
down_revision: Union[str, Sequence[str], None] = '7c1d3e5f9a20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GAMES = sa.table(
    "games",
    sa.column("name", sa.String), sa.column("slug", sa.String), sa.column("description", sa.Text),
    sa.column("min_players", sa.Integer), sa.column("max_players", sa.Integer),
    sa.column("bot_enabled", sa.Boolean), sa.column("multiplayer_enabled", sa.Boolean),
    sa.column("is_available", sa.Boolean), sa.column("is_regional", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    """Databases created before Rummy existed; fresh ones get it from the initial seed."""
    exists = op.get_bind().execute(sa.select(GAMES.c.slug).where(GAMES.c.slug == "rummy")).first()
    if exists:
        return
    from app.core.seed import GAMES as SEED

    row = next(g for g in SEED if g["slug"] == "rummy")
    op.bulk_insert(GAMES, [{**row, "created_at": datetime.now(UTC)}])


def downgrade() -> None:
    op.execute(GAMES.delete().where(GAMES.c.slug == "rummy"))
