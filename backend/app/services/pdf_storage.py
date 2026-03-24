from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.invoices import Invoice

class PDFStorage:
    """
    Handles storing and retrieving PDF files using PostgreSQL BYTEA.
    
    Storage Strategy:
    - Store as BYTEA in PostgreSQL (no encoding overhead)
    - Persists across service restarts
    - No external storage needed (free forever)
    """
    
    #! Murky situation of whether to use db.flush() or db.commit()
    async def save(self, db: AsyncSession, invoice_id: UUID, pdf_bytes: bytes) -> bool:
        """
        Save PDF to database as BYTEA.
        
        Args:
            db: Database session
            pdf_bytes: Raw PDF file content
            invoice_id: UUID of the invoice
            
        Returns:
            True if saved successfully
        """
        
        
        try:

            result = await db.execute(
                select(Invoice).where(Invoice.id == invoice_id)
            )
            invoice = result.scalar_one_or_none()
        
            if invoice:
                invoice.pdf_data = pdf_bytes  # Store raw bytes in BYTEA column
                await db.commit()
                return True
            else:
                return False

        except Exception as err:
            await db.rollback()
            return False
    
    async def get(self, db: AsyncSession, invoice_id: UUID) -> bytes | None:
        """
        Retrieve PDF from database.
        
        Args:
            db: Database session
            invoice_id: UUID of the invoice
            
        Returns:
            PDF bytes or None if not found
        """

        result = await db.execute(
            select(Invoice).where(Invoice.id == invoice_id)
        )
        invoice = result.scalar_one_or_none()
        
        if invoice:
            return invoice.pdf_data
        else:
            return None
        
    
    
    async def delete(self, db: AsyncSession, invoice_id: UUID) -> bool:
        """
        Delete PDF from database.
        
        Args:
            db: Database session
            invoice_id: UUID of the invoice
            
        Returns:
            True if deleted, False if not found
        """

        try:
            result = await db.execute(
                select(Invoice).where(Invoice.id == invoice_id)
            )
            invoice = result.scalar_one_or_none()
            
            if invoice:
                invoice.pdf_data = None
                await db.commit()
                return True
            else:
                return False
        except Exception:
            await db.rollback()
            return False

    
    
    def get_size(self, pdf_bytes: bytes | None) -> int:
        """Get PDF size in bytes."""
        if pdf_bytes:
            return len(pdf_bytes)
        return 0

pdf_storage = PDFStorage()