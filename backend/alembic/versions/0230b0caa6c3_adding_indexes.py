"""Adding indexes

Revision ID: 0230b0caa6c3
Revises: 06e03f1ed86a
Create Date: 2026-03-16 18:50:44.911228

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0230b0caa6c3'
down_revision: Union[str, Sequence[str], None] = '06e03f1ed86a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        "idx_line_items_inv_id",
        "line_items",
        ["invoice_id"]
    )

    op.create_index(
        "idx_recon_session_name",
        "reconciliation_sessions",
        ["name"]
    )

    op.create_index(
        "idx_recon_session_uploaded_by",
        "reconciliation_sessions",
        ["uploaded_by"]
    )

    op.create_index(
        "idx_recon_item_session_id",
        "reconciliation_items",
        ["session_id"]
    )
    op.create_index(
        "idx_recon_item_invoice_id",
        "reconciliation_items",
        ["matched_invoice_id"]
    )

    op.create_index(
        "idx_inv_review_invoice_id",
        "invoice_reviews",
        ["reviewed_by"]
    )

    op.create_index(
        "idx_vld_check_inv_id",
        "validation_checks",
        ["invoice_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "idx_vld_check_inv_id",
        table_name="validation_checks",
        if_exists=True
    )
    op.drop_index(
        "idx_inv_review_invoice_id",
        table_name="invoice_reviews",
        if_exists=True
    )
    op.drop_index(
        "idx_recon_item_invoice_id",
        table_name="reconciliation_items",
        if_exists=True
    )
    op.drop_index(                              
        "idx_recon_item_session_id",
        table_name="reconciliation_items",
        if_exists=True
    )
    op.drop_index(
        "idx_recon_session_uploaded_by",
        table_name="reconciliation_sessions",
        if_exists=True
    )
    op.drop_index(
        "idx_recon_session_name",               
        table_name="reconciliation_sessions",
        if_exists=True
    )
    op.drop_index(
        "idx_line_items_inv_id",
        table_name="line_items",
        if_exists=True
    )


