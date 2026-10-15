import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DB, CurrentUser
from app.core.responses import ok
from app.models import GameSession
from app.schemas.common import Envelope
from app.schemas.session import FinishSessionRequest, FinishSessionResponse, SessionCreate, SessionOut, SessionPlayerOut
from app.services import game_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _out(s: GameSession) -> SessionOut:
    return SessionOut(
        id=s.id,
        game_slug=s.game.slug,
        mode=s.mode,
        status=s.status,
        room_code=s.room_code,
        created_at=s.created_at,
        started_at=s.started_at,
        finished_at=s.finished_at,
        players=[SessionPlayerOut.model_validate(p) for p in s.players],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Envelope[SessionOut])
async def create_session(body: SessionCreate, user: CurrentUser, db: DB):
    return ok(_out(await game_service.create_session(db, user, body.game_slug, body.mode, body.settings)))


@router.get("/{session_id}", response_model=Envelope[SessionOut])
async def get_session(session_id: uuid.UUID, user: CurrentUser, db: DB):
    return ok(_out(await game_service.get_owned_session(db, user, session_id)))


@router.post("/{session_id}/join", response_model=Envelope[SessionOut])
async def join_session(session_id: uuid.UUID, user: CurrentUser, db: DB):
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Multiplayer is not available yet")


@router.post("/{session_id}/leave", response_model=Envelope[SessionOut])
async def leave_session(session_id: uuid.UUID, user: CurrentUser, db: DB):
    return ok(_out(await game_service.leave_session(db, user, session_id)))


@router.post("/{session_id}/finish", response_model=Envelope[FinishSessionResponse])
async def finish_session(session_id: uuid.UUID, body: FinishSessionRequest, user: CurrentUser, db: DB):
    return ok(await game_service.finish_session(db, user, session_id, body))
