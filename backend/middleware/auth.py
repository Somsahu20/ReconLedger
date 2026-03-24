from fastapi import Depends, HTTPException
from starlette import status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID   
import jwt
from app.config import settings
from app.database import get_db
from models.users import User
from schemas.auth import TokenData
from jwt import DecodeError, ExpiredSignatureError, InvalidTokenError
from datetime import datetime, timedelta, timezone
import secrets

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN
REFRESH_TOKEN_EXPIRE_MINUTES = settings.REFRESH_TOKEN * 24 * 60
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM


def create_access_token(data: dict, expires_delta: timedelta = None):
    plain_data = data.copy()

    if expires_delta is None:
        expires_delta = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    else:
        expires_delta = datetime.now(timezone.utc) + expires_delta

    plain_data.update({"exp": expires_delta, "type": "access"})
    encoded_jwt = jwt.encode(plain_data, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: timedelta = None) -> tuple[str, datetime]:

    plain_data = data.copy()

    if expires_delta is None:
        expires_delta = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    else:
        expires_delta = datetime.now(timezone.utc) + expires_delta

    plain_data.update({"exp": expires_delta, "type": "refresh", "jti": secrets.token_urlsafe(16)})
    encoded_jwt = jwt.encode(plain_data, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expires_delta


def verify_token(token: str, credential_exception):
    try:

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        payload_name = payload.get("sub")

        if not payload_name:
            raise  HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='No token exists with this id', headers={"WWW-Authenticate": "Bearer"})

        token_data = TokenData(username=payload_name) #? username is the uuid
        return token_data
    except (DecodeError, ExpiredSignatureError, InvalidTokenError):
        raise credential_exception




async def get_current_user(
    token: str = Depends(oauth2),
    db: AsyncSession = Depends(get_db)
) -> User:

    cred_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Credential Details", headers={"WWW-Authenticate": "Bearer"})

    
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"}
            )

        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"}
            )

            
    except (DecodeError,  InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return user