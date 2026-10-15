import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.types import utcnow


class GamePlayer(Base):
    __tablename__ = "game_players"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("game_sessions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    seat_number: Mapped[int] = mapped_column(Integer)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    bot_name: Mapped[str | None] = mapped_column(String(100))
    score: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int | None] = mapped_column(Integer)
    result: Mapped[str | None] = mapped_column(String(20))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session = relationship("GameSession", back_populates="players")
