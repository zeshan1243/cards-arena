from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.core.responses import ok
from app.models import User
from app.schemas.common import Envelope
from app.schemas.statistics import UserStatisticsOut
from app.schemas.user import UserOut, UserSearchHit, UserUpdate
from app.services import statistics_service

router = APIRouter(prefix="/users", tags=["users"])


async def _by_username(db: DB, username: str) -> User:
    user = await db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player not found")
    return user


@router.get("/me", response_model=Envelope[UserOut])
async def get_me(user: CurrentUser):
    return ok(UserOut.model_validate(user))


@router.put("/me", response_model=Envelope[UserOut])
async def update_me(body: UserUpdate, user: CurrentUser, db: DB):
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        taken = await db.scalar(select(User).where(func.lower(User.email) == data["email"].lower(), User.id != user.id))
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is already taken")
        user.email = data["email"].lower()
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]
    await db.commit()
    await db.refresh(user)
    return ok(UserOut.model_validate(user))


@router.get("/search", response_model=Envelope[list[UserSearchHit]])
async def search(db: DB, q: Annotated[str, Query(min_length=2, max_length=50)]):
    pattern = q.lower().replace("%", r"\%").replace("_", r"\_") + "%"
    users = await db.scalars(
        select(User).where(func.lower(User.username).like(pattern, escape="\\")).order_by(User.xp.desc()).limit(8)
    )
    return ok([UserSearchHit.model_validate(u) for u in users])


@router.get("/{username}", response_model=Envelope[UserOut])
async def get_user(username: str, db: DB):
    out = UserOut.model_validate(await _by_username(db, username))
    out.email = None
    return ok(out)


@router.get("/{username}/statistics", response_model=Envelope[UserStatisticsOut])
async def get_user_statistics(username: str, db: DB):
    user = await _by_username(db, username)
    return ok(await statistics_service.user_statistics(db, user, public=True))
