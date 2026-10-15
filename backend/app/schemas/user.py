import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class UserOut(CamelModel):
    id: uuid.UUID
    username: str
    email: str | None = None
    avatar_url: str | None = None
    xp: int
    level: int
    created_at: datetime


class UserUpdate(CamelModel):
    avatar_url: str | None = Field(default=None, max_length=500)
    email: EmailStr | None = None


class UserSearchHit(CamelModel):
    username: str
    level: int
    avatar_url: str | None = None
