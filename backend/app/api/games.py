from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import DB
from app.core.responses import ok
from app.models import Game, GameSession
from app.schemas.common import Envelope
from app.schemas.game import GameGlobalStats, GameOut, GameRulesOut
from app.services.game_service import get_game

router = APIRouter(prefix="/games", tags=["games"])

BHABHI_RULES = GameRulesOut(
    slug="bhabhi-thulla",
    core=[
        "You must follow the suit that was led if you can.",
        "If every player follows suit, the trick is discarded and the highest card leads next.",
        "If someone cannot follow suit they play a Thulla: the trick stops and the highest card of the led suit picks up every card.",
        "Aces are high, twos are low.",
        "Players whose hand is empty when a trick finishes escape.",
        "The last player holding cards is the Bhabhi and loses.",
    ],
    variants={
        "pakistan": ["Ace of Spades leads the first trick.", "No Thulla on the first trick: off-suit cards are discarded."],
        "india": ["Ace of Spades leads the first trick.", "Thulla allowed from the first trick."],
        "custom": ["Random first leader.", "Thulla allowed from the first trick."],
    },
)


@router.get("", response_model=Envelope[list[GameOut]])
async def list_games(db: DB):
    games = await db.scalars(select(Game).order_by(Game.is_available.desc(), Game.id))
    return ok([GameOut.model_validate(g) for g in games])


@router.get("/{slug}", response_model=Envelope[GameOut])
async def game_detail(slug: str, db: DB):
    return ok(GameOut.model_validate(await get_game(db, slug)))


@router.get("/{slug}/rules", response_model=Envelope[GameRulesOut])
async def game_rules(slug: str, db: DB):
    game = await get_game(db, slug)
    if game.slug == "bhabhi-thulla":
        return ok(BHABHI_RULES)
    return ok(GameRulesOut(slug=game.slug, core=[], variants={}), "Rules coming soon")


@router.get("/{slug}/statistics", response_model=Envelope[GameGlobalStats])
async def game_statistics(slug: str, db: DB):
    game = await get_game(db, slug)
    total = await db.scalar(select(func.count()).select_from(GameSession).where(GameSession.game_id == game.id)) or 0
    finished = (
        await db.execute(
            select(GameSession.started_at, GameSession.finished_at).where(
                GameSession.game_id == game.id, GameSession.status == "finished"
            )
        )
    ).all()
    durations = [(f - s).total_seconds() for s, f in finished if s and f]
    avg = round(sum(durations) / len(durations), 1) if durations else 0
    return ok(GameGlobalStats(slug=game.slug, games_played=total, games_finished=len(finished), average_duration_seconds=avg))
