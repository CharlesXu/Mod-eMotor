"""
SQLAlchemy ORM models for 电改模拟工具.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, BigInteger, DateTime, func, UniqueConstraint
from .database import Base


class ActivationCode(Base):
    __tablename__ = "activation_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    fingerprint = Column(String(256), default="")
    activated_at = Column(BigInteger, default=0)
    expires_at = Column(BigInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())


class Motor(Base):
    __tablename__ = "motors"
    __table_args__ = (
        UniqueConstraint("brand", "name", name="uq_motor_brand_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(128), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    type = Column(String(64), default="")
    color = Column(String(64), default="")
    size = Column(String(64), default="")
    concise = Column(String(256), default="")
    describe = Column(Text, default="")
    picsrc1 = Column(String(512), default="")
    picsrc2 = Column(String(512), default="")
    top_time = Column(String(32), default="0")
    updated_at = Column(DateTime, onupdate=func.now())
    last_synced_at = Column(DateTime)
    raw_data = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(64), default="")
    brand = Column(String(128), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    concise = Column(String(256), default="")
    size = Column(String(64), default="")
    color = Column(String(64), default="")
    product_id = Column(String(128), unique=True, nullable=False, index=True)
    body_angle = Column(String(64), default="")
    position = Column(String(128), default="")
    describe = Column(Text, default="")
    top_time = Column(String(32), default="0")
    updated_at = Column(DateTime, onupdate=func.now())
    last_synced_at = Column(DateTime)
    raw_data = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())


class AddItem(Base):
    __tablename__ = "add_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(128), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    type = Column(String(64), default="")
    car_name = Column(String(128), default="")
    product_id = Column(String(128), index=True)  # unique via migration 004 index
    picsrc = Column(String(512), default="")
    describe = Column(Text, default="")
    price = Column(String(64), default="")
    updated_at = Column(DateTime, onupdate=func.now())
    last_synced_at = Column(DateTime)
    raw_data = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())


class Config(Base):
    __tablename__ = "configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(128), default="")
    motor = Column(String(128), default="")
    distance_wheelbase = Column(String(64), default="")
    distance_front_suspension = Column(String(64), default="")
    wheel_front = Column(String(64), default="")
    brake_front = Column(String(64), default="")
    distance_second_body = Column(String(64), default="")
    distance_back_suspension = Column(String(64), default="")
    wheel_back = Column(String(64), default="")
    brake_back = Column(String(64), default="")
    message = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_type = Column(String(64), nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="running")
    motors_count = Column(Integer, default=0)
    parts_count = Column(Integer, default=0)
    additems_count = Column(Integer, default=0)
    images_count = Column(Integer, default=0)
    error_message = Column(Text, default="")


class VehicleModel(Base):
    """Vehicle catalog for the Next.js frontend."""
    __tablename__ = "vehicle_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(128), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    category = Column(String(64), default="")
    image = Column(String(512), default="")
    model_index = Column(Integer, default=0)
