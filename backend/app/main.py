"""
Main FastAPI application - 电改模拟工具 Backend Replica.
PostgreSQL + SQLAlchemy 2.0 async.

Local replica: no activation required. Protocol-compatible with the original
site (same endpoints, multipart/form-data, AES-encrypted `data` field). Data
is imported from the user's authorized original-site Chrome page via
/admin/import/store-data — no original-site activation or binding bypass.
"""
from fastapi import FastAPI, Form, Request, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, desc, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import time
import logging
from pathlib import Path
from datetime import datetime

from .crypto_utils import encrypt, decrypt
from .database import get_db, init_db, close_db, engine, Base
from .models import (
    ActivationCode, Motor, Part, AddItem, Config, SyncLog, VehicleModel,
)
from .config import LOCAL_AUTH_DISABLED, SYNC_ENABLED, SYNC_INTERVAL_HOURS, SYNC_ON_STARTUP

logger = logging.getLogger("emotor")
app = FastAPI(title="电改模拟工具 API")

# CORS - allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DATA_DIR = Path(__file__).parent / "data"
UPLOADS_DIR = Path(__file__).parent / "uploads"
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Lazy import for sync service (avoids circular imports)
_sync_service = None


def _get_sync_service():
    global _sync_service
    if _sync_service is None:
        from .sync_service import SyncService
        _sync_service = SyncService()
    return _sync_service


@app.on_event("startup")
async def startup():
    await init_db()

    # Start scheduler if enabled
    if SYNC_ENABLED:
        from .scheduler import start_scheduler
        start_scheduler()
        logger.info("Sync scheduler started")

    if SYNC_ON_STARTUP:
        from .sync_service import SyncService
        svc = SyncService()
        try:
            async for session in _get_db_session():
                await svc.full_sync(session)
                break
            logger.info("Startup sync completed")
        except Exception as e:
            logger.error(f"Startup sync failed: {e}")


async def _get_db_session():
    """Get a standalone DB session (not as a dependency)."""
    from .database import async_session
    async with async_session() as session:
        yield session


@app.on_event("shutdown")
async def shutdown():
    from .scheduler import stop_scheduler
    stop_scheduler()
    await close_db()


# ============================================================
# Helper: build motor_list from DB
# ============================================================

async def _get_motor_list(db: AsyncSession):
    result = await db.execute(select(Motor))
    motors = result.scalars().all()
    return [{
        "brand": m.brand, "name": m.name, "type": m.type,
        "color": m.color, "size": m.size, "concise": m.concise,
        "describe": m.describe, "picsrc1": m.picsrc1, "picsrc2": m.picsrc2,
        "topTime": m.top_time
    } for m in motors]


# ============================================================
# API Endpoints (protocol-compatible with original site)
# ============================================================

@app.post("/getTools")
async def get_tools(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Protocol-compatible getTools.
    Local replica: no activation required — always returns success with motor_list.
    """
    try:
        form = await request.form()
        data_str = form.get("data", "{}")
        data = json.loads(data_str)
        request_type = data.get("type", "PC")

        # Always respond with success and motor_list from local DB
        ts = int(time.time() * 1000)
        encrypted_response = encrypt(f"local_{ts}")

        motor_list = await _get_motor_list(db)

        return {
            "method": "getTools",
            "stat": "success",
            "data": encrypted_response,
            "motor_list": motor_list
        }
    except Exception as e:
        ts = int(time.time() * 1000)
        encrypted_response = encrypt(f"__{ts}")
        return {"method": "getTools", "stat": "fail", "data": encrypted_response, "reason": str(e)}


@app.post("/recviceMotorInfo")
async def recvice_motor_info(request: Request, db: AsyncSession = Depends(get_db)):
    """Save motor configuration. Protocol-compatible with original site."""
    try:
        form = await request.form()
        data_str = form.get("data", "{}")
        data = json.loads(data_str)

        config = Config(
            brand=data.get("brand", ""),
            motor=data.get("motor", ""),
            distance_wheelbase=str(data.get("distance_wheelbase", "")),
            distance_front_suspension=str(data.get("distance_front_suspension", "")),
            wheel_front=str(data.get("wheel_front", "")),
            brake_front=str(data.get("brake_front", "")),
            distance_second_body=str(data.get("distance_secondBody", "")),
            distance_back_suspension=str(data.get("distance_back_suspension", "")),
            wheel_back=str(data.get("wheel_back", "")),
            brake_back=str(data.get("brake_back", "")),
            message=str(data.get("message", "")),
        )
        db.add(config)
        await db.flush()
        return {"stat": "success"}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.post("/systemControl")
async def system_control(request: Request):
    """
    AI system control / calculation endpoint.
    Protocol-compatible response — returns empty data for now.
    """
    try:
        form = await request.form()
        data_str = form.get("data", "{}")
        data = json.loads(data_str)
        step = data.get("step", "")
        return {"stat": "success", "data": ""}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.post("/getPartList")
async def get_part_list(db: AsyncSession = Depends(get_db)):
    """
    Get list of all parts as underscore-separated strings.
    Protocol-compatible with original API format.
    """
    result = await db.execute(select(Part))
    parts = result.scalars().all()

    part_strings = []
    for p in parts:
        s = "_".join([
            p.type or "", p.brand or "", p.name or "", p.concise or "",
            p.size or "", p.color or "", p.product_id or "",
            p.body_angle or "", p.position or "", p.describe or "",
            p.top_time or "0"
        ])
        part_strings.append(s)

    return {"stat": "success", "data": part_strings}


@app.post("/loadPartInfo")
async def load_part_info(request: Request, db: AsyncSession = Depends(get_db)):
    """Load detailed info for a specific part. Protocol-compatible."""
    try:
        form = await request.form()
        data_str = form.get("data", "")

        result = await db.execute(
            select(Part).where((Part.product_id == data_str) | (Part.name == data_str))
        )
        part = result.scalar_one_or_none()

        if part:
            return {"stat": "success", "data": {
                "type": part.type, "brand": part.brand, "name": part.name,
                "concise": part.concise, "size": part.size, "color": part.color,
                "product_id": part.product_id, "bodyAngle": part.body_angle,
                "position": part.position, "describe": part.describe,
                "topTime": part.top_time
            }}
        return {"stat": "fail", "reason": "Part not found"}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.post("/getAddList")
async def get_add_list(request: Request, db: AsyncSession = Depends(get_db)):
    """Get add-on items. Protocol-compatible with original site."""
    try:
        form = await request.form()
        brand = form.get("belongCarBrand", "")
        name = form.get("belongCarName", "")

        query = select(AddItem)
        if brand:
            query = query.where(AddItem.brand == brand)
        if name:
            query = query.where(AddItem.car_name == name)

        result = await db.execute(query)
        items = result.scalars().all()

        data = [{
            "brand": i.brand, "name": i.name, "type": i.type,
            "car_name": i.car_name, "product_id": i.product_id,
            "picsrc": i.picsrc, "describe": i.describe, "price": i.price
        } for i in items]

        return {"stat": "success", "data": data}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.post("/loadAdditemInfo")
async def load_additem_info(request: Request, db: AsyncSession = Depends(get_db)):
    """Load detailed info for a specific add-on item. Protocol-compatible."""
    try:
        form = await request.form()
        data_str = form.get("data", "")

        result = await db.execute(
            select(AddItem).where((AddItem.product_id == data_str) | (AddItem.name == data_str))
        )
        item = result.scalar_one_or_none()

        if item:
            return {"stat": "success", "data": {
                "brand": item.brand, "name": item.name, "type": item.type,
                "car_name": item.car_name, "product_id": item.product_id,
                "picsrc": item.picsrc, "describe": item.describe, "price": item.price
            }}
        return {"stat": "fail", "reason": "Item not found"}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.post("/getCatalog")
async def get_catalog(db: AsyncSession = Depends(get_db)):
    """Get vehicle catalog for the Next.js frontend."""
    result = await db.execute(select(VehicleModel).order_by(VehicleModel.brand, VehicleModel.model_index))
    models = result.scalars().all()

    # Group by brand
    brands: dict[str, list[dict]] = {}
    for m in models:
        if m.brand not in brands:
            brands[m.brand] = []
        brands[m.brand].append({
            "index": m.model_index,
            "name": m.name,
            "image": m.image,
            "category": m.category,
        })

    catalog = [
        {"brand": brand, "models": models_list}
        for brand, models_list in brands.items()
    ]

    return {"stat": "success", "data": catalog}


# ============================================================
# Admin: Sync
# ============================================================

@app.post("/admin/sync/now")
async def admin_sync_now(background_tasks: BackgroundTasks):
    """Trigger an immediate full sync."""
    svc = _get_sync_service()
    try:
        async for session in _get_db_session():
            result = await svc.full_sync(session)
            break
        return {"stat": "success", "result": result}
    except Exception as e:
        return {"stat": "fail", "reason": str(e)}


@app.get("/admin/sync/status")
async def admin_sync_status(db: AsyncSession = Depends(get_db)):
    """Get the most recent sync status."""
    result = await db.execute(
        select(SyncLog).order_by(desc(SyncLog.started_at)).limit(1)
    )
    log = result.scalar_one_or_none()
    if log:
        return {
            "stat": "success",
            "data": {
                "id": log.id, "sync_type": log.sync_type,
                "started_at": str(log.started_at), "finished_at": str(log.finished_at),
                "status": log.status, "motors_count": log.motors_count,
                "parts_count": log.parts_count, "additems_count": log.additems_count,
                "images_count": log.images_count, "error_message": log.error_message
            }
        }
    return {"stat": "success", "data": None}


@app.get("/admin/sync/history")
async def admin_sync_history(db: AsyncSession = Depends(get_db), limit: int = 20):
    """Get sync history."""
    result = await db.execute(
        select(SyncLog).order_by(desc(SyncLog.started_at)).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "stat": "success",
        "data": [{
            "id": l.id, "sync_type": l.sync_type,
            "started_at": str(l.started_at), "finished_at": str(l.finished_at),
            "status": l.status, "motors_count": l.motors_count,
            "parts_count": l.parts_count, "additems_count": l.additems_count,
            "images_count": l.images_count, "error_message": l.error_message
        } for l in logs]
    }


# ============================================================
# Static file serving
# ============================================================

if UPLOADS_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Serve original static frontend as reference (if present). The Next.js frontend
# is served separately (next dev / next start) and talks to this API.
ORIGINAL_DIR = Path(__file__).parent / "static" / "PC"
if ORIGINAL_DIR.exists():
    app.mount("/tools/PC", StaticFiles(directory=str(ORIGINAL_DIR), html=True), name="frontend")


@app.get("/")
async def root():
    return {"name": "电改模拟工具 API", "version": "2.0.0", "database": "PostgreSQL", "status": "running"}


# ============================================================
# Admin: activation (kept for compatibility / management)
# ============================================================

@app.post("/admin/activate")
async def admin_activate(code: str = Form(...), db: AsyncSession = Depends(get_db)):
    """Register an activation code."""
    result = await db.execute(select(ActivationCode).where(ActivationCode.code == code))
    if result.scalar_one_or_none():
        return {"stat": "fail", "message": f"Activation code '{code}' already exists"}

    activation = ActivationCode(
        code=code,
        activated_at=int(time.time() * 1000),
        expires_at=int(time.time() * 1000) + 365 * 24 * 60 * 60 * 1000
    )
    db.add(activation)
    await db.flush()
    return {"stat": "success", "message": f"Activation code '{code}' registered"}


@app.post("/admin/import/parts")
async def admin_import_parts(request: Request, db: AsyncSession = Depends(get_db)):
    """Import parts data from JSON array."""
    try:
        form = await request.form()
        data_str = form.get("data", "[]")
        parts_data = json.loads(data_str)

        count = 0
        for p in parts_data:
            part = Part(
                type=p.get("type", ""), brand=p.get("brand", ""),
                name=p.get("name", ""), concise=p.get("concise", ""),
                size=p.get("size", ""), color=p.get("color", ""),
                product_id=p.get("product_id", ""), body_angle=p.get("bodyAngle", ""),
                position=p.get("position", ""), describe=p.get("describe", ""),
                top_time=str(p.get("topTime", "0"))
            )
            db.add(part)
            count += 1

        await db.flush()
        return {"stat": "success", "count": count}
    except Exception as e:
        await db.rollback()
        return {"stat": "fail", "reason": str(e)}


@app.post("/admin/import/motors")
async def admin_import_motors(request: Request, db: AsyncSession = Depends(get_db)):
    """Import motors data from JSON array."""
    try:
        form = await request.form()
        data_str = form.get("data", "[]")
        motors_data = json.loads(data_str)

        count = 0
        for m in motors_data:
            motor = Motor(
                brand=m.get("brand", ""), name=m.get("name", ""),
                type=m.get("type", ""), color=m.get("color", ""),
                size=m.get("size", ""), concise=m.get("concise", ""),
                describe=m.get("describe", ""), picsrc1=m.get("picsrc1", ""),
                picsrc2=m.get("picsrc2", ""), top_time=str(m.get("topTime", "0"))
            )
            db.add(motor)
            count += 1

        await db.flush()
        return {"stat": "success", "count": count}
    except Exception as e:
        await db.rollback()
        return {"stat": "fail", "reason": str(e)}


@app.post("/admin/import/additems")
async def admin_import_additems(request: Request, db: AsyncSession = Depends(get_db)):
    """Import add-on items data from JSON array."""
    try:
        form = await request.form()
        data_str = form.get("data", "[]")
        items_data = json.loads(data_str)

        count = 0
        for item in items_data:
            add_item = AddItem(
                brand=item.get("brand", ""), name=item.get("name", ""),
                type=item.get("type", ""), car_name=item.get("car_name", ""),
                product_id=item.get("product_id", ""), picsrc=item.get("picsrc", ""),
                describe=item.get("describe", ""), price=item.get("price", "")
            )
            db.add(add_item)
            count += 1

        await db.flush()
        return {"stat": "success", "count": count}
    except Exception as e:
        await db.rollback()
        return {"stat": "fail", "reason": str(e)}


@app.post("/admin/import/catalog")
async def admin_import_catalog(request: Request, db: AsyncSession = Depends(get_db)):
    """Import vehicle catalog data from JSON."""
    try:
        form = await request.form()
        data_str = form.get("data", "[]")
        catalog = json.loads(data_str)

        count = 0
        for brand_entry in catalog:
            brand = brand_entry.get("brand", "")
            for model in brand_entry.get("models", []):
                vehicle = VehicleModel(
                    brand=brand,
                    name=model.get("name", ""),
                    category=model.get("category", ""),
                    image=model.get("image", ""),
                    model_index=model.get("index", 0),
                )
                db.add(vehicle)
                count += 1

        await db.flush()
        return {"stat": "success", "count": count}
    except Exception as e:
        await db.rollback()
        return {"stat": "fail", "reason": str(e)}


# ============================================================
# Admin: import full Vuex store data exported from an authorized
# original-site Chrome page. Data originates from a page the user
# legitimately opened; the local replica performs no original-site
# activation or binding bypass.
# ============================================================

def _dig(obj, *paths, default=""):
    """Try multiple dotted paths on a dict, return first non-empty value."""
    for path in paths:
        cur = obj
        ok = True
        for key in path.split("."):
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                ok = False
                break
        if ok and cur not in (None, "", [], {}):
            return cur
    return default


@app.post("/admin/import/store-data")
async def admin_import_store_data(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Import the full Vuex store.state exported from the user's authorized
    original-site Chrome page. Accepts a form field `data` containing JSON:
      { motor_list, accessory_list, add_item_list, accessKey_code, accessKey_time }
    Idempotent upsert; raw item preserved in raw_data.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    try:
        form = await request.form()
        data_str = form.get("data", "{}")
        store = json.loads(data_str) if data_str else {}

        motor_list = store.get("motor_list") or []
        accessory_list = store.get("accessory_list") or []
        add_item_list = store.get("add_item_list") or []

        now = datetime.utcnow()
        motors_upserted = 0
        parts_upserted = 0
        additems_upserted = 0
        parts_skipped = 0
        errors = []

        async def _upsert(stmt):
            """Run an upsert inside a nested savepoint so one bad row
            doesn't abort the whole batch."""
            try:
                async with db.begin_nested():
                    await db.execute(stmt)
                return True
            except Exception as e:
                errors.append({"msg": f"{type(e).__name__}: {str(e)[:200]}"})
                return False

        # --- Motors: upsert by (brand, name) ---
        for m in motor_list:
            brand = _dig(m, "brand", default="")
            name = _dig(m, "name", default="")
            if not brand or not name:
                continue
            row = {
                "brand": brand,
                "name": name,
                "type": _dig(m, "info.overview.type", "type", default=""),
                "color": _dig(m, "info.overview.color", "color", default=""),
                "size": _dig(m, "info.overview.size", "size", default=""),
                "concise": _dig(m, "concise", "info.concise", default=""),
                "describe": _dig(m, "describe", "info.overview.describe", default=""),
                "picsrc1": _dig(m, "picsrc", "picsrc1", default=""),
                "picsrc2": _dig(m, "omitsrc", "picsrc2", default=""),
                "top_time": str(_dig(m, "topTime", "top_time", default="0")),
                "raw_data": json.dumps(m, ensure_ascii=False),
                "last_synced_at": now,
                "updated_at": now,
            }
            stmt = pg_insert(Motor).values(**row).on_conflict_do_update(
                index_elements=["brand", "name"],
                set_={k: row[k] for k in ("type", "color", "size", "concise",
                                          "describe", "picsrc1", "picsrc2",
                                          "top_time", "raw_data",
                                          "last_synced_at", "updated_at")},
            )
            if await _upsert(stmt):
                motors_upserted += 1

        # --- Parts (accessory_list): no product_id in original store, so
        # synthesize a stable one from (brand, name, type, picsrc1); upsert by it.
        # Including picsrc1 keeps distinct image variants from collapsing. ---
        for p in accessory_list:
            brand = _dig(p, "brand", default="") or "_unknown"
            name = _dig(p, "name", default="") or "_unknown"
            type_ = _dig(p, "type", default="")
            picsrc1 = _dig(p, "picsrc1", "picsrc", default="")
            product_id = _dig(p, "product_id", "productID", "id", default="") or (
                f"{brand}|{name}|{type_}|{picsrc1}" if picsrc1 else f"{brand}|{name}|{type_}"
            )
            row = {
                "product_id": product_id,
                "type": type_,
                "brand": brand,
                "name": name,
                "concise": _dig(p, "concise", default=""),
                "size": str(_dig(p, "size", default="")),
                "color": str(_dig(p, "color", default="")),
                "body_angle": str(_dig(p, "bodyAngle", "body_angle", "position_y", default="")),
                "position": str(_dig(p, "position", default="")),
                "describe": _dig(p, "describe", default=""),
                "top_time": str(_dig(p, "topTime", "top_time", default="0")),
                "raw_data": json.dumps(p, ensure_ascii=False),
                "last_synced_at": now,
                "updated_at": now,
            }
            stmt = pg_insert(Part).values(**row).on_conflict_do_update(
                index_elements=["product_id"],
                set_={k: row[k] for k in ("type", "brand", "name", "concise",
                                          "size", "color", "body_angle",
                                          "position", "describe", "top_time",
                                          "raw_data", "last_synced_at", "updated_at")},
            )
            if await _upsert(stmt):
                parts_upserted += 1

        # --- AddItems (add_item_list): original has a real product_id; upsert
        # by product_id (full unique index). Synthesize a stable product_id from
        # (brand, car_name, name) for rows that lack one. ---
        for it in add_item_list:
            # brand column holds the car brand (belongCarBrand) so /getAddList
            # can filter by car; the item's own brand stays in raw_data.
            brand = _dig(it, "belongCarBrand", "brand", default="") or "_unknown"
            name = _dig(it, "name", default="") or "_unknown"
            car_name = _dig(it, "belongCarName", "car_name", default="")
            type_ = _dig(it, "type", default="")
            product_id = _dig(it, "product_id", "productID", "id", default="") or f"{brand}|{car_name}|{name}"
            row = {
                "brand": brand,
                "name": name,
                "type": type_,
                "car_name": car_name,
                "product_id": product_id,
                "picsrc": _dig(it, "picsrc1", "picsrc", default=""),
                "describe": _dig(it, "describe", default=""),
                "price": str(_dig(it, "price", default="")),
                "raw_data": json.dumps(it, ensure_ascii=False),
                "last_synced_at": now,
                "updated_at": now,
            }
            stmt = pg_insert(AddItem).values(**row).on_conflict_do_update(
                index_elements=["product_id"],
                set_={k: row[k] for k in ("brand", "name", "type", "car_name",
                                          "picsrc", "describe", "price",
                                          "raw_data", "last_synced_at", "updated_at")},
            )
            if await _upsert(stmt):
                additems_upserted += 1

        await db.flush()

        # Record a sync log entry for this import.
        err_summary = "; ".join(e["msg"] for e in errors[:5])
        if len(errors) > 5:
            err_summary += f"; ... (+{len(errors) - 5} more)"
        log = SyncLog(
            sync_type="store_import",
            started_at=now,
            finished_at=datetime.utcnow(),
            status="success" if not errors else "partial",
            motors_count=motors_upserted,
            parts_count=parts_upserted,
            additems_count=additems_upserted,
            error_message=err_summary,
        )
        db.add(log)
        await db.flush()

        return {
            "stat": "success" if not errors else "partial",
            "data": {
                "motors": motors_upserted,
                "parts": parts_upserted,
                "additems": additems_upserted,
                "parts_skipped_no_id": parts_skipped,
                "errors": len(errors),
                "error_samples": errors[:5],
                "accessKey_code": store.get("accessKey_code", ""),
            },
        }
    except Exception as e:
        logger.exception("store-data import failed")
        await db.rollback()
        return {"stat": "fail", "reason": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3807)
