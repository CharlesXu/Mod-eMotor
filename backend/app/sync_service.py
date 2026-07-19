"""
Sync service — pulls data from original site and upserts into local DB.
"""
import json
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .upstream_client import UpstreamClient
from .models import Motor, Part, AddItem, SyncLog
from .config import UPLOADS_DIR

logger = logging.getLogger("emotor.sync")

IMAGES_DIR = Path(UPLOADS_DIR) if UPLOADS_DIR else Path(__file__).parent / "uploads"


class SyncService:
    """Syncs data from the original site to the local database."""

    def __init__(self):
        self.client = UpstreamClient()

    # ---- Full sync ----

    async def full_sync(self, db: AsyncSession) -> dict:
        """Run a complete sync of all data types."""
        log = SyncLog(sync_type="full", status="running")
        db.add(log)
        await db.flush()

        result = {"motors": 0, "parts": 0, "additems": 0, "images": 0}
        error = None

        try:
            result["motors"] = await self.sync_motors(db)
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

    async def sync_motors(self, db: AsyncSession) -> int:
        """Sync motors from original site."""
        logger.info("Syncing motors...")
        resp = self.client.get_tools()
        if not resp or resp.get("stat") != "success":
            logger.warning("Motor sync: no data from upstream")
            return 0

        motor_list = resp.get("motor_list", [])
        count = 0
        for m in motor_list:
            raw = json.dumps(m, ensure_ascii=False)
            stmt = pg_insert(Motor).values(
                brand=m.get("brand", ""),
                name=m.get("name", ""),
                type=m.get("type", ""),
                color=m.get("color", ""),
                size=m.get("size", ""),
                concise=m.get("concise", ""),
                describe=m.get("describe", ""),
                picsrc1=m.get("picsrc1", ""),
                picsrc2=m.get("picsrc2", ""),
                top_time=str(m.get("topTime", "0")),
                raw_data=raw,
                last_synced_at=datetime.utcnow(),
            ).on_conflict_do_update(
                index_elements=["brand", "name"],
                set_={
                    "type": m.get("type", ""),
                    "color": m.get("color", ""),
                    "size": m.get("size", ""),
                    "concise": m.get("concise", ""),
                    "describe": m.get("describe", ""),
                    "picsrc1": m.get("picsrc1", ""),
                    "picsrc2": m.get("picsrc2", ""),
                    "top_time": str(m.get("topTime", "0")),
                    "raw_data": raw,
                    "last_synced_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            )
            await db.execute(stmt)
            count += 1

        await db.flush()
        logger.info(f"Motor sync: {count} upserted")
        return count

    # ---- Part sync ----

    async def sync_parts(self, db: AsyncSession) -> int:
        """Sync parts from original site."""
        logger.info("Syncing parts...")
        resp = self.client.get_part_list()
        if not resp or resp.get("stat") != "success":
            logger.warning("Part sync: no data from upstream")
            return 0

        parts_data = resp.get("data", [])
        count = 0
        for part_str in parts_data:
            fields = part_str.split("_")
            if len(fields) < 7:
                continue
            pid = fields[6] if len(fields) > 6 else ""
            if not pid:
                continue

            raw = part_str
            stmt = pg_insert(Part).values(
                type=fields[0] if len(fields) > 0 else "",
                brand=fields[1] if len(fields) > 1 else "",
                name=fields[2] if len(fields) > 2 else "",
                concise=fields[3] if len(fields) > 3 else "",
                size=fields[4] if len(fields) > 4 else "",
                color=fields[5] if len(fields) > 5 else "",
                product_id=pid,
                body_angle=fields[7] if len(fields) > 7 else "",
                position=fields[8] if len(fields) > 8 else "",
                describe=fields[9] if len(fields) > 9 else "",
                top_time=fields[10] if len(fields) > 10 else "0",
                raw_data=raw,
                last_synced_at=datetime.utcnow(),
            ).on_conflict_do_update(
                index_elements=["product_id"],
                set_={
                    "type": fields[0] if len(fields) > 0 else "",
                    "brand": fields[1] if len(fields) > 1 else "",
                    "name": fields[2] if len(fields) > 2 else "",
                    "concise": fields[3] if len(fields) > 3 else "",
                    "size": fields[4] if len(fields) > 4 else "",
                    "color": fields[5] if len(fields) > 5 else "",
                    "body_angle": fields[7] if len(fields) > 7 else "",
                    "position": fields[8] if len(fields) > 8 else "",
                    "describe": fields[9] if len(fields) > 9 else "",
                    "top_time": fields[10] if len(fields) > 10 else "0",
                    "raw_data": raw,
                    "last_synced_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            )
            await db.execute(stmt)
            count += 1

        await db.flush()
        logger.info(f"Part sync: {count} upserted")
        return count

    # ---- AddItem sync ----

    async def sync_additems(self, db: AsyncSession) -> int:
        """Sync add-on items from original site."""
        logger.info("Syncing add-on items...")

        # Get distinct brands from motors
        result = await db.execute(select(Motor.brand).distinct())
        brands = [r[0] for r in result.all() if r[0]]
        if not brands:
            # Fallback brands
            brands = ["NIU", "ZEEHO", "Ninebot", "ZEEKU", "YADEA", "Honda", "YAMAHA", "TAILG", "SYUAN"]

        total = 0
        for brand in brands[:20]:
            resp = self.client.get_add_list(brand)
            if not resp or resp.get("stat") != "success":
                continue
            items = resp.get("data", [])
            for item in items:
                raw = json.dumps(item, ensure_ascii=False)
                stmt = pg_insert(AddItem).values(
                    brand=item.get("brand", ""),
                    name=item.get("name", ""),
                    type=item.get("type", ""),
                    car_name=item.get("car_name", ""),
                    product_id=item.get("product_id", ""),
                    picsrc=item.get("picsrc", ""),
                    describe=item.get("describe", ""),
                    price=item.get("price", ""),
                    raw_data=raw,
                    last_synced_at=datetime.utcnow(),
                ).on_conflict_do_update(
                    index_elements=["brand", "car_name", "type", "name"],
                    set_={
                        "product_id": item.get("product_id", ""),
                        "picsrc": item.get("picsrc", ""),
                        "describe": item.get("describe", ""),
                        "price": item.get("price", ""),
                        "raw_data": raw,
                        "last_synced_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                )
                await db.execute(stmt)
                total += 1
            logger.info(f"  AddItem sync: {brand} → {len(items)} items")

        await db.flush()
        logger.info(f"AddItem sync: {total} total upserted")
        return total

    # ---- Image sync ----

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