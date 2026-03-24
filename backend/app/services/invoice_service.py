from datetime import datetime, date, timezone
from decimal import Decimal
from uuid import UUID
from typing import List
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from models.invoices import Invoice, InvoiceStatus, LineItem
from models.validations import ValidationCheck
from models.users import User
from schemas.invoice import InvoiceCreate, InvoiceListResponse, InvoiceListItem
from app.services.validator import InvoiceData
from utils.log import logger
from fastapi import HTTPException
from starlette.status import HTTP_404_NOT_FOUND

async def create_invoice(
    db: AsyncSession,
    invoice_data: InvoiceData,
    validation_result: dict,
    uploaded_by: UUID,
    status: str,
    audit_report: str | None = None
) -> Invoice:
    """Create a new invoice with line items and validation checks."""
    
    # Parse dates
    invoice_date = invoice_data.date
    due_date = None
    if invoice_data.due_date:
        due_date = invoice_data.due_date
    
    # Create invoice
    invoice = Invoice(
        invoice_number=invoice_data.invoice_number,
        vendor_name=invoice_data.vendor_name,
        date=invoice_date,
        due_date=due_date,
        currency=invoice_data.currency,
        subtotal=invoice_data.subtotal,
        tax_rate=invoice_data.tax_rate,
        tax_amount=invoice_data.tax_amount,
        grand_total=invoice_data.grand_total,
        status=InvoiceStatus(status),
        audit_report=audit_report,
        uploaded_by=uploaded_by,
        processed_at=datetime.now(timezone.utc),
    )

    try:
    
        db.add(invoice)
        await db.commit()
        await db.refresh(invoice)
        
        # Create line items
        for item_data in invoice_data.line_items:
            line_item = LineItem(
                invoice_id=invoice.id,
                item_index=item_data.item_index,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                line_total=item_data.line_total
            )
            db.add(line_item)
        
        # Create validation checks
        # for check in validation_list:
        #     check.invoice_id = invoice.id
        #     db.add(check)

        for c in validation_result["checks"]:
            check = ValidationCheck(
                invoice_id = invoice.id,
                check_name = c["check_name"],
                expected_value = Decimal(c["expected_value"]),
                actual_value = Decimal(c["actual_value"]),
                passed = c["passed"],
                discrepancy = Decimal(c["discrepancy"])
            )
            db.add(check)
        
        await db.commit()
        
        result = await db.execute(
            select(Invoice).where(Invoice.id == invoice.id).options(selectinload(Invoice.line_items))
        )
        return result.scalar_one()

    except Exception as err:
        logger.error("Error in create_invoice functions")
        await db.rollback()
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=f"The error is {err}")

async def list_invoices(
    db: AsyncSession,
    current_user: User,
    status: str = "all",
    search: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str = "processed_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 20,
) -> InvoiceListResponse:
    """List invoices with filtering, search, sorting, and pagination."""
    
    # Build query conditions
    conditions = [Invoice.uploaded_by == current_user.id]

    

    try:
    
        if status != "all":
            conditions.append(Invoice.status == InvoiceStatus(status))
        
        if search:
            conditions.append(
                (Invoice.vendor_name.ilike(f"%{search}%")) | 
                (Invoice.invoice_number.ilike(f"%{search}%"))
            )
        
        if date_from:
            conditions.append(Invoice.date >= date_from)
        
        if date_to:
            conditions.append(Invoice.date <= date_to)
        
        
        base_query = select(Invoice).where(and_(*conditions)) if conditions else select(Invoice)
        
        # Get total count
        count_query = select(func.count(Invoice.id)).where(and_(*conditions)) if conditions else select(func.count(Invoice.id))
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply sorting
        sort_column = getattr(Invoice, sort_by, Invoice.processed_at)
        if sort_order == "desc":
            base_query = base_query.order_by(sort_column.desc())
        else:
            base_query = base_query.order_by(sort_column.asc())
        
        # Apply pagination
        offset = (page - 1) * per_page
        base_query = base_query.offset(offset).limit(per_page)
        
        result = await db.execute(base_query)
        invoices = result.scalars().all()
        
        
        total_pages = (total + per_page - 1) // per_page
        
        return InvoiceListResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            invoices=[
                InvoiceListItem(
                    id=inv.id,
                    invoice_number=inv.invoice_number,
                    vendor_name=inv.vendor_name,
                    date=inv.date,
                    grand_total=Decimal(str(inv.grand_total)),
                    currency=inv.currency,
                    status=inv.status.value,
                    processed_at=inv.processed_at,
                )
                for inv in invoices
            ]
        )
    except Exception as err:
        logger.error("Error in list_invoice functions")
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=f"The error is {err}")


async def get_invoice_by_number(
    db: AsyncSession,
    current_user: User,
    invoice_number: str
) -> Invoice | None:

    try:
    
        result = await db.execute(
            select(Invoice).where(Invoice.invoice_number == invoice_number, Invoice.uploaded_by == current_user.id).options(selectinload(Invoice.line_items))
        )
        return result.scalar_one_or_none()

    except Exception as err:
        logger.error("Error in get_invoice_by_number functions")
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=f"The error is {err}")

async def get_flagged_invoices(db: AsyncSession, current_user: User) -> List[Invoice]:
    """Get all flagged invoices pending review."""

    try:
    
        result = await db.execute(
            select(Invoice)
            .where(Invoice.status == InvoiceStatus.FLAGGED, Invoice.uploaded_by == current_user.id)
            .order_by(Invoice.processed_at.asc())
        )
        return result.scalars().all()

    except Exception as err:
        logger.error("Error in get_flagged_invoice functions")
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail=f"The error is {err}")
