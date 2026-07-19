"""
Sync service — pulls data from original site and upserts into local DB.

Three sync modes:
  * full_sync        — pull everything, upsert everything.
  * incremental_sync — pull everything (upstream has no 'since' filter), but
    only upsert rows whose raw_data differs from the local copy (plus new rows).
    Saves DB writes + image downloads, NOT upstream bandwidth.
  * selective_sync   — caller picks brands / types / product_ids per resource;
    only those are pulled and upserted.

A module-level asyncio.Lock serializes all three so a scheduled run and a
manual trigger can't race into a second SyncService instance.
"""
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .upstream_client import UpstreamClient
from .models import Motor, Part, AddItem, SyncLog
from .config import UPLOADS_DIR
from . import asset_index

logger = logging.getLogger("emotor.sync")

IMAGES_DIR = Path(UPLOADS_DIR) if UPLOADS_DIR else Path(__file__).parent / "uploads"

# Serialize full / incremental / selective runs so the scheduler and a manual
# /admin/sync/* trigger can't both run at once.
_sync_lock = asyncio.Lock()


class SyncService:
    """Syncs data from the original site to the local database."""

    def __init__(self):
        self.client = UpstreamClient()

    # ============================================================
    # Row builders + upsert helpers (shared by all three modes)
    # ============================================================

    @staticmethod
    def _motor_row(m: dict, assets: asset_index.AssetIndex = None) -> dict:
        raw_picsrc1 = m.get("picsrc1", "")
        raw_picsrc2 = m.get("picsrc2", "")
        row = {
            "brand": m.get("brand", ""),
            "name": m.get("name", ""),
            "type": m.get("type", ""),
            "color": m.get("color", ""),
            "size": m.get("size", ""),
            "concise": m.get("concise", ""),
            "describe": m.get("describe", ""),
            "picsrc1": raw_picsrc1,
            "picsrc2": raw_picsrc2,
            "top_time": str(m.get("topTime", "0")),
            "raw_data": json.dumps(m, ensure_ascii=False),
        }
        if assets:
            row["picsrc1"] = asset_index.normalize_motor_picsrc(
                assets, raw_picsrc1, row["brand"], row["name"], 1
            )
            row["picsrc2"] = asset_index.normalize_motor_picsrc(
                assets, raw_picsrc2, row["brand"], row["name"], 2
            )
        return row

    @staticmethod
    def _part_row_from_str(part_str: str) -> Optional[dict]:
        """Build a part row from an original-site underscore-separated string."""
        fields = part_str.split("_")
        if len(fields) < 7:
            return None
        pid = fields[6] if len(fields) > 6 else ""
        if not pid:
            return None
        return {
            "type": fields[0] if len(fields) > 0 else "",
            "brand": fields[1] if len(fields) > 1 else "",
            "name": fields[2] if len(fields) > 2 else "",
            "concise": fields[3] if len(fields) > 3 else "",
            "size": fields[4] if len(fields) > 4 else "",
            "color": fields[5] if len(fields) > 5 else "",
            "product_id": pid,
            "body_angle": fields[7] if len(fields) > 7 else "",
            "position": fields[8] if len(fields) > 8 else "",
            "describe": fields[9] if len(fields) > 9 else "",
            "top_time": fields[10] if len(fields) > 10 else "0",
            "raw_data": part_str,
        }

    @staticmethod
    def _part_row_from_info(info: dict) -> Optional[dict]:
        """Build a part row from a loadPartInfo response data dict
        (camelCase keys)."""
        pid = info.get("product_id", "")
        if not pid:
            return None
        return {
            "type": info.get("type", ""),
            "brand": info.get("brand", ""),
            "name": info.get("name", ""),
            "concise": info.get("concise", ""),
            "size": info.get("size", ""),
            "color": info.get("color", ""),
            "product_id": pid,
            "body_angle": info.get("bodyAngle", ""),
            "position": info.get("position", ""),
            "describe": info.get("describe", ""),
            "top_time": str(info.get("topTime", "0")),
            "raw_data": json.dumps(info, ensure_ascii=False),
        }

    @staticmethod
    def _additem_row(item: dict) -> dict:
        return {
            "brand": item.get("brand", ""),
            "name": item.get("name", ""),
            "type": item.get("type", ""),
            "car_name": item.get("car_name", ""),
            "product_id": item.get("product_id", ""),
            "picsrc": item.get("picsrc", ""),
            "describe": item.get("describe", ""),
            "price": str(item.get("price", "")),
            "raw_data": json.dumps(item, ensure_ascii=False),
        }

    async def _upsert_motor(self, db: AsyncSession, m: dict,
                            assets: asset_index.AssetIndex = None) -> bool:
        row = self._motor_row(m, assets)
        now = datetime.utcnow()
        stmt = pg_insert(Motor).values(
            **row, last_synced_at=now, updated_at=now
        ).on_conflict_do_update(
            index_elements=["brand", "name"],
            set_={**{k: row[k] for k in row if k != "brand" and k != "name"},
                  "last_synced_at": now, "updated_at": now},
        )
        await db.execute(stmt)
        return True

    async def _upsert_part(self, db: AsyncSession, row: dict) -> bool:
        now = datetime.utcnow()
        stmt = pg_insert(Part).values(
            **row, last_synced_at=now, updated_at=now
        ).on_conflict_do_update(
            index_elements=["product_id"],
            set_={**{k: row[k] for k in row if k != "product_id"},
                  "last_synced_at": now, "updated_at": now},
        )
        await db.execute(stmt)
        return True

    async def _upsert_additem(self, db: AsyncSession, item: dict) -> bool:
        row = self._additem_row(item)
        now = datetime.utcnow()
        stmt = pg_insert(AddItem).values(
            **row, last_synced_at=now, updated_at=now
        ).on_conflict_do_update(
            index_elements=["product_id"],
            set_={**{k: row[k] for k in row if k != "product_id"},
                  "last_synced_at": now, "updated_at": now},
        )
        await db.execute(stmt)
        return True

    # ============================================================
    # Full sync
    # ============================================================

    async def full_sync(self, db: AsyncSession) -> dict:
        """Run a complete sync of all data types."""
        async with _sync_lock:
            log = SyncLog(sync_type="full", status="running")
            db.add(log)
            await db.flush()

            result = {"motors": 0, "parts": 0, "additems": 0, "images": 0}
            error = None
            try:
                assets = await asset_index.load_index_from_db(db)
                result["motors"] = await self.sync_motors(db, assets)
                result["parts"] = await self.sync_parts(db)
                result["additems"] = await self.sync_additems(db)
                result["images"] = await self.sync_images(db)
                log.status = "completed"
            except Exception as e:
                log.status = "failed"
                log.error_message = str(e)
                error = e
                logger.error(f"Full sync failed: {e}")

            log.finished_at = datetime.utcnow()
            log.motors_count = result["motors"]
            log.parts_count = result["parts"]
            log.additems_count = result["additems"]
            log.images_count = result["images"]
            await db.flush()

            if error:
                raise error
            return result

    # ---- Motor sync ----

    async def sync_motors(self, db: AsyncSession,
                          assets: asset_index.AssetIndex = None) -> int:
        """Sync motors from original site (full)."""
        logger.info("Syncing motors...")
        resp = self.client.get_tools()
        if not resp or resp.get("stat") != "success":
            logger.warning("Motor sync: no data from upstream")
            return 0

        motor_list = resp.get("motor_list", [])
        count = 0
        for m in motor_list:
            if await self._upsert_motor(db, m, assets):
                count += 1

        await db.flush()
        logger.info(f"Motor sync: {count} upserted")
        return count

    # ---- Part sync ----

    async def sync_parts(self, db: AsyncSession) -> int:
        """Sync parts from original site (full)."""
        logger.info("Syncing parts...")
        resp = self.client.get_part_list()
        if not resp or resp.get("stat") != "success":
            logger.warning("Part sync: no data from upstream")
            return 0

        parts_data = resp.get("data", [])
        count = 0
        for part_str in parts_data:
            row = self._part_row_from_str(part_str)
            if not row:
                continue
            if await self._upsert_part(db, row):
                count += 1

        await db.flush()
        logger.info(f"Part sync: {count} upserted")
        return count

    # ---- AddItem sync ----

    async def sync_additems(self, db: AsyncSession) -> int:
        """Sync add-on items from original site (full).

        Upserts by product_id (full unique index uq_additem_product_id,
        migration 004). Items with empty product_id are inserted as-is.
        """
        logger.info("Syncing add-on items...")

        # Get distinct brands from motors
        result = await db.execute(select(Motor.brand).distinct())
        brands = [r[0] for r in result.all() if r[0]]
        if not brands:
            brands = ["NIU", "ZEEHO", "Ninebot", "ZEEKU", "YADEA", "Honda", "YAMAHA", "TAILG", "SYUAN"]

        total = 0
        for brand in brands[:20]:
            resp = self.client.get_add_list(brand)
            if not resp or resp.get("stat") != "success":
                continue
            items = resp.get("data", [])
            for item in items:
                if await self._upsert_additem(db, item):
                    total += 1
            logger.info(f"  AddItem sync: {brand} → {len(items)} items")

        await db.flush()
        logger.info(f"AddItem sync: {total} total upserted")
        return total

    # ============================================================
    # Incremental sync
    # ============================================================

    async def _last_completed_at(self, db: AsyncSession):
        """Watermark = most recent finished_at among completed full/incremental
        sync logs. Used for reporting only; the diff is keyed on raw_data."""
        stmt = (
            select(func.max(SyncLog.finished_at))
            .where(SyncLog.status == "completed")
            .where(SyncLog.sync_type.in_(["full", "incremental"]))
        )
        return (await db.execute(stmt)).scalar()

    async def incremental_sync(self, db: AsyncSession) -> dict:
        """Fetch full upstream lists but only upsert rows whose raw_data differs
        from the local copy (plus new rows)."""
        async with _sync_lock:
            log = SyncLog(sync_type="incremental", status="running")
            db.add(log)
            await db.flush()

            result = {"motors": 0, "parts": 0, "additems": 0, "images": 0,
                      "skipped": 0, "since": None}
            error = None
            try:
                result["since"] = (await self._last_completed_at(db))
                assets = await asset_index.load_index_from_db(db)
                m = await self._incremental_motors(db, assets)
                p = await self._incremental_parts(db)
                a = await self._incremental_additems(db)
                result["motors"] = m["upserted"]
                result["parts"] = p["upserted"]
                result["additems"] = a["upserted"]
                result["skipped"] = m["skipped"] + p["skipped"] + a["skipped"]
                log.status = "completed"
            except Exception as e:
                log.status = "failed"
                log.error_message = str(e)
                error = e
                logger.error(f"Incremental sync failed: {e}")

            log.finished_at = datetime.utcnow()
            log.motors_count = result["motors"]
            log.parts_count = result["parts"]
            log.additems_count = result["additems"]
            log.images_count = result["images"]
            await db.flush()

            if error:
                raise error
            return result

    async def _incremental_motors(self, db: AsyncSession,
                                   assets: asset_index.AssetIndex = None) -> dict:
        resp = self.client.get_tools()
        if not resp or resp.get("stat") != "success":
            return {"upserted": 0, "skipped": 0}
        motor_list = resp.get("motor_list", [])

        # existing (brand,name) -> raw_data
        rows = (await db.execute(select(Motor.brand, Motor.name, Motor.raw_data))).all()
        existing = {(b, n): (r or "") for (b, n, r) in rows}

        upserted = skipped = 0
        for m in motor_list:
            raw = json.dumps(m, ensure_ascii=False)
            key = (m.get("brand", ""), m.get("name", ""))
            if key in existing and existing[key] == raw:
                skipped += 1
                continue
            await self._upsert_motor(db, m, assets)
            upserted += 1
        await db.flush()
        logger.info(f"Motor incremental: {upserted} upserted, {skipped} skipped")
        return {"upserted": upserted, "skipped": skipped}

    async def _incremental_parts(self, db: AsyncSession) -> dict:
        resp = self.client.get_part_list()
        if not resp or resp.get("stat") != "success":
            return {"upserted": 0, "skipped": 0}
        parts_data = resp.get("data", [])

        rows = (await db.execute(select(Part.product_id, Part.raw_data))).all()
        existing = {pid: (r or "") for (pid, r) in rows if pid}

        upserted = skipped = 0
        for part_str in parts_data:
            row = self._part_row_from_str(part_str)
            if not row:
                continue
            if row["product_id"] in existing and existing[row["product_id"]] == row["raw_data"]:
                skipped += 1
                continue
            await self._upsert_part(db, row)
            upserted += 1
        await db.flush()
        logger.info(f"Part incremental: {upserted} upserted, {skipped} skipped")
        return {"upserted": upserted, "skipped": skipped}

    async def _incremental_additems(self, db: AsyncSession) -> dict:
        # existing product_id -> raw_data
        rows = (await db.execute(select(AddItem.product_id, AddItem.raw_data))).all()
        existing = {pid: (r or "") for (pid, r) in rows if pid}

        # iterate the same brand list as full sync
        result = await db.execute(select(Motor.brand).distinct())
        brands = [r[0] for r in result.all() if r[0]]
        if not brands:
            brands = ["NIU", "ZEEHO", "Ninebot", "ZEEKU", "YADEA", "Honda", "YAMAHA", "TAILG", "SYUAN"]

        upserted = skipped = 0
        for brand in brands[:20]:
            resp = self.client.get_add_list(brand)
            if not resp or resp.get("stat") != "success":
                continue
            for item in resp.get("data", []):
                raw = json.dumps(item, ensure_ascii=False)
                pid = item.get("product_id", "")
                if pid and pid in existing and existing[pid] == raw:
                    skipped += 1
                    continue
                await self._upsert_additem(db, item)
                upserted += 1
        await db.flush()
        logger.info(f"AddItem incremental: {upserted} upserted, {skipped} skipped")
        return {"upserted": upserted, "skipped": skipped}

    # ============================================================
    # Selective sync
    # ============================================================

    @staticmethod
    def _filter_spec(spec: dict) -> tuple[set, set, list]:
        brands = set(spec.get("brands") or [])
        types = set(spec.get("types") or [])
        product_ids = list(spec.get("product_ids") or [])
        return brands, types, product_ids

    async def selective_sync(self, db: AsyncSession, body: dict) -> dict:
        """Pull only caller-selected rows.

        body (every block optional):
          motors:   {brands:[], types:[]}
          parts:    {brands:[], types:[], product_ids:[]}
          additems: {brands:[], types:[], product_ids:[]}
          download_images: bool
        brands/types filter the full upstream lists client-side;
        product_ids pulls single items via load_part_info / load_additem_info.
        """
        async with _sync_lock:
            log = SyncLog(sync_type="selective", status="running")
            db.add(log)
            await db.flush()

            result = {"motors": 0, "parts": 0, "additems": 0, "images": 0}
            error = None
            try:
                assets = await asset_index.load_index_from_db(db)
                if body.get("motors"):
                    result["motors"] = await self._selective_motors(db, body["motors"], assets)
                if body.get("parts"):
                    result["parts"] = await self._selective_parts(db, body["parts"])
                if body.get("additems"):
                    result["additems"] = await self._selective_additems(db, body["additems"])
                if body.get("download_images"):
                    result["images"] = await self.sync_images(db)
                log.status = "completed"
            except Exception as e:
                log.status = "failed"
                log.error_message = str(e)
                error = e
                logger.error(f"Selective sync failed: {e}")

            log.finished_at = datetime.utcnow()
            log.motors_count = result["motors"]
            log.parts_count = result["parts"]
            log.additems_count = result["additems"]
            log.images_count = result["images"]
            await db.flush()

            if error:
                raise error
            return result

    async def _selective_motors(self, db: AsyncSession, spec: dict,
                                 assets: asset_index.AssetIndex = None) -> int:
        brands, types, _ = self._filter_spec(spec)
        resp = self.client.get_tools()
        if not resp or resp.get("stat") != "success":
            return 0
        motor_list = resp.get("motor_list", [])
        count = 0
        for m in motor_list:
            if brands and m.get("brand", "") not in brands:
                continue
            if types and m.get("type", "") not in types:
                continue
            if await self._upsert_motor(db, m, assets):
                count += 1
        await db.flush()
        logger.info(f"Motor selective: {count} upserted")
        return count

    async def _selective_parts(self, db: AsyncSession, spec: dict) -> int:
        brands, types, product_ids = self._filter_spec(spec)
        count = 0

        # 1) full-list filtering by brand/type
        if brands or types:
            resp = self.client.get_part_list()
            if resp and resp.get("stat") == "success":
                for part_str in resp.get("data", []):
                    row = self._part_row_from_str(part_str)
                    if not row:
                        continue
                    if brands and row["brand"] not in brands:
                        continue
                    if types and row["type"] not in types:
                        continue
                    if await self._upsert_part(db, row):
                        count += 1

        # 2) explicit product_ids via per-id fetch
        for pid in product_ids:
            if not pid:
                continue
            resp = self.client.load_part_info(pid)
            if not resp or resp.get("stat") != "success":
                logger.warning(f"load_part_info {pid}: no data")
                continue
            row = self._part_row_from_info(resp.get("data", {}))
            if not row:
                continue
            if await self._upsert_part(db, row):
                count += 1

        await db.flush()
        logger.info(f"Part selective: {count} upserted")
        return count

    async def _selective_additems(self, db: AsyncSession, spec: dict) -> int:
        brands, types, product_ids = self._filter_spec(spec)
        count = 0

        # 1) per-brand fetch filtered by type
        if brands:
            for brand in brands:
                resp = self.client.get_add_list(brand)
                if not resp or resp.get("stat") != "success":
                    continue
                for item in resp.get("data", []):
                    if types and item.get("type", "") not in types:
                        continue
                    if await self._upsert_additem(db, item):
                        count += 1

        # 2) explicit product_ids via per-id fetch
        for pid in product_ids:
            if not pid:
                continue
            resp = self.client.load_additem_info(pid)
            if not resp or resp.get("stat") != "success":
                logger.warning(f"load_additem_info {pid}: no data")
                continue
            item = resp.get("data", {})
            if not item:
                continue
            if await self._upsert_additem(db, item):
                count += 1

        await db.flush()
        logger.info(f"AddItem selective: {count} upserted")
        return count

    # ============================================================
    # Image sync
    # ============================================================

    async def sync_images(self, db: AsyncSession) -> int:
        """Download missing images from original site."""
        logger.info("Syncing images...")
        downloaded = 0

        # Motor images
        result = await db.execute(select(Motor))
        for motor in result.scalars().all():
            for src_key in ["picsrc1", "picsrc2"]:
                src = getattr(motor, src_key, "")
                if src and src.startswith("http"):
                    local_path = IMAGES_DIR / "motor_images" / Path(src).name
                    if not local_path.exists() or local_path.stat().st_size == 0:
                        if self.client.download_asset(src, str(local_path)):
                            downloaded += 1

        # Part images
        result = await db.execute(select(Part))
        for part in result.scalars().all():
            pid = part.product_id
            if not pid:
                continue
            for img_num in ["1", "2"]:
                img_path = f"/uploads/partImg/{pid}/{pid}_{img_num}.png"
                local_path = IMAGES_DIR / "partImg" / pid / f"{pid}_{img_num}.png"
                if not local_path.exists() or local_path.stat().st_size == 0:
                    if self.client.download_asset(img_path, str(local_path)):
                        downloaded += 1

        # AddItem images
        result = await db.execute(select(AddItem))
        for item in result.scalars().all():
            src = item.picsrc
            if src and src.startswith("http"):
                local_path = IMAGES_DIR / "additem_images" / Path(src).name
                if not local_path.exists() or local_path.stat().st_size == 0:
                    if self.client.download_asset(src, str(local_path)):
                        downloaded += 1

        logger.info(f"Image sync: {downloaded} downloaded")
        return downloaded
