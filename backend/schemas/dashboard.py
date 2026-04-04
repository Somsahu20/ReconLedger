from pydantic import BaseModel, ConfigDict
from typing import List
from datetime import datetime
from decimal import Decimal
from models.invoices import InvoiceStatus

class DashboardStats(BaseModel):
    total_invoices: int
    invoices_today: int
    total_clean: int
    total_flagged: int
    total_reviewed: int
    pending_review: int
    total_value_processed: Decimal
    average_processing_time_seconds: float

    model_config = ConfigDict(from_attributes=True)

class RecentInvoice(BaseModel):
    invoice_number: str
    vendor_name: str
    grand_total: Decimal
    currency: str
    status: InvoiceStatus
    processed_at: datetime | None = None
    ai_processed: bool

    model_config = ConfigDict(from_attributes=True)



class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_invoices: List[RecentInvoice]


