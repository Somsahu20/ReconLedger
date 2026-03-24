from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from app.database import Base
from sqlalchemy import DateTime, func, ForeignKey, Enum as sqlEnum, Numeric, Date, JSON, UUID, String, Text
import sqlalchemy as sa
from datetime import datetime, date
from enum import Enum
from typing import List, Optional 
from decimal import Decimal

class ReconciliationStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"

class Result(str, Enum):
    UNMATCHED = "UNMATCHED"
    MATCHED = "MATCHED"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    VENDOR_MISMATCH = "VENDOR_MISMATCH"
    DATE_MISMATCH = "DATE_MISMATCH"
    TAX_MISMATCH = "TAX_MISMATCH"
    MISSING = "MISSING"
    AI_MATCH = "AI_MATCH"
    AI_MATCHED_WITH_DISCREPANCIES = "AI_MATCHED_WITH_DISCREPANCIES"


class ReconciliationSession(Base):
    __tablename__ = "reconciliation_sessions"
    
    id: Mapped[uuid.UUID]= mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False) #! "Q1 2025 Audit"
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    status: Mapped[ReconciliationStatus] = mapped_column(sqlEnum(ReconciliationStatus), nullable=False,  server_default=ReconciliationStatus.PENDING.value)   # PENDING, COMPLETE
    
    # Relationships
    items: Mapped[List["ReconciliationItem"]] = relationship("ReconciliationItem", back_populates="session")

    uploaded_by_user: Mapped["User"] = relationship("User", back_populates="reconciliation_sessions")


class ReconciliationItem(Base):
    __tablename__ = "reconciliation_items"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reconciliation_sessions.id"))
    
    listing_invoice_number: Mapped[str] = mapped_column(String, nullable=False)
    listing_vendor_name: Mapped[str] = mapped_column(String, nullable=False)
    listing_date: Mapped[date] = mapped_column(Date, nullable=False)
    listing_amount: Mapped[Decimal] = mapped_column(Numeric(12,2), nullable=False)
    listing_tax_amount: Mapped[Decimal] = mapped_column(Numeric(12,2), nullable=False)
    
    # From actual invoice in system 
    matched_invoice_id: Mapped[uuid.UUID| None]  = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    

    status: Mapped[Result] = mapped_column(sqlEnum(Result), nullable=False, server_default=Result.MISSING.value)
    
    
    discrepancies: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True) #! JSON string of mismatches
    
    session: Mapped["ReconciliationSession"] = relationship("ReconciliationSession", back_populates="items")
    matched_invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="reconciliation_line_item")