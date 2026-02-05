from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime
    is_admin: bool = False
    role: str | None = None

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    user: UserOut
