from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegister(BaseModel):
    model_config = ConfigDict(regex_engine="python-re")

    email: EmailStr
    full_name: str
    password: str = Field(pattern=r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#&?])[A-Za-z\d@$!%*#&?]{8,}$")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordChange(BaseModel):
    model_config = ConfigDict(regex_engine="python-re")

    current_password: str 
    new_password: str = Field(pattern=r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#&?])[A-Za-z\d@$!%*#&?]{8,}$")
    confirm_password: str 

    @model_validator(mode='after')
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

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
