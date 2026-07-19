"""add sync fields and unique constraints

Revision ID: 002
Revises: 001
Create Date: 2026-07-19

Add updated_at, last_synced_at, raw_data to motors/parts/add_items.
Add unique constraints on motors(brand, name) and add_items(brand, car_name, type, name).
Add sync_logs table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- motors: add columns and unique constraint ---
    op.add_column('motors', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('motors', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    op.add_column('motors', sa.Column('raw_data', sa.Text(), server_default=''))
    op.create_unique_constraint('uq_motor_brand_name', 'motors', ['brand', 'name'])

    # --- parts: add columns ---
    op.add_column('parts', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('parts', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    op.add_column('parts', sa.Column('raw_data', sa.Text(), server_default=''))

    # --- add_items: add columns and unique constraint ---
    op.add_column('add_items', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('add_items', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    op.add_column('add_items', sa.Column('raw_data', sa.Text(), server_default=''))
    op.create_unique_constraint('uq_additem_brand_car_type_name', 'add_items', ['brand', 'car_name', 'type', 'name'])

    # --- sync_logs: new table ---
    op.create_table(
        'sync_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sync_type', sa.String(64), nullable=False),
        sa.Column('started_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(32), server_default='running'),
        sa.Column('motors_count', sa.Integer(), server_default='0'),
        sa.Column('parts_count', sa.Integer(), server_default='0'),
        sa.Column('additems_count', sa.Integer(), server_default='0'),
        sa.Column('images_count', sa.Integer(), server_default='0'),
        sa.Column('error_message', sa.Text(), server_default=''),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('sync_logs')

    op.drop_constraint('uq_additem_brand_car_type_name', 'add_items', type_='unique')
    op.drop_column('add_items', 'raw_data')
    op.drop_column('add_items', 'last_synced_at')
    op.drop_column('add_items', 'updated_at')

    op.drop_column('parts', 'raw_data')
    op.drop_column('parts', 'last_synced_at')
    op.drop_column('parts', 'updated_at')

    op.drop_constraint('uq_motor_brand_name', 'motors', type_='unique')
    op.drop_column('motors', 'raw_data')
    op.drop_column('motors', 'last_synced_at')
    op.drop_column('motors', 'updated_at')