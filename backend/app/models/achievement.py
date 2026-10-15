import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.types import JsonType, utcnow


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(255))
    requirement: Mapped[dict | None] = mapped_column(JsonType)


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), primary_key=True)
    achievement_id: Mapped[int] = mapped_column(Integer, ForeignKey("achievements.id"), primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
