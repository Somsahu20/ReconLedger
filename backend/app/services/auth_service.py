import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from pwdlib import PasswordHash
from app.config import settings
from models.users import User
from models.token_blacklist import TokenBlacklist
from schemas.auth import UserRegister, UserLogin
from fastapi import HTTPException
from starlette import status
from datetime import datetime   
import jwt


password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)

def hash_token(token: str) -> str:
    #! We are encoding tokens because we can send only raw_bytes to sha256. And converting the raw bytes to string using hexdigest
    return hashlib.sha256(token.encode()).hexdigest()

async def is_token_blacklisted(
    db: AsyncSession,
    token: str
) -> bool:
    #! If token exists in the backlist table, then it means it is blacklisted
    token_hash = hash_token(token)
    
    result = await db.execute(
        select(TokenBlacklist).where(
            TokenBlacklist.token_hash == token_hash
        )
    )
    return result.scalar_one_or_none() is not None

async def blacklist_token(
    db: AsyncSession,
    token: str,
    user_id: UUID,
    expires_at: datetime,
    reason: str              
) -> None:
    token_hash = hash_token(token)

    existing = await db.execute(
        select(TokenBlacklist).where(TokenBlacklist.token_hash == token_hash)
    )
    if existing.scalar_one_or_none() is not None:
        return

    blacklisted = TokenBlacklist(
        token_hash=token_hash,
        user_id=user_id,
        reason=reason,
        expires_at=expires_at
    )
    db.add(blacklisted)
    await db.flush()

def verify_refresh_token_jwt(token: str) -> dict | None:
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except jwt.exceptions.ExpiredSignatureError:
        return None
    except jwt.exceptions.PyJWTError:
        return None

#todo Register a new user
async def register_user(db: AsyncSession, user_data: UserRegister) -> User:
    #! Check if email exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise ValueError("Email already registered")
    
    # Create new user
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
    )
    
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    
    return new_user

async def authenticate_user(db: AsyncSession, credentials: UserLogin) -> User:
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise ValueError("Invalid email or password")
    
    if not user.is_active:
        raise ValueError("User account is disabled")
    
    return user

async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()

#todo: Only the name will change
async def update_user_profile(db: AsyncSession, user: User, full_name: str) -> User:
    user.full_name = full_name
    await db.commit()
    await db.refresh(user)
    return user

async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> bool:
    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Current password is incorrect")
    
    user.hashed_password = hash_password(new_password)
    await db.commit()
    return True