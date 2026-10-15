import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User

bearer = HTTPBearer(auto_error=False)

DB = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    payload = decode_token(creds.credentials, "access") if creds else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
