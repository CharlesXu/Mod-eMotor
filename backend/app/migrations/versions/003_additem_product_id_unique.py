"""unique index on add_items.product_id

Revision ID: 003
Revises: 002
Create Date: 2026-07-19

Store-imported add_items all carry a real product_id from the original site.
Upsert by product_id instead of the coarse (brand, car_name, type, name)
composite, which collapsed distinct items (type is usually empty).
"""
from typing import Sequence, Union
from alembic import op

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial unique index: only rows with a non-empty product_id participate,
    # so legacy rows without one are unaffected.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_additem_product_id "
        "ON add_items (product_id) WHERE product_id IS NOT NULL AND product_id <> ''"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_additem_product_id")
