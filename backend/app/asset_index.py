"""
Image asset index — loads the frontend manifest JSONs, seeds the `assets`
DB table, and provides fast (brand, name, kind) -> path resolution for
the sync / store-import / catalog-import normalization passes.

Manifests (all committed under src/data/):
  - motomate-thumbnail-assets.json : { "brand/name": "/motomate/thumbnails/..." }
  - motomate-line-assets.json      : { "brand/name": "/motomate/lines/..." }
  - motomate-photo-assets.json     : { "brand/name": "/motomate/photos/..." }
  - motomate-catalog.json          : [{ brand, models: [{name,image,...}] }]
                                     (the `image` field = top-level car image)

Seeded assets table columns: brand, name, kind (car|thumbnail|line|photo), path.

Used by:
  - POST /admin/assets/reindex  ->  build_index_from_files() then seed_db()
  - SyncService / store-import  ->  load_index_from_db() + resolve()
"""
import json
import logging
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Asset

logger = logging.getLogger("emotor.asset_index")


def _data_dir() -> Path:
    """Resolve src/data dir. Configurable via MOTOMATE_DATA_DIR env; defaults
    to <repo>/src/data relative to this file (backend/app/...)."""
    env = os.getenv("MOTOMATE_DATA_DIR")
    if env:
        return Path(env)
    return Path(__file__).parent.parent.parent / "src" / "data"


AssetIndex = dict[tuple[str, str], dict[str, str]]


def build_index_from_files(data_dir: Optional[Path] = None) -> AssetIndex:
    """Parse the 4 manifest JSONs into {(brand, name): {kind: path, ...}}.

    The manifests use `brand/name` keys (brand casing preserved from catalog,
    e.g. 'ninebot', 'ZEEKU'). We keep that casing so lookups match the DB
    motors/vehicle_models which use the same brand strings.
    """
    base = data_dir or _data_dir()
    index: AssetIndex = {}

    def _add(brand: str, name: str, kind: str, path: str) -> None:
        if not path:
            return
        key = (brand, name)
        index.setdefault(key, {})[kind] = path

    # Car (top-level /motomate/<Brand>_<Name>.<hash>.png) — from catalog
    catalog_path = base / "motomate-catalog.json"
    if catalog_path.exists():
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            for entry in catalog:
                brand = entry.get("brand", "")
                for model in entry.get("models", []):
                    name = model.get("name", "")
                    img = model.get("image", "")
                    if brand and name and img:
                        _add(brand, name, "car", img)
        except Exception as e:
            logger.warning(f"Failed to load catalog: {e}")

    # Thumbnail / line / photo manifests
    for kind, filename in (
        ("thumbnail", "motomate-thumbnail-assets.json"),
        ("line", "motomate-line-assets.json"),
        ("photo", "motomate-photo-assets.json"),
    ):
        path = base / filename
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for key_str, value in data.items():
                if "/" not in key_str:
                    continue
                brand, name = key_str.split("/", 1)
                _add(brand, name, kind, value)
        except Exception as e:
            logger.warning(f"Failed to load {filename}: {e}")

    logger.info(f"Built asset index: {len(index)} brand/name entries from {base}")
    return index


async def seed_db(db: AsyncSession, index: AssetIndex) -> int:
    """Upsert the index into the assets table. Returns the count upserted."""
    count = 0
    for (brand, name), kinds in index.items():
        for kind, path in kinds.items():
            row = {"brand": brand, "name": name, "kind": kind, "path": path}
            stmt = pg_insert(Asset).values(**row).on_conflict_do_update(
                index_elements=["brand", "name", "kind"],
                set_={"path": row["path"]},
            )
            await db.execute(stmt)
            count += 1
    await db.flush()
    logger.info(f"Seeded assets table: {count} rows")
    return count


async def load_index_from_db(db: AsyncSession) -> AssetIndex:
    """Reload the index from the assets table (fast for sync normalization)."""
    result = await db.execute(select(Asset))
    index: AssetIndex = {}
    for a in result.scalars().all():
        index.setdefault((a.brand, a.name), {})[a.kind] = a.path
    return index


def resolve(
    index: AssetIndex,
    brand: str,
    name: str,
    *kinds: str,
) -> str:
    """Return the first non-empty path among `kinds` for (brand, name).

    Tries exact (brand, name) first; falls back to case-insensitive brand
    match if no exact entry. Returns empty string if nothing resolves.
    """
    if not index or not brand or not name:
        return ""
    exact = index.get((brand, name))
    if exact:
        for kind in kinds:
            if exact.get(kind):
                return exact[kind]
    # Case-insensitive brand fallback
    lower_brand = brand.lower()
    for (b, n), kinds_dict in index.items():
        if b.lower() == lower_brand and b != brand and n == name:
            for kind in kinds:
                if kinds_dict.get(kind):
                    return kinds_dict[kind]
            break
    return ""


def normalize_image_path(
    index: AssetIndex,
    original: str,
    brand: str,
    name: str,
) -> str:
    """Given a possibly-dead upstream image path (e.g. @/assets/car/X.png),
    resolve it to a real /motomate/... path via the asset index.

    Rules:
      * If original is already a real path (starts with /motomate/) or an
        http(s) URL (real upstream URL; sync_images downloads it later), keep it.
      * If it's empty, try to fill from the index (car -> thumbnail -> line -> photo).
      * If it's a dead alias, replace with the index-resolved car/thumbnail/line.
      * If the index has nothing for this (brand,name), keep original untouched.
    """
    if not original:
        return resolve(index, brand, name, "car", "thumbnail", "line", "photo")
    if original.startswith("/motomate/") or original.startswith("http"):
        return original
    # Likely a dead alias — try to replace with a real path
    resolved = resolve(index, brand, name, "car", "thumbnail", "line", "photo")
    return resolved or original


def normalize_motor_picsrc(
    index: AssetIndex,
    original: str,
    brand: str,
    name: str,
    which: int,
) -> str:
    """Role-aware normalization for Motor rows.

    * picsrc1 (which=1): the "car" main image, fall back to thumbnail / line / photo.
    * picsrc2 (which=2): the "omit" line drawing, prefer line, fall back to
      thumbnail / car / photo.

    If the upstream path is already a real /motomate/... path or an http URL,
    keep it verbatim. Empty or dead alias → resolve by role.
    """
    if not original:
        kinds = ("car", "thumbnail", "line", "photo") if which == 1 else ("line", "thumbnail", "car", "photo")
        return resolve(index, brand, name, *kinds)
    if original.startswith("/motomate/") or original.startswith("http"):
        return original
    kinds = ("car", "thumbnail", "line", "photo") if which == 1 else ("line", "thumbnail", "car", "photo")
    resolved = resolve(index, brand, name, *kinds)
    return resolved or original
