import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import get_settings

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_token(user_id: uuid.UUID, token_type: TokenType) -> tuple[str, str, datetime]:
    """Return (encoded token, jti, expiry)."""
    s = get_settings()
    now = datetime.now(UTC)
    expires = now + (
        timedelta(minutes=s.access_token_expire_minutes)
        if token_type == "access"
        else timedelta(days=s.refresh_token_expire_days)
    )
    jti = uuid.uuid4().hex
    payload = {"sub": str(user_id), "type": token_type, "jti": jti, "iat": now, "exp": expires}
    return jwt.encode(payload, s.jwt_secret_key, algorithm=s.jwt_algorithm), jti, expires


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any] | None:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret_key, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload
