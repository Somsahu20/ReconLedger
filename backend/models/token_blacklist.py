from app.database import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, TIMESTAMP, func, UUID, ForeignKey
import uuid
from datetime import datetime

# backend/app/models/token_blacklist.py

class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),                 #? SHA-256 = exactly 64 hex chars
        nullable=False,
        unique=True,
        index=True                  
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    reason: Mapped[str] = mapped_column(
        String(50),
        nullable=False       #? "logout" or "rotation"
    )
    blacklisted_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False 
    )
    
    # Relationship
    user: Mapped["User"] = relationship(
        "User", back_populates="blacklisted_tokens"
    )