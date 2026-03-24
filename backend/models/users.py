import uuid
from datetime import datetime
from sqlalchemy import Text, Boolean, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from typing import List


class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str]  = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="uploaded_by_user")
    reviews: Mapped[list["InvoiceReview"]] = relationship("InvoiceReview", back_populates="reviewer")

    reconciliation_sessions: Mapped[List["ReconciliationSession"]] = relationship("ReconciliationSession", back_populates="uploaded_by_user")

    blacklisted_tokens: Mapped[List["TokenBlacklist"]] = relationship(
        "TokenBlacklist", back_populates="user"
    )




