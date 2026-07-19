"""vehicle_models unique on (brand, name, model_index)

Revision ID: 005
Revises: 004
Create Date: 2026-07-19

The /admin/import/catalog endpoint did plain db.add() with no dedup, so
re-importing the same catalog produced duplicate rows. Add a unique
constraint on (brand, name, model_index) and let the import upsert.

For existing tables that already contain duplicates, dedupe first (keep the
lowest id per group) before adding the constraint, otherwise the constraint
creation would fail.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dedupe existing rows: keep the lowest-id row per (brand, name, model_index),
    # delete the rest. Without this the unique constraint creation fails on
    # tables that already accumulated duplicates from the old plain-insert path.
    op.execute(
        "DELETE FROM vehicle_models a USING vehicle_models b "
        "WHERE a.id > b.id "
        "AND a.brand IS NOT DISTINCT FROM b.brand "
        "AND a.name IS NOT DISTINCT FROM b.name "
        "AND a.model_index IS NOT DISTINCT FROM b.model_index"
    )
    op.create_unique_constraint(
        'uq_vehicle_brand_name_index', 'vehicle_models',
        ['brand', 'name', 'model_index']
    )


def downgrade() -> None:
    op.drop_constraint('uq_vehicle_brand_name_index', 'vehicle_models', type_='unique')
