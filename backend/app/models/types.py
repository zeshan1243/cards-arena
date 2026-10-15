from datetime import UTC, datetime

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

# JSONB on PostgreSQL, plain JSON elsewhere (e.g. SQLite in tests).
JsonType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(UTC)
