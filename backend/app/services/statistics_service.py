import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from math import isqrt

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Achievement, Game, GamePlayer, GameSession, PlayerStatistics, User, UserAchievement, XpEvent
from app.schemas.session import AchievementOut
from app.schemas.statistics import (
    GameStatisticsOut,
    HistoryEntry,
    HistoryPlayer,
    LeaderboardEntry,
    Totals,
    UserStatisticsOut,
)
from app.schemas.user import UserOut

# XP rewards (spec §84).
XP_GAME_PLAYED = 10
XP_GAME_WON = 30
XP_WIN_STREAK = 20
XP_ACHIEVEMENT = 100


def level_for_xp(xp: int) -> int:
    """Level n starts at 100·(n−1)² XP. Must match the frontend `xpForLevel`."""
    return isqrt(max(xp, 0) // 100) + 1


@dataclass
class XpAward:
    xp_awarded: int = 0
    leveled_up: bool = False
    achievements: list[AchievementOut] = field(default_factory=list)


async def _stats_row(db: AsyncSession, user_id: uuid.UUID, game_id: int) -> PlayerStatistics:
    row = await db.scalar(
        select(PlayerStatistics).where(PlayerStatistics.user_id == user_id, PlayerStatistics.game_id == game_id)
    )
    if not row:
        row = PlayerStatistics(
            user_id=user_id, game_id=game_id, games_played=0, games_won=0, games_lost=0, total_score=0,
            win_rate=Decimal("0"), best_score=0, current_win_streak=0, longest_win_streak=0, total_duration_seconds=0,
        )
        db.add(row)
    return row


async def record_game(
    db: AsyncSession, *, user: User, game: Game, session: GameSession, result: str, score: int, duration_seconds: int
) -> XpAward:
    """Update statistics, award XP and unlock achievements for one finished game (spec §137)."""
    stats = await _stats_row(db, user.id, game.id)
    stats.games_played += 1
    stats.total_score += score
    stats.total_duration_seconds += duration_seconds
    stats.best_score = max(stats.best_score, score) if stats.games_played > 1 else score
    if result == "win":
        stats.games_won += 1
        stats.current_win_streak += 1
        stats.longest_win_streak = max(stats.longest_win_streak, stats.current_win_streak)
    else:
        stats.current_win_streak = 0
        if result == "loss":
            stats.games_lost += 1
    stats.win_rate = Decimal(round(stats.games_won * 100 / stats.games_played, 2))
    await db.flush()

    award = XpAward()
    events: list[tuple[int, str]] = [(XP_GAME_PLAYED, "game_played")]
    if result == "win":
        events.append((XP_GAME_WON, "game_won"))
        if stats.current_win_streak >= 2:
            events.append((XP_WIN_STREAK, "win_streak"))

    for ach in await _newly_unlocked(db, user, session, stats):
        db.add(UserAchievement(user_id=user.id, achievement_id=ach.id))
        events.append((XP_ACHIEVEMENT, f"achievement:{ach.code}"))
        award.achievements.append(AchievementOut.model_validate(ach))

    old_level = user.level
    for amount, reason in events:
        db.add(XpEvent(user_id=user.id, amount=amount, reason=reason, session_id=session.id))
        award.xp_awarded += amount
    user.xp += award.xp_awarded
    user.level = level_for_xp(user.xp)
    award.leveled_up = user.level > old_level
    return award


async def _newly_unlocked(
    db: AsyncSession, user: User, session: GameSession, current: PlayerStatistics
) -> list[Achievement]:
    unlocked_ids = set(await db.scalars(select(UserAchievement.achievement_id).where(UserAchievement.user_id == user.id)))
    candidates = [a for a in await db.scalars(select(Achievement)) if a.id not in unlocked_ids]
    if not candidates:
        return []

    rows = (
        await db.execute(
            select(PlayerStatistics, Game).join(Game, Game.id == PlayerStatistics.game_id).where(PlayerStatistics.user_id == user.id)
        )
    ).all()
    played = sum(s.games_played for s, _ in rows)
    won = sum(s.games_won for s, _ in rows)
    won_by_slug = {g.slug: s.games_won for s, g in rows}
    regional_won = sum(1 for s, g in rows if g.is_regional and s.games_won > 0)
    multiplayer_played = await db.scalar(
        select(func.count())
        .select_from(GamePlayer)
        .join(GameSession, GameSession.id == GamePlayer.session_id)
        .where(GamePlayer.user_id == user.id, GameSession.mode == "multiplayer", GameSession.status == "finished")
    ) or 0

    def met(req: dict) -> bool:
        kind, count = req.get("type"), req.get("count", 1)
        return {
            "games_played": played >= count,
            "games_won": won >= count,
            "win_streak": current.current_win_streak >= count,
            "game_won": won_by_slug.get(req.get("game", ""), 0) >= count,
            "regional_games_won": regional_won >= count,
            "multiplayer_played": multiplayer_played >= count,
        }.get(kind, False)

    return [a for a in candidates if a.requirement and met(a.requirement)]


async def achievements_for(db: AsyncSession, user_id: uuid.UUID) -> list[AchievementOut]:
    unlocked = dict(
        (await db.execute(select(UserAchievement.achievement_id, UserAchievement.unlocked_at).where(UserAchievement.user_id == user_id))).all()
    )
    return [
        AchievementOut(code=a.code, name=a.name, description=a.description, icon=a.icon, unlocked_at=unlocked.get(a.id))
        for a in await db.scalars(select(Achievement).order_by(Achievement.id))
    ]


async def user_statistics(db: AsyncSession, user: User, *, public: bool = False) -> UserStatisticsOut:
    rows = (
        await db.execute(
            select(PlayerStatistics, Game).join(Game, Game.id == PlayerStatistics.game_id).where(PlayerStatistics.user_id == user.id)
        )
    ).all()
    games = [
        GameStatisticsOut(
            game_slug=g.slug,
            game_name=g.name,
            games_played=s.games_played,
            games_won=s.games_won,
            games_lost=s.games_lost,
            total_score=s.total_score,
            win_rate=float(s.win_rate),
            best_score=s.best_score,
            longest_win_streak=s.longest_win_streak,
            current_win_streak=s.current_win_streak,
            average_duration_seconds=round(s.total_duration_seconds / s.games_played, 1) if s.games_played else 0,
        )
        for s, g in rows
    ]
    played = sum(g.games_played for g in games)
    won = sum(g.games_won for g in games)
    user_out = UserOut.model_validate(user)
    if public:
        user_out.email = None
    return UserStatisticsOut(
        user=user_out,
        totals=Totals(
            games_played=played,
            games_won=won,
            games_lost=sum(g.games_lost for g in games),
            win_rate=round(won * 100 / played, 2) if played else 0,
        ),
        games=games,
        achievements=await achievements_for(db, user.id),
    )


def _player_name(p: GamePlayer, viewer: User) -> str:
    if p.is_bot:
        return p.bot_name or "Bot"
    return viewer.username if p.user_id == viewer.id else "Player"


async def history(db: AsyncSession, user: User, limit: int) -> list[HistoryEntry]:
    sessions = (
        await db.scalars(
            select(GameSession)
            .join(GamePlayer, GamePlayer.session_id == GameSession.id)
            .where(GamePlayer.user_id == user.id, GameSession.status == "finished")
            .order_by(GameSession.finished_at.desc())
            .limit(limit)
        )
    ).unique().all()
    entries = []
    for s in sessions:
        me = next(p for p in s.players if p.user_id == user.id)
        duration = int((s.finished_at - s.started_at).total_seconds()) if s.finished_at and s.started_at else None
        entries.append(
            HistoryEntry(
                session_id=s.id,
                game_slug=s.game.slug,
                game_name=s.game.name,
                mode=s.mode,
                result=me.result,
                score=me.score,
                position=me.position,
                players=[
                    HistoryPlayer(name=_player_name(p, user), is_bot=p.is_bot, position=p.position, result=p.result)
                    for p in s.players
                ],
                duration_seconds=duration,
                finished_at=s.finished_at,
            )
        )
    return entries


PERIODS = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}


async def leaderboard(db: AsyncSession, period: str, game_slug: str | None, limit: int = 50) -> list[LeaderboardEntry]:
    wins = (
        select(PlayerStatistics.user_id, func.sum(PlayerStatistics.games_won).label("won"))
        .group_by(PlayerStatistics.user_id)
        .subquery()
    )
    if game_slug:
        game = await db.scalar(select(Game).where(Game.slug == game_slug))
        if not game:
            return []
        query = (
            select(User, PlayerStatistics.games_won, User.xp)
            .join(PlayerStatistics, PlayerStatistics.user_id == User.id)
            .where(PlayerStatistics.game_id == game.id, PlayerStatistics.games_played > 0)
            .order_by(PlayerStatistics.games_won.desc(), User.xp.desc())
        )
    elif period in PERIODS:
        since = datetime.now(UTC) - PERIODS[period]
        earned = func.sum(XpEvent.amount).label("earned")
        query = (
            select(User, func.coalesce(func.max(wins.c.won), 0), earned)
            .join(XpEvent, XpEvent.user_id == User.id)
            .outerjoin(wins, wins.c.user_id == User.id)
            .where(XpEvent.created_at >= since)
            .group_by(User.id)
            .order_by(earned.desc())
        )
    else:
        query = (
            select(User, func.coalesce(wins.c.won, 0), User.xp)
            .outerjoin(wins, wins.c.user_id == User.id)
            .where(User.xp > 0)
            .order_by(User.xp.desc(), User.created_at)
        )
    rows = (await db.execute(query.limit(limit))).all()
    return [
        LeaderboardEntry(rank=i + 1, username=u.username, avatar_url=u.avatar_url, level=u.level, xp=int(xp or 0), games_won=int(won or 0))
        for i, (u, won, xp) in enumerate(rows)
    ]
