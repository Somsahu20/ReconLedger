from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    created_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True
    )


class TokenData(BaseModel):
    username: str | None = None

class Token(BaseModel):
    access_token: str
    # refresh_token: str
    token_type: str
    user: UserResponse
