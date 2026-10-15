import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.types import JsonType, utcnow


class GameResult(Base):
    __tablename__ = "game_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("game_sessions.id", ondelete="CASCADE"), unique=True)
    winner_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    score: Mapped[dict | None] = mapped_column(JsonType)
    game_data: Mapped[dict | None] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
