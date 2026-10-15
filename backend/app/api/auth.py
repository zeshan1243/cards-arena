from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.core.responses import ok
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.schemas.common import Envelope
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "cardarena_refresh"
login_limiter = RateLimiter(times=10, seconds=60)
register_limiter = RateLimiter(times=5, seconds=60)


def _set_refresh_cookie(response: Response, token: str, expires: datetime) -> None:
    s = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        expires=expires,
        httponly=True,
        secure=s.is_production,
        samesite="lax",
        path=f"{s.api_prefix}/auth",
    )


async def _auth_response(db: DB, response: Response, user) -> Envelope[AuthResponse]:
    access, refresh, expires = await auth_service.issue_tokens(db, user)
    _set_refresh_cookie(response, refresh, expires)
    return ok(AuthResponse(access_token=access, user=UserOut.model_validate(user)))


@router.post(
    "/register", status_code=status.HTTP_201_CREATED, response_model=Envelope[AuthResponse], dependencies=[Depends(register_limiter)]
)
async def register(body: RegisterRequest, db: DB, response: Response):
    user = await auth_service.register(db, body.username, body.email, body.password)
    return await _auth_response(db, response, user)


@router.post("/login", response_model=Envelope[AuthResponse], dependencies=[Depends(login_limiter)])
async def login(body: LoginRequest, db: DB, response: Response):
    user = await auth_service.authenticate(db, body.login, body.password)
    return await _auth_response(db, response, user)


@router.post("/refresh", response_model=Envelope[AuthResponse])
async def refresh(db: DB, response: Response, token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None):
    user = await auth_service.rotate_refresh(db, token)
    return await _auth_response(db, response, user)


@router.post("/logout", response_model=Envelope[None])
async def logout(db: DB, response: Response, token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None):
    await auth_service.revoke_refresh(db, token)
    response.delete_cookie(REFRESH_COOKIE, path=f"{get_settings().api_prefix}/auth")
    return ok(None, "Logged out")


@router.get("/me", response_model=Envelope[UserOut])
async def me(user: CurrentUser):
    return ok(UserOut.model_validate(user))
