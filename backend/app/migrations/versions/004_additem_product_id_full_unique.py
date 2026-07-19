"""drop add_items composite unique, use product_id only

Revision ID: 004
Revises: 003
Create Date: 2026-07-19

Store-imported add_items carry a real product_id from the original site, and
distinct items can share (brand, car_name, type, name) — type is usually empty.
The composite unique constraint uq_additem_brand_car_type_name therefore
collapses distinct items. Drop it and rely on a full unique index on
product_id (NULLs allowed, so legacy rows without product_id are unaffected).
"""
from typing import Sequence, Union
from alembic import op

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the composite constraint that collapsed distinct additems.
    op.execute("ALTER TABLE add_items DROP CONSTRAINT IF EXISTS uq_additem_brand_car_type_name")
    # Replace the partial index with a full unique index (NULLs allowed).
    op.execute("DROP INDEX IF EXISTS uq_additem_product_id")
    op.execute("UPDATE add_items SET product_id = NULL WHERE product_id = ''")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_additem_product_id "
        "ON add_items (product_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_additem_product_id")
    op.create_unique_constraint(
        'uq_additem_brand_car_type_name', 'add_items',
        ['brand', 'car_name', 'type', 'name']
    )
