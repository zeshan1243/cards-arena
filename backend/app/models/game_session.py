import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.types import JsonType, utcnow


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey("games.id"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    room_code: Mapped[str | None] = mapped_column(String(20), index=True)
    mode: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))
    settings: Mapped[dict | None] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    game = relationship("Game", lazy="joined")
    players = relationship("GamePlayer", back_populates="session", lazy="selectin", order_by="GamePlayer.seat_number")
