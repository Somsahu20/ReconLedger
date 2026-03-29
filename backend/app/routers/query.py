from fastapi import APIRouter, Depends, HTTPException, Request
from middleware.auth import get_current_user
from models.users import User
from schemas.query import QueryRequest, QueryResponse
from app.services.query_engine import process_query
from utils.log import logger
from starlette import status
from utils.lim import limiter

router = APIRouter(prefix="/query", tags=["Query"])

@router.post("", response_model=QueryResponse)
@limiter.limit("3/minute")
async def query_invoices(request: Request, query_data: QueryRequest, current_user: User = Depends(get_current_user)):

    
    try:
        result = await process_query(query_data.question, current_user.id)
        return QueryResponse(**result)
    except Exception as err:
        logger.error(f"Error is query.query_invoice. The error is {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
