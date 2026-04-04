from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette import status
from app.database import get_db
from middleware.auth import get_current_user
from models.users import User
from schemas.invoice import InvoiceStatus
from models.reviews import InvoiceReview
from models.invoices import Invoice
# from models import User, Invoice, InvoiceReview, InvoiceStatus
from schemas.review import ReviewCreate, ReviewResponse, ReviewerInfo
from utils.log import logger
from utils.lim import limiter

router = APIRouter(prefix="/review", tags=["Review"])

@router.post("/{invoice_id}/resolve", response_model=ReviewResponse)
@limiter.limit("10/minute")
async def resolve_flagged_invoice(
    request: Request,
    invoice_id: UUID,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    
    try:
        result = await db.execute(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.uploaded_by == current_user.id)
        )
        invoice = result.scalar_one_or_none()
        
        if not invoice:
            logger.error("Invoice not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        
        if invoice.status != InvoiceStatus.FLAGGED:
            logger.error("Invoice is not flagged")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice is not flagged")
        
        
        review = InvoiceReview(
            invoice_id=invoice_id,
            reviewed_by=current_user.id,
            review_note=review_data.note,
            reviewed_at=datetime.now(timezone.utc)
        )
        
        db.add(review)
        
        # Update invoice status
        invoice.status = InvoiceStatus.REVIEWED
        
        await db.commit()
        await db.refresh(invoice)
        
        return ReviewResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            status=invoice.status,
            reviewed_by=ReviewerInfo(id = current_user.id, full_name = current_user.full_name),
            review_note=review.review_note,
            reviewed_at=review.reviewed_at
        )

    except HTTPException:
        logger.error(f"HTTP Error in resolve flagged invoice.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error in the function in reviews.review_flagged_invoice")

    except Exception as err:
        logger.error(f"Error in resolve flagged invoice. The error is {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error in the function in reviews.review_flagged_invoice")

@router.get("/history")
@limiter.limit("10/minute")
async def get_review_history(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(InvoiceReview)
        .where(InvoiceReview.reviewed_by == current_user.id)
        .join(Invoice)
        .order_by(InvoiceReview.reviewed_at.desc())
    )
    reviews = result.scalars().all()
    
    return reviews
