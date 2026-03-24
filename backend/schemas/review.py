from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from models.invoices import InvoiceStatus
from decimal import Decimal

class ReviewCreate(BaseModel):
    note: str | None = None

class ReviewerInfo(BaseModel):
    id: UUID
    full_name: str

    model_config = ConfigDict(from_attributes=True)

class ReviewResponse(BaseModel):
    invoice_id: UUID
    invoice_number: str
    status: InvoiceStatus
    reviewed_by: ReviewerInfo
    review_note: str | None = None
    reviewed_at: datetime

class FlaggedInvoiceItem(BaseModel):
    id: UUID
    invoice_number: str
    vendor_name: str
    grand_total: Decimal
    currency: str
    status: InvoiceStatus
    processed_at: datetime | None = None
    audit_report: str | None = None
    
    model_config = ConfigDict(from_attributes=True)