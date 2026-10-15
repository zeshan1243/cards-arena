import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.models import RefreshToken, User


async def register(db: AsyncSession, username: str, email: str, password: str) -> User:
    existing = await db.scalar(
        select(User).where(or_(func.lower(User.username) == username.lower(), func.lower(User.email) == email.lower()))
    )
    if existing:
        field = "Username" if existing.username.lower() == username.lower() else "Email"
        raise HTTPException(status.HTTP_409_CONFLICT, f"{field} is already taken")
    user = User(username=username, email=email.lower(), password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, login: str, password: str) -> User:
    user = await db.scalar(
        select(User).where(or_(func.lower(User.username) == login.lower(), func.lower(User.email) == login.lower()))
    )
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    return user


async def issue_tokens(db: AsyncSession, user: User) -> tuple[str, str, datetime]:
    """Return (access token, refresh token, refresh expiry) and persist the refresh token."""
    access, _, _ = create_token(user.id, "access")
    refresh, jti, expires = create_token(user.id, "refresh")
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=expires))
    await db.commit()
    return access, refresh, expires


async def rotate_refresh(db: AsyncSession, token: str | None) -> User:
    """Validate a refresh token and revoke it (the caller issues a new pair)."""
    payload = decode_token(token, "refresh") if token else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    record = await db.get(RefreshToken, payload["jti"])
    if not record or record.revoked_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    record.revoked_at = datetime.now(UTC)
    await db.commit()
    return user


async def revoke_refresh(db: AsyncSession, token: str | None) -> None:
    payload = decode_token(token, "refresh") if token else None
    if not payload:
        return
    record = await db.get(RefreshToken, payload["jti"])
    if record and record.revoked_at is None:
        record.revoked_at = datetime.now(UTC)
        await db.commit()
