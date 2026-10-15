"""enable all games

Revision ID: e2016026ce72
Revises: 2064b76a0b61
Create Date: 2026-10-15 10:49:18.435113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2016026ce72'
down_revision: Union[str, Sequence[str], None] = '2064b76a0b61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SLUGS = ("court-piece", "29", "seep", "call-break", "hokm", "tarneeb", "baloot", "spades", "hearts")


def upgrade() -> None:
    """Every game in the catalog is now playable vs AI."""
    games = sa.table("games", sa.column("slug", sa.String), sa.column("is_available", sa.Boolean))
    op.execute(games.update().where(games.c.slug.in_(SLUGS)).values(is_available=True))


def downgrade() -> None:
    games = sa.table("games", sa.column("slug", sa.String), sa.column("is_available", sa.Boolean))
    op.execute(games.update().where(games.c.slug.in_(SLUGS)).values(is_available=False))
