"""
Generic CRUD helpers for the admin management endpoints.

Parameterized by SQLAlchemy model class so the four content tables
(VehicleModel / Motor / Part / AddItem) share one implementation.
All writes are explicit INSERT/UPDATE/DELETE — the only DELETE path
in the backend lives here.
"""
from typing import Any, Optional, Type
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Base, VehicleModel, Motor, Part, AddItem

# Editable columns per model (excludes PK / system / raw_data).
EDITABLE_FIELDS: dict[Type[Base], list[str]] = {
    VehicleModel: ["brand", "name", "category", "image", "model_index"],
    Motor: ["brand", "name", "type", "color", "size", "concise",
            "describe", "picsrc1", "picsrc2", "top_time"],
    Part: ["type", "brand", "name", "concise", "size", "color",
           "product_id", "body_angle", "position", "describe", "top_time"],
    AddItem: ["brand", "name", "type", "car_name", "product_id",
              "picsrc", "describe", "price"],
}

# Columns that may be used as exact-match filters on list endpoints.
FILTERABLE: dict[Type[Base], list[str]] = {
    VehicleModel: ["brand", "category"],
    Motor: ["brand", "type"],
    Part: ["brand", "type", "product_id"],
    AddItem: ["brand", "type", "car_name", "product_id"],
}


def _coerce(model: Type[Base], field: str, value: Any):
    """Coerce inbound JSON values to the column's Python type."""
    col = model.__table__.columns.get(field)
    if col is None:
        return value
    if col.type.python_type is int and value not in (None, ""):
        try:
            return int(value)
        except (TypeError, ValueError):
            return value
    return value


def serialize(obj) -> dict:
    """Return a JSON-safe dict of a row.

    Includes:
      - id
      - all editable fields (per EDITABLE_FIELDS)
      - system timestamps (created_at / updated_at / last_synced_at when present)
      - raw_data_size (int length of raw_data string, or null) — avoids sending
        the full raw JSON over the wire for list endpoints while still giving
        the UI a way to see which rows carry upstream raw data.
    """
    if obj is None:
        return None
    fields = EDITABLE_FIELDS.get(type(obj), [])
    out = {"id": obj.id}
    for f in fields:
        out[f] = getattr(obj, f, None)
    for sys_col in ("created_at", "updated_at", "last_synced_at"):
        if hasattr(obj, sys_col):
            val = getattr(obj, sys_col, None)
            out[sys_col] = val.isoformat() if val else None
    raw = getattr(obj, "raw_data", None)
    out["raw_data_size"] = len(raw) if isinstance(raw, str) else None
    return out


async def list_rows(
    db: AsyncSession,
    model: Type[Base],
    *,
    page: int = 1,
    page_size: int = 100,
    filters: Optional[dict] = None,
) -> dict:
    """List rows with optional exact-match filters + pagination."""
    stmt = select(model)
    if filters:
        allowed = FILTERABLE.get(model, [])
        for key, value in filters.items():
            if value not in (None, "") and key in allowed:
                stmt = stmt.where(getattr(model, key) == _coerce(model, key, value))

    # total count (without pagination) for UI
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(model.id).limit(page_size).offset((page - 1) * page_size)
    rows = (await db.execute(stmt)).scalars().all()
    return {"total": total, "page": page, "page_size": page_size, "data": [serialize(r) for r in rows]}


async def get_row(db: AsyncSession, model: Type[Base], row_id: int):
    obj = await db.get(model, row_id)
    return serialize(obj) if obj else None


async def create_row(db: AsyncSession, model: Type[Base], data: dict) -> dict:
    fields = EDITABLE_FIELDS.get(model, [])
    kwargs = {f: _coerce(model, f, data.get(f)) for f in fields if f in data}
    obj = model(**kwargs)
    db.add(obj)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Integrity error: {e.orig}") from e
    return serialize(obj)


async def update_row(db: AsyncSession, model: Type[Base], row_id: int, data: dict) -> Optional[dict]:
    obj = await db.get(model, row_id)
    if obj is None:
        return None
    fields = EDITABLE_FIELDS.get(model, [])
    for f in fields:
        if f in data:
            setattr(obj, f, _coerce(model, f, data[f]))
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Integrity error: {e.orig}") from e
    return serialize(obj)


async def delete_row(db: AsyncSession, model: Type[Base], row_id: int) -> bool:
    obj = await db.get(model, row_id)
    if obj is None:
        return False
    await db.delete(obj)
    await db.flush()
    return True


async def distinct_values(db: AsyncSession, model: Type[Base], column: str) -> list:
    """Distinct non-empty values for a column — feeds the selective-sync
    multi-selects and meta endpoints."""
    col = getattr(model, column, None)
    if col is None:
        return []
    stmt = select(col).distinct().where(col.isnot(None)).where(col != "")
    rows = (await db.execute(stmt)).all()
    return [r[0] for r in rows if r[0] is not None]
