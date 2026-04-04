import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Date, TIMESTAMP, Numeric, ForeignKey, Text, Enum as SQLEnum, func, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from enum import Enum
from app.database import Base
from typing import List


class InvoiceStatus(str, Enum):
    CLEAN = "CLEAN"
    FLAGGED = "FLAGGED"
    REVIEWED = "REVIEWED"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(SQLEnum(InvoiceStatus), nullable=False, server_default=InvoiceStatus.CLEAN.value)
    audit_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # nullable: set explicitly once AI processing completes, not on insert
    processed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    ai_processed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default='false')
    ai_message: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    uploaded_by_user: Mapped["User"] = relationship("User", back_populates="invoices")
    line_items: Mapped[list["LineItem"]] = relationship("LineItem", back_populates="invoice", cascade="all, delete-orphan")
    validation_checks: Mapped[list["ValidationCheck"]] = relationship("ValidationCheck", back_populates="invoice", cascade="all, delete-orphan")
    review: Mapped["InvoiceReview | None"] = relationship("InvoiceReview", back_populates="invoice", uselist=False)
    reconciliation_line_item: Mapped[List["ReconciliationItem"]] = relationship("ReconciliationItem", back_populates="matched_invoice")


class LineItem(Base):
    __tablename__ = "line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    item_index: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="line_items")
