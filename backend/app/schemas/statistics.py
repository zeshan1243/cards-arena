import uuid
from datetime import datetime

from app.schemas.common import CamelModel
from app.schemas.session import AchievementOut
from app.schemas.user import UserOut


class GameStatisticsOut(CamelModel):
    game_slug: str
    game_name: str
    games_played: int
    games_won: int
    games_lost: int
    total_score: int
    win_rate: float
    best_score: int
    longest_win_streak: int
    current_win_streak: int
    average_duration_seconds: float


class Totals(CamelModel):
    games_played: int
    games_won: int
    games_lost: int
    win_rate: float


class UserStatisticsOut(CamelModel):
    user: UserOut
    totals: Totals
    games: list[GameStatisticsOut]
    achievements: list[AchievementOut]


class HistoryPlayer(CamelModel):
    name: str
    is_bot: bool
    position: int | None
    result: str | None


class HistoryEntry(CamelModel):
    session_id: uuid.UUID
    game_slug: str
    game_name: str
    mode: str
    result: str | None
    score: int
    position: int | None
    players: list[HistoryPlayer]
    duration_seconds: int | None
    finished_at: datetime


class LeaderboardEntry(CamelModel):
    rank: int
    username: str
    avatar_url: str | None
    level: int
    xp: int
    games_won: int
