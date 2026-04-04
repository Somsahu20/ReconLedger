"""Adding timezone to resolution date of reconciliation item

Revision ID: e17c0834fe04
Revises: 99b3b4a2096a
Create Date: 2026-04-04 11:30:51.116046

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e17c0834fe04'
down_revision: Union[str, Sequence[str], None] = '99b3b4a2096a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    
    op.alter_column(
        "reconciliation_items",
        "resolution_date",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        # postgresql_using handles the data conversion explicitly
        postgresql_using="resolution_date AT TIME ZONE 'UTC'" 
    )

def downgrade() -> None:
    op.alter_column(
        "reconciliation_items",
        "resolution_date",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        postgresql_using="resolution_date AT TIME ZONE 'UTC'"
    )
