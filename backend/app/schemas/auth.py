from pydantic import EmailStr, Field

from app.schemas.common import CamelModel
from app.schemas.user import UserOut


class RegisterRequest(CamelModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(CamelModel):
    login: str = Field(min_length=1, max_length=255, description="Username or email")
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
