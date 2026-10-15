from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentUser
from app.core.responses import ok
from app.schemas.common import Envelope
from app.schemas.statistics import HistoryEntry, LeaderboardEntry, UserStatisticsOut
from app.services import statistics_service

router = APIRouter(tags=["statistics"])


@router.get("/statistics/me", response_model=Envelope[UserStatisticsOut])
async def my_statistics(user: CurrentUser, db: DB):
    return ok(await statistics_service.user_statistics(db, user))


@router.get("/statistics/me/history", response_model=Envelope[list[HistoryEntry]])
async def my_history(user: CurrentUser, db: DB, limit: Annotated[int, Query(ge=1, le=100)] = 25):
    return ok(await statistics_service.history(db, user, limit))


@router.get("/leaderboard", response_model=Envelope[list[LeaderboardEntry]])
async def leaderboard(
    db: DB,
    period: Literal["daily", "weekly", "monthly", "all"] = "all",
    game: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    return ok(await statistics_service.leaderboard(db, period, game, limit))
