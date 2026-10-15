from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.types import utcnow


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    min_players: Mapped[int] = mapped_column(Integer)
    max_players: Mapped[int] = mapped_column(Integer)
    bot_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    multiplayer_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)
    is_regional: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
