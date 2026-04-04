"""Added more attributes to reconciliation session for robust reconciliation matching real world scenario

Revision ID: 8630b21379fa
Revises: 4c93f1eaaa51
Create Date: 2026-04-03 12:00:48.863682

"""
from typing import Sequence, Union
from sqlalchemy.dialects import postgresql
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8630b21379fa'
down_revision: Union[str, Sequence[str], None] = '4c93f1eaaa51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    resolution_status = postgresql.ENUM('MANUALLY_APPROVED', 'REJECTED', name='resolutionstatus')
    resolution_status.create(op.get_bind())

    op.add_column(
        'reconciliation_items',
        sa.Column('resolved_status', sa.Enum('MANUALLY_APPROVED', 'REJECTED', name='resolutionstatus'), nullable=True)
    )

    op.add_column(
        "reconciliation_items",
        sa.Column("resolution_note", sa.String(500), nullable=True)
    )

    op.add_column(
        "reconciliation_items",
        sa.Column("resolution_date", sa.DateTime(), nullable=True)
    )




def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "reconciliation_items",
        "resolution_note"
    )

    op.drop_column(
        "reconciliation_items",
        "resolved_status"
    )

    op.drop_column(
        "reconciliation_items",
        "resolution_date"
    )    


    resolution_status = postgresql.ENUM('MANUALLY_APPROVED', 'REJECTED', name='resolutionstatus')
    resolution_status.drop(op.get_bind())


