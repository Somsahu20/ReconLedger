"""Add more columns for reconciliation

Revision ID: 4c93f1eaaa51
Revises: 753d64e25d5a
Create Date: 2026-04-03 00:02:03.088053

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c93f1eaaa51'
down_revision: Union[str, Sequence[str], None] = '753d64e25d5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "reconciliation_items",
        sa.Column("listing_currency", sa.String(10), nullable=True)
    )

    op.add_column(
        "reconciliation_items",
        sa.Column("listing_po_number", sa.String(100), nullable=True)
    )

    op.add_column(
        "reconciliation_items",
        sa.Column("listing_tax_id", sa.String(100), nullable=True)
    )

    op.add_column(
        "reconciliation_items",
        sa.Column("listing_due_date", sa.Date, nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column(
        "reconciliation_items",
        "listing_currency"
    )

    op.drop_column(
        "reconciliation_items",
        "listing_po_number"
    )   

    op.drop_column(
        "reconciliation_items",
        "listing_tax_id"
    )

    op.drop_column(
        "reconciliation_items",
        "listing_due_date"
    )

