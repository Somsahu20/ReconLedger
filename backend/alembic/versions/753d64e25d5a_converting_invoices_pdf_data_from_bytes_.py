"""Converting invoices.pdf data from bytes to str

Revision ID: 753d64e25d5a
Revises: c5aefe68add7
Create Date: 2026-04-02 01:18:06.458950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '753d64e25d5a'
down_revision: Union[str, Sequence[str], None] = 'c5aefe68add7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "invoices",
        "pdf_data",
        nullable=True,
        type_=sa.Text()
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "invoices",
        "pdf_data",
        nullable=True,
        type_=sa.LargeBinary()  
    )
