"""assets table — resolved image paths per (brand, name, kind)

Revision ID: 006
Revises: 005
Create Date: 2026-07-19

The frontend asset manifests (thumbnail / line / photo / catalog-car) map
brand/name to real hashed /motomate/... paths. This table mirrors that
mapping in the DB so it becomes the source of truth for image resources.
Populated via POST /admin/assets/reindex, which reads the committed
manifest JSON files from src/data/ and upserts.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(length=128), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('path', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brand', 'name', 'kind', name='uq_asset_brand_name_kind'),
    )
    op.create_index('ix_assets_brand', 'assets', ['brand'])


def downgrade() -> None:
    op.drop_index('ix_assets_brand', table_name='assets')
    op.drop_table('assets')
