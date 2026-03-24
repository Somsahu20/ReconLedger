from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.database import get_db
from middleware.auth import get_current_user, create_access_token, create_refresh_token
from models.users import User
from schemas.auth import (
    UserRegister, UserLogin, UserResponse, 
    Token, UserUpdate, PasswordChange
)
from app.services import auth_service
from utils.log import logger
from utils.lim import limiter
import uuid
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=False,
        samesite='lax',
        max_age=settings.REFRESH_TOKEN * 24 * 60 * 60, #!stored in days
        path="/auth/refresh",
    )

def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=False,
        samesite='lax',
        path="/auth/refresh",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def register(
    request: Request,
    user_data: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    try:
        user = await auth_service.register_user(db, user_data)
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token, expires_at = create_refresh_token(data={"sub": str(user.id)})

        await db.commit()

        set_refresh_cookie(response, refresh_token)

        return Token(
            access_token=access_token,
            # refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
        
    except ValueError as e:
        logger.error("Error at /register")
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/refresh")
@limiter.limit("100/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    payload = auth_service.verify_refresh_token_jwt(refresh_token)

    if not payload:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if (await auth_service.is_token_blacklisted(db, refresh_token)):
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized Token access")

    user_id = uuid.UUID(payload.get("sub"))

    if not user_id:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user = await auth_service.get_user_by_id(db, user_id)

    if not user:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    old_token_timestamp = datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc)

    try:

        await auth_service.blacklist_token(db, refresh_token, user_id, old_token_timestamp, "rotation")
        await db.commit()

        new_access = create_access_token(data={"sub": str(user_id)}) 
        new_refresh, expires_at = create_refresh_token(data={"sub": str(user_id)})  

    

        set_refresh_cookie(response, new_refresh)

        return {
            "access_token": new_access,
            "token_type": "bearer",
        }

    except Exception as err:
        logger.error(f"Error at routers.auth.refresh, with error {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error at server side")

@router.post("/login", response_model=Token)
@limiter.limit("50/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    try:
        user = await auth_service.authenticate_user(db, credentials)
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token, expire_time = create_refresh_token(data={"sub": str(user.id)})

        set_refresh_cookie(response, refresh_token)
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

@router.post("/logout")
@limiter.limit("50/minute")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")

    if refresh_token:
        payload = auth_service.verify_refresh_token_jwt(refresh_token)
        if payload:
            expires_at = datetime.fromtimestamp(
                payload.get("exp"), 
                timezone.utc
            )
            await auth_service.blacklist_token(db, refresh_token, uuid.UUID(payload.get("sub")), expires_at, "logout")

            await db.commit()


    clear_refresh_cookie(response)
    return {
        "message": "Logged out successfully"
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.put("/me", response_model=UserResponse)
async def update_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await auth_service.update_user_profile(
        db, current_user, user_data.full_name
    )
    return UserResponse.model_validate(user)

@router.put("/me/password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="New passwords do not match"
        )
    
    try:
        await auth_service.change_password(
            db, current_user, 
            password_data.current_password, 
            password_data.new_password
        )
        return {"message": "Password changed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
