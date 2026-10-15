import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.games import registry
from app.games.base_game import IllegalMoveError
from app.games.bhabhi_thulla.engine import BhabhiThullaEngine, replay_game
from app.games.bhabhi_thulla.rules import create_rules
from app.games.table.base import SeatConfig, SeatOutcome, replay
from app.models import Game, GamePlayer, GameResult, GameSession, User
from app.schemas.session import FinishSessionRequest, FinishSessionResponse
from app.services import statistics_service

logger = logging.getLogger("cardarena.games")


def verifiable(slug: str) -> bool:
    return slug == "bhabhi-thulla" or registry.supported(slug)


async def get_game(db: AsyncSession, slug: str) -> Game:
    game = await db.scalar(select(Game).where(Game.slug == slug))
    if not game:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Game not found")
    return game


async def create_session(db: AsyncSession, user: User, slug: str, mode: str, settings: dict | None) -> GameSession:
    game = await get_game(db, slug)
    if not game.is_available:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{game.name} is not available yet")
    if mode == "multiplayer":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Multiplayer is not available yet")
    now = datetime.now(UTC)
    session = GameSession(game_id=game.id, created_by=user.id, mode=mode, status="playing", settings=settings, started_at=now)
    db.add(session)
    await db.commit()
    logger.info("game_started session=%s game=%s user=%s", session.id, slug, user.id)
    return await get_owned_session(db, user, session.id)


async def get_owned_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> GameSession:
    session = await db.get(GameSession, session_id, populate_existing=True)
    # 404 rather than 403 so session ids can't be probed.
    if not session or session.created_by != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return session


async def leave_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> GameSession:
    session = await get_owned_session(db, user, session_id)
    if session.status in ("waiting", "starting", "playing"):
        session.status = "cancelled"
        session.finished_at = datetime.now(UTC)
        await db.commit()
        logger.info("game_abandoned session=%s user=%s", session.id, user.id)
    return session


def _check_seats(req: FinishSessionRequest) -> None:
    ids = [s.id for s in req.seats]
    if len(set(ids)) != len(ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate seat ids")
    humans = [s for s in req.seats if not s.is_bot]
    if len(humans) != 1 or humans[0].id != req.self_seat_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "AI games must have exactly one human seat: yours")


def _verify_bhabhi(req: FinishSessionRequest) -> BhabhiThullaEngine:
    try:
        rules = create_rules(req.variant, len(req.seats))
        return replay_game(
            [(s.id, s.name, s.is_bot) for s in req.seats],
            req.seed,
            rules,
            [(m.player_id, m.card_id) for m in req.moves],
        )
    except (IllegalMoveError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Game could not be verified: {exc}") from exc


def _bhabhi_outcome(req: FinishSessionRequest) -> list[SeatOutcome]:
    """Replay Bhabhi Thulla and express the result in the shared outcome format."""
    if req.variant is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "variant is required")
    engine = _verify_bhabhi(req)
    scores = engine.calculate_score()
    out = []
    for s in req.seats:
        p = engine._player(s.id)
        if s.id == engine.bhabhi_id:
            result = "loss"
        elif engine.get_winner() == s.id:
            result = "win"
        else:
            result = "safe"
        out.append(SeatOutcome(s.id, p.finish_position or len(req.seats), result, scores[s.id]))
    return out


def _table_outcome(slug: str, req: FinishSessionRequest) -> list[SeatOutcome]:
    seats = [SeatConfig(s.id, s.name, s.is_bot) for s in req.seats]
    try:
        engine = registry.create_engine(slug, seats, req.seed, req.settings)
        replay(engine, [(a.player_id, a.action) for a in req.actions])
    except (IllegalMoveError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Game could not be verified: {exc}") from exc
    return engine.outcome()


async def finish_session(
    db: AsyncSession, user: User, session_id: uuid.UUID, req: FinishSessionRequest
) -> FinishSessionResponse:
    """Replay the submitted game server-side, then record results, stats, XP and achievements."""
    session = await get_owned_session(db, user, session_id)
    if session.status != "playing":
        raise HTTPException(status.HTTP_409_CONFLICT, "Session is already finished")
    game: Game = session.game
    if not verifiable(game.slug):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This game cannot be recorded yet")

    _check_seats(req)
    outcomes = _bhabhi_outcome(req) if game.slug == "bhabhi-thulla" else _table_outcome(game.slug, req)
    by_id = {o.id: o for o in outcomes}
    names = {s.id: s.name for s in req.seats}

    for seat_no, seat in enumerate(req.seats):
        o = by_id[seat.id]
        db.add(
            GamePlayer(
                session_id=session.id,
                user_id=None if seat.is_bot else user.id,
                seat_number=seat_no,
                is_bot=seat.is_bot,
                bot_name=seat.name if seat.is_bot else None,
                score=o.score,
                position=o.position,
                result=o.result,
            )
        )

    now = datetime.now(UTC)
    started = session.started_at or now
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    duration = max(0, int((now - started).total_seconds()))
    session.status = "finished"
    session.finished_at = now

    me = by_id[req.self_seat_id]
    db.add(
        GameResult(
            session_id=session.id,
            winner_id=user.id if me.result == "win" else None,
            score={names[o.id]: o.score for o in outcomes},
            game_data={
                "seed": req.seed,
                "variant": req.variant,
                "settings": req.settings,
                "seats": [s.model_dump() for s in req.seats],
                "winners": [names[o.id] for o in outcomes if o.result == "win"],
                # Replay data (spec §82): the full action sequence.
                "replay": [{"player": m.player_id, "action": "play_card", "card": m.card_id} for m in req.moves]
                or [{"player": a.player_id, **a.action} for a in req.actions],
            },
        )
    )

    award = await statistics_service.record_game(
        db, user=user, game=game, session=session, result=me.result, score=me.score, duration_seconds=duration
    )
    await db.commit()
    logger.info("game_finished session=%s user=%s result=%s xp=%s", session.id, user.id, me.result, award.xp_awarded)

    return FinishSessionResponse(
        result=me.result,
        position=me.position,
        score=me.score,
        xp_awarded=award.xp_awarded,
        new_xp=user.xp,
        level=user.level,
        leveled_up=award.leveled_up,
        achievements_unlocked=award.achievements,
    )
