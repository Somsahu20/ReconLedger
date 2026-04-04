"""add_ai_status_to_invoices

Revision ID: c5aefe68add7
Revises: 27516f84425f
Create Date: 2026-04-01 17:13:44.713459

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5aefe68add7'
down_revision: Union[str, Sequence[str], None] = '27516f84425f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "invoices",
        sa.Column('ai_processed', sa.Boolean(), server_default='false', nullable=False), 
    )
    op.add_column('invoices', sa.Column('ai_message', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('invoices', 'ai_message')
    op.drop_column('invoices', 'ai_processed')
