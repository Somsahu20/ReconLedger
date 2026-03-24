"""Adding failed status to reconcililation session status

Revision ID: 06e03f1ed86a
Revises: 7ab9e508016e
Create Date: 2026-03-15 07:57:54.586082

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '06e03f1ed86a'
down_revision: Union[str, Sequence[str], None] = '7ab9e508016e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE reconciliationStatus ADD VALUE 'FAILED'")


def downgrade() -> None:
    """
        Downgrade schema.
        PostgreSQL does not support removing enum values natively
    """
    pass
