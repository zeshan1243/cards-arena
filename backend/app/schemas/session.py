import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import CamelModel


class SessionCreate(CamelModel):
    game_slug: str
    mode: Literal["ai", "multiplayer"] = "ai"
    settings: dict | None = None


class SessionPlayerOut(CamelModel):
    seat_number: int
    is_bot: bool
    bot_name: str | None
    user_id: uuid.UUID | None
    score: int
    position: int | None
    result: str | None


class SessionOut(CamelModel):
    id: uuid.UUID
    game_slug: str
    mode: str
    status: str
    room_code: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    players: list[SessionPlayerOut] = []


class SeatIn(CamelModel):
    id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    is_bot: bool


class MoveIn(CamelModel):
    player_id: str = Field(max_length=50)
    card_id: str = Field(max_length=20)


class ActionIn(CamelModel):
    player_id: str = Field(max_length=50)
    action: dict[str, Any]


class FinishSessionRequest(CamelModel):
    """The client submits what it *did*, not who won. The server replays the
    game from the seed and action list to determine the result (spec §54).

    Bhabhi Thulla uses `variant` + `moves`; all other games use `settings` + `actions`."""

    seed: int = Field(ge=0, le=2**32 - 1)
    seats: list[SeatIn] = Field(min_length=2, max_length=6)
    self_seat_id: str
    variant: Literal["pakistan", "india", "custom"] | None = None
    moves: list[MoveIn] = Field(default_factory=list, max_length=2000)
    settings: dict[str, int | str] = Field(default_factory=dict)
    actions: list[ActionIn] = Field(default_factory=list, max_length=5000)


class AchievementOut(CamelModel):
    code: str
    name: str
    description: str | None
    icon: str | None
    unlocked_at: datetime | None = None


class FinishSessionResponse(CamelModel):
    result: str
    position: int | None
    score: int
    xp_awarded: int
    new_xp: int
    level: int
    leveled_up: bool
    achievements_unlocked: list[AchievementOut]
