from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
import json
from app.database import get_db
from models.reconciliation import ReconciliationSession, ReconciliationItem, ReconciliationStatus, ResolutionStatus, Result
from app.services.reconciliation import parse_listing, run_reconciliation
from starlette import status
from models.users import User
from middleware.auth import get_current_user
from jwt.exceptions import InvalidTokenError
from utils.log import logger
from utils.lim import limiter
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict
from typing import Optional

class ResolutionRequest(BaseModel):

    action: ResolutionStatus
    note: str | None = None

    model_config = ConfigDict(
        use_enum_values=True
    )



router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])


@router.post("/upload-listing")
@limiter.limit("3/minute")
async def upload_listing(
    request: Request,
    name: str = Form(description="Name of the reconciliation"),
    file: UploadFile = File(..., description="Auditor's Excel or CSV listing"),
    use_ai: bool = Form(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        """
        Upload auditor's listing file and run reconciliation against system invoices.
        
        Accepts .xlsx, .xls, or .csv files with columns:
        Invoice# | Vendor | Date | Amount | Tax
        """

        
        
        if not file.filename.endswith((".xlsx", ".xls", ".csv")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Excel (.xlsx, .xls) or CSV (.csv) files accepted"
            )

        if file.size > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Size of the file is larger than 25 MB."
            )

        
        file_bytes = await file.read()

        # logger.info(f"File bytes: {file_bytes}")

        logger.info("Check point 1")

        try:
            records = await parse_listing(file_bytes, file.filename)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        if not records:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid records found")

        # Create session
        session = ReconciliationSession(
            name=name,
            uploaded_by=user.id,
        )
        db.add(session)

        logger.info("Check point 2")

        await db.flush()

        # Run reconciliation
        try:
            results = await run_reconciliation(
                db, session.id, user.id, records, use_ai=use_ai
            )
        except Exception as e:
            session.status = ReconciliationStatus.FAILED
            await db.commit()
            raise HTTPException(
                status_code=500,
                detail=f"Reconciliation failed: {str(e)}"
            )

        logger.info("Check point 3")
        
        session.status = ReconciliationStatus.COMPLETE
        await db.commit()

        ai_summary = results.get("ai_summary", {})
        return {
            "session_id": str(session.id),
            "session_name": name,
            "summary": {
                "total": results["total"],
                "matched": results["matched"],
                "mismatched": results["mismatched"],
                "missing": results["missing"],
                "match_rate": round(
                    (results["matched"] / max(results["total"], 1)) * 100, 1
                ),
            },
            "ai_analysis": {
                "executive_summary": ai_summary.get("executive_summary", ""),
                "risk_level": ai_summary.get("risk_level", ""),
                "recommendations": ai_summary.get("recommendations", []),
            },
            "items": results["items"],
        }
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not authenticated or token error.")
    except ValueError as ve:
        await db.rollback()
        logger.error(f" The error is value error in uplaoding listing. The error is {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check the data.")
    except HTTPException:
        raise
    except Exception as err:
        await db.rollback()
        logger.error(f"Error at routes.reconciliation. Error is {str(err)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/sessions")
@limiter.limit("10/minute")
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(ReconciliationSession).where(ReconciliationSession.uploaded_by == current_user.id)
            .order_by(ReconciliationSession.created_at.desc())
        )
        sessions = result.scalars().all()

        return [
            {
                "id": str(s.id),
                "name": s.name,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ]
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not authenticated or token error.")
    except Exception as err:
        logger.error(f"Error at routes.list_sessions. Error is {str(err)}")
        raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/{session_id}/report")
@limiter.limit("10/minute")
async def get_reconciliation_report(
    request: Request,
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full reconciliation report for a session."""

    try:

        # Verify session exists
        session_result = await db.execute(
            select(ReconciliationSession).where(
                ReconciliationSession.id == session_id,
                ReconciliationSession.uploaded_by == current_user.id
            )
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get all items
        result = await db.execute(
            select(ReconciliationItem)
            .options(selectinload(ReconciliationItem.matched_invoice))
            .where(
                ReconciliationItem.session_id == session_id
            )
        )
        items = result.scalars().all()

        matched = sum(1 for i in items if i.status == Result.MATCHED.value)
        mismatched = sum(
            1 for i in items
            if i.status in (
                Result.AMOUNT_MISMATCH.value, Result.VENDOR_MISMATCH.value,
                Result.DATE_MISMATCH.value, Result.TAX_MISMATCH.value
            )
        )
        missing = sum(1 for i in items if i.status == Result.MISSING.value)
        total = len(items)

        return {
            "session_id": session_id,
            "session_name": session.name,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "summary": {
                "total": total,
                "matched": matched,
                "mismatched": mismatched,
                "missing": missing,
                "match_rate": round((matched / max(total, 1)) * 100, 1),
            },
            "items": [
                {
                    "id": str(item.id),
                    "invoice_number": item.listing_invoice_number,
                    "vendor": item.listing_vendor_name,
                    "listing_date": str(item.listing_date),
                    "listing_amount": float(item.listing_amount),
                    "listing_tax": float(item.listing_tax_amount),
                    "currency": item.matched_invoice.currency if item.matched_invoice else "INR",
                    "status": item.status,
                    "matched_invoice_id": str(item.matched_invoice.id) if item.matched_invoice else None,
                    "matched_invoice_number": item.matched_invoice.invoice_number if item.matched_invoice else None,
                    "matched_vendor_name": item.matched_invoice.vendor_name if item.matched_invoice else None,
                    "matched_invoice_date": str(item.matched_invoice.date) if item.matched_invoice else None,
                    "matched_invoice_amount": float(item.matched_invoice.grand_total) if item.matched_invoice else None,
                    "matched_invoice_tax": float(item.matched_invoice.tax_amount) if item.matched_invoice else None,
                    "matched_invoice_currency": item.matched_invoice.currency if item.matched_invoice else None,
                    "discrepancies": (
                        json.loads(item.discrepancies)
                        if item.discrepancies
                        and item.discrepancies.startswith("[")
                        else ([item.discrepancies] if item.discrepancies else [])
                    ),
                    "resolved_status": item.resolved_status,
                    "resolution_note": item.resolution_note,
                    "resolution_date": item.resolution_date.isoformat() if item.resolution_date else None
                }
                for item in items
            ],
        }
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not authenticated or token error.")
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error at routes.get_reconciliation report. Error is {str(err)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")



@router.get("/{session_id}/items")
@limiter.limit("10/minute")
async def get_items_filtered(
    request: Request,
    session_id: str,
    current_user: User = Depends(get_current_user),
    stat: str = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get reconciliation items, optionally filtered by status.
    
    Status values: matched, missing, amount_mismatch, 
    vendor_mismatch, date_mismatch, tax_mismatch
    """

    try:
        query = select(ReconciliationItem).where(
            ReconciliationItem.session_id == session_id, 
            ReconciliationSession.uploaded_by == current_user.id
        ).join(ReconciliationSession, ReconciliationSession.id == ReconciliationItem.session_id)

        query = query.options(selectinload(ReconciliationItem.matched_invoice))

        if stat:
            query = query.where(ReconciliationItem.status == stat)

        result = await db.execute(query)
        items = result.scalars().all()

        return {
            "session_id": session_id,
            "filter": stat or "all",
            "count": len(items),
            "items": [
                {
                    "id": str(item.id),
                    "invoice_number": item.listing_invoice_number,
                    "vendor": item.listing_vendor_name,
                    "listing_amount": float(item.listing_amount),
                    "currency": item.matched_invoice.currency if item.matched_invoice else "INR",
                    "status": item.status,

                    "listing_vendor_name": item.listing_vendor_name,
                    "listing_date": item.listing_date,
                    "listing_amount": item.listing_amount,
                    "listing_tax_amount":item.listing_tax_amount,

                    "matched_invoice_id": str(item.matched_invoice.id) if item.matched_invoice else None,
                    "matched_invoice_number": item.matched_invoice.invoice_number if item.matched_invoice else None,
                    "matched_vendor_name": item.matched_invoice.vendor_name if item.matched_invoice else None,
                    "matched_invoice_date": str(item.matched_invoice.date) if item.matched_invoice else None,
                    "matched_invoice_amount": float(item.matched_invoice.grand_total) if item.matched_invoice else None,
                    "matched_invoice_tax": float(item.matched_invoice.tax_amount) if item.matched_invoice else None,
                    "matched_invoice_currency": item.matched_invoice.currency if item.matched_invoice else None,

                    "discrepancies": (
                        json.loads(item.discrepancies)
                        if item.discrepancies
                        and item.discrepancies.startswith("[")
                        else ([item.discrepancies] if item.discrepancies else [])
                    ),

                    "resolved_status": item.resolved_status,
                    "resolution_note": item.resolution_note,
                    "resolution_date": item.resolution_date.isoformat() if item.resolution_date else None
                }
                for item in items
            ],
        }
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not authenticated or token error.")
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error at routes.get_item_filtered. Error is \n {str(err)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/items/{item_id}/resolve")
async def update_line_item(
    item_id: uuid.UUID,
    payload: ResolutionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):

    try:
        item = (await db.execute(select(ReconciliationItem).join(ReconciliationSession, ReconciliationItem.session_id == ReconciliationSession.id)
        .where(ReconciliationItem.id == item_id, ReconciliationSession.uploaded_by == current_user.id)
        )).scalar_one_or_none()
    except Exception as err:
        logger.error(f"Database query error in update_line_item: {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal Server Error")

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No item with such id.")

    try:
        if payload.action == "MANUALLY_APPROVED":
            item.resolved_status = ResolutionStatus.MANUALLY_APPROVED
        else:
            item.resolved_status = ResolutionStatus.REJECTED


        item.resolution_note = payload.note
        item.resolution_date = datetime.now(timezone.utc)

        await db.commit()

        return {
            "message": "Item resolved successfully"
        }
    
    except Exception as err:
        await db.rollback()
        logger.error(f"Error saving resolution in update_line_item: {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save resolution")

    

