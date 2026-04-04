"""Added one more option to Result enum

Revision ID: 99b3b4a2096a
Revises: 8630b21379fa
Create Date: 2026-04-03 17:36:39.050927

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99b3b4a2096a'
down_revision: Union[str, Sequence[str], None] = '8630b21379fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE result ADD VALUE 'DUPLICATE_BILLING'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
