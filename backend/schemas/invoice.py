from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from models.invoices import InvoiceStatus
from schemas.validation import ValidationResult 

# Line Item schemas
class LineItemBase(BaseModel):
    item_index: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

class LineItemCreate(LineItemBase):
    invoice_id: UUID

class LineItemResponse(LineItemBase):
    id: UUID
    
    model_config = ConfigDict(
        from_attributes=True
    )



# Invoice schemas
class InvoiceBase(BaseModel):
    invoice_number: str
    vendor_name: str
    date: date
    due_date: date | None = None
    currency: str = "INR"
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    grand_total: Decimal

class InvoiceCreate(InvoiceBase):
    line_items: List[LineItemCreate]

class InvoiceResponse(InvoiceBase):
    id: UUID
    status: InvoiceStatus
    audit_report: str | None = None
    uploaded_by: UUID
    processed_at: datetime | None = None
    created_at: datetime
    line_items: List[LineItemResponse]
    ai_processed: bool
    ai_message: str | None = None
    
    model_config = ConfigDict(
        from_attributes=True
    )

class InvoiceListItem(BaseModel):
    id: UUID
    invoice_number: str
    vendor_name: str
    date: date
    grand_total: Decimal
    currency: str
    status: InvoiceStatus
    processed_at: datetime | None = None
    ai_processed: bool
    ai_message: str | None = None
    
    model_config = ConfigDict(
        from_attributes=True
    )

class InvoiceListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int
    invoices: List[InvoiceListItem]
 

class InvoiceUploadResponse(BaseModel):
    status: InvoiceStatus
    invoice: InvoiceResponse
    validation: ValidationResult
    message: str


