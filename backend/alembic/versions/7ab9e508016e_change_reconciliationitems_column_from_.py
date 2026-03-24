"""Change ReconciliationItems column from dict to str to allow json.dumps()

Revision ID: 7ab9e508016e
Revises: 3b75423034d9
Create Date: 2026-03-13 19:51:22.981095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ab9e508016e'
down_revision: Union[str, Sequence[str], None] = '3b75423034d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        'reconciliation_items',
        'discrepancies',
        type_=sa.Text   # new type
    )

    op.execute("ALTER TYPE result ADD VALUE 'TAX_MISMATCH'")
    op.execute("ALTER TYPE result ADD VALUE 'AI_MATCH'")
    op.execute("ALTER TYPE result ADD VALUE 'AI_MATCHED_WITH_DISCREPANCIES'")



def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'reconciliation_items',
        'discrepancies',
        type_=sa.JSON   # new type
    )
