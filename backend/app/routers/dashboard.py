from fastapi import APIRouter, Depends, HTTPException
from middleware.auth import get_current_user
from models.users import User
from schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard_stats
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from utils.log import logger
from jwt.exceptions import InvalidTokenError
from starlette import status
from utils.lim import limiter
from fastapi import Request

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardResponse)
@limiter.limit("50/minute")
async def get_stats(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):

    try:
        user_id = current_user.id
        return await get_dashboard_stats(db, user_id)

    except InvalidTokenError:
        logger.error("Authentication error in dashboard.get_stats.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})

    except Exception as err:
        logger.error(f"Error in dashboard.get_stats. The error is {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error in dashboard.get_stats.")