from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from models.invoices import Invoice, InvoiceStatus
from schemas.dashboard import DashboardStats, RecentInvoice, DashboardResponse
from utils.log import logger
from starlette import status
from uuid import UUID

async def get_dashboard_stats(db: AsyncSession, user_id: UUID) -> DashboardResponse:
    
    try:

        query = select(func.count(Invoice.id)).where(Invoice.uploaded_by == user_id)

        total_result = await db.execute(query)
        total_invoices = total_result.scalar() or 0
        

        logger.info(f"Total invoices: {total_invoices}")

        # Invoices today
        today = today = datetime.now(timezone.utc).date()
        today_start = datetime.combine(today, datetime.min.time())
        today_result = await db.execute(
            select(func.count(Invoice.id)).where(Invoice.processed_at >= today_start, Invoice.uploaded_by == user_id)
        )
        invoices_today = today_result.scalar() or 0

        
        
        #todo Normal Results
        clean_result = await db.execute(
            select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.CLEAN, Invoice.uploaded_by == user_id)
        )
        total_clean = clean_result.scalar() or 0
        
        #todo Flagged Results
        flagged_result = await db.execute(
            select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.FLAGGED, Invoice.uploaded_by == user_id)
        )
        total_flagged = flagged_result.scalar() or 0
        
        #todo reviewd results
        reviewed_result = await db.execute(
            select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.REVIEWED, Invoice.uploaded_by == user_id)
        )
        total_reviewed = reviewed_result.scalar() or 0
        
        value_result = await db.execute(
            select(func.sum(Invoice.grand_total)).where(Invoice.uploaded_by == user_id)
        )
        total_value = value_result.scalar() or 0
        
        # Average processing time (simplified - would need to track actual times)
        avg_processing_time = 18.5  # Placeholder
        
        stats = DashboardStats(
            total_invoices=total_invoices,
            invoices_today=invoices_today,
            total_clean=total_clean,
            total_flagged=total_flagged,
            total_reviewed=total_reviewed,
            pending_review=total_flagged,
            total_value_processed=Decimal(total_value),
            average_processing_time_seconds=avg_processing_time,
        )
        
        recent_result = await db.execute(
            select(Invoice).where(Invoice.uploaded_by == user_id)
            .order_by(Invoice.processed_at.desc())
            .limit(5)
        )
        recent_invoices = recent_result.scalars().all()
        
        recent_list = [
            RecentInvoice(
                invoice_number=inv.invoice_number,
                vendor_name=inv.vendor_name,
                grand_total=Decimal(inv.grand_total),
                status=inv.status.value,
                processed_at=inv.processed_at,
            )
            for inv in recent_invoices
        ]
        
        return DashboardResponse(
            stats=stats,
            recent_invoices=recent_list
        )

    except Exception as err:
        logger.error(f"There is error in dashboard_Service.get_dh_service. The error is  {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error in dashboard service.get_db_service")