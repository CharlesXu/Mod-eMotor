"""initial

Revision ID: 001
Revises:
Create Date: 2026-07-18

Initial schema: activation_codes, motors, parts, add_items, configs
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'activation_codes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(64), nullable=False),
        sa.Column('fingerprint', sa.String(256), server_default=''),
        sa.Column('activated_at', sa.BigInteger(), server_default='0'),
        sa.Column('expires_at', sa.BigInteger(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_index('ix_activation_codes_code', 'activation_codes', ['code'])

    op.create_table(
        'motors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(128), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('type', sa.String(64), server_default=''),
        sa.Column('color', sa.String(64), server_default=''),
        sa.Column('size', sa.String(64), server_default=''),
        sa.Column('concise', sa.String(256), server_default=''),
        sa.Column('describe', sa.Text(), server_default=''),
        sa.Column('picsrc1', sa.String(512), server_default=''),
        sa.Column('picsrc2', sa.String(512), server_default=''),
        sa.Column('top_time', sa.String(32), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_motors_brand', 'motors', ['brand'])

    op.create_table(
        'parts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('type', sa.String(64), server_default=''),
        sa.Column('brand', sa.String(128), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('concise', sa.String(256), server_default=''),
        sa.Column('size', sa.String(64), server_default=''),
        sa.Column('color', sa.String(64), server_default=''),
        sa.Column('product_id', sa.String(128), nullable=False),
        sa.Column('body_angle', sa.String(64), server_default=''),
        sa.Column('position', sa.String(128), server_default=''),
        sa.Column('describe', sa.Text(), server_default=''),
        sa.Column('top_time', sa.String(32), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id'),
    )
    op.create_index('ix_parts_brand', 'parts', ['brand'])
    op.create_index('ix_parts_product_id', 'parts', ['product_id'])

    op.create_table(
        'add_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(128), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('type', sa.String(64), server_default=''),
        sa.Column('car_name', sa.String(128), server_default=''),
        sa.Column('product_id', sa.String(128), server_default=''),
        sa.Column('picsrc', sa.String(512), server_default=''),
        sa.Column('describe', sa.Text(), server_default=''),
        sa.Column('price', sa.String(64), server_default=''),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_add_items_brand', 'add_items', ['brand'])

    op.create_table(
        'configs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(128), server_default=''),
        sa.Column('motor', sa.String(128), server_default=''),
        sa.Column('distance_wheelbase', sa.String(64), server_default=''),
        sa.Column('distance_front_suspension', sa.String(64), server_default=''),
        sa.Column('wheel_front', sa.String(64), server_default=''),
        sa.Column('brake_front', sa.String(64), server_default=''),
        sa.Column('distance_second_body', sa.String(64), server_default=''),
        sa.Column('distance_back_suspension', sa.String(64), server_default=''),
        sa.Column('wheel_back', sa.String(64), server_default=''),
        sa.Column('brake_back', sa.String(64), server_default=''),
        sa.Column('message', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('configs')
    op.drop_table('add_items')
    op.drop_table('parts')
    op.drop_table('motors')
    op.drop_table('activation_codes')