from app.schemas.common import CamelModel


class GameOut(CamelModel):
    id: int
    name: str
    slug: str
    description: str | None
    min_players: int
    max_players: int
    bot_enabled: bool
    multiplayer_enabled: bool
    is_available: bool


class GameRulesOut(CamelModel):
    slug: str
    variants: dict[str, list[str]]
    core: list[str]


class GameGlobalStats(CamelModel):
    slug: str
    games_played: int
    games_finished: int
    average_duration_seconds: float
