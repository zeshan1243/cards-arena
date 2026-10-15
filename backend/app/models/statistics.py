import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.types import utcnow


class PlayerStatistics(Base):
    __tablename__ = "player_statistics"
    __table_args__ = (UniqueConstraint("user_id", "game_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey("games.id"), index=True)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    games_won: Mapped[int] = mapped_column(Integer, default=0)
    games_lost: Mapped[int] = mapped_column(Integer, default=0)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    best_score: Mapped[int] = mapped_column(Integer, default=0)
    current_win_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_win_streak: Mapped[int] = mapped_column(Integer, default=0)
    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class XpEvent(Base):
    """Ledger of XP awards; powers daily/weekly/monthly leaderboards."""

    __tablename__ = "xp_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(50))
    session_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("game_sessions.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
