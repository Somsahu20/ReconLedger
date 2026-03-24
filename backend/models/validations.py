import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Boolean, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base

class ValidationCheck(Base):
    __tablename__ = "validation_checks"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    check_name: Mapped[str] = mapped_column(String(100), nullable=False)
    expected_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    actual_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    discrepancy: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="validation_checks")