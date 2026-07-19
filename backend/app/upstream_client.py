"""
Original site API client.
Encapsulates all calls to the upstream motomate API.
"""
import json
import time
import urllib.request
import urllib.error
import logging
from pathlib import Path
from typing import Optional

from .crypto_utils import encrypt, decrypt
from .config import (
    ORIGINAL_API_BASE,
    ORIGINAL_ACTIVATION_CODE,
    ORIGINAL_COOKIE,
    ORIGINAL_HEADERS_JSON,
    SYNC_TIMEOUT_SECONDS,
    SYNC_REQUEST_DELAY_SECONDS,
)

logger = logging.getLogger("emotor.upstream")


def _create_multipart_body(fields=None):
    """Create multipart/form-data body matching original site format."""
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    parts = []
    if fields:
        for key, value in fields.items():
            parts.append(f"--{boundary}")
            parts.append(f'Content-Disposition: form-data; name="{key}"')
            parts.append("")
            parts.append(value)
    parts.append(f"--{boundary}--")
    parts.append("")
    return "\r\n".join(parts).encode(), boundary


def _build_headers(boundary):
    """Build request headers with optional auth."""
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "Mozilla/5.0",
    }
    if ORIGINAL_COOKIE:
        headers["Cookie"] = ORIGINAL_COOKIE
    if ORIGINAL_HEADERS_JSON:
        try:
            extra = json.loads(ORIGINAL_HEADERS_JSON)
            headers.update(extra)
        except json.JSONDecodeError:
            pass
    return headers


def api_post(path: str, fields: Optional[dict] = None) -> Optional[dict]:
    """Send a POST request to the original API."""
    body, boundary = _create_multipart_body(fields)
    req = urllib.request.Request(
        f"{ORIGINAL_API_BASE}{path}",
        data=body,
        headers=_build_headers(boundary),
    )
    try:
        resp = urllib.request.urlopen(req, timeout=SYNC_TIMEOUT_SECONDS)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        logger.warning(f"Upstream HTTP {e.code} on {path}: {e.read().decode('utf-8', errors='replace')[:300]}")
        return None
    except Exception as e:
        logger.warning(f"Upstream error on {path}: {e}")
        return None


class UpstreamClient:
    """Client for the original motomate API."""

    def __init__(self):
        self.activation_code = ORIGINAL_ACTIVATION_CODE
        self._activated = False

    # ---- Activation ----

    def activate(self) -> bool:
        """Activate with the original site using the configured activation code."""
        if self._activated:
            return True
        if not self.activation_code:
            logger.warning("No ORIGINAL_ACTIVATION_CODE configured")
            return False

        ts = int(time.time() * 1000)
        encrypted = encrypt(f"{self.activation_code}_{ts}")
        result = api_post("/getTools", {
            "data": json.dumps({"type": "PC", "c": "", "d": "", "e": encrypted})
        })
        if result and result.get("stat") == "success":
            self._activated = True
            logger.info("Upstream activation successful")
            return True
        logger.warning("Upstream activation failed")
        return False

    # ---- Data methods ----

    def get_tools(self) -> Optional[dict]:
        """Get tools/motor list from original site."""
        if not self._activated and not self.activate():
            return None
        ts = int(time.time() * 1000)
        encrypted = encrypt(f"{self.activation_code}_{ts}")
        result = api_post("/getTools", {
            "data": json.dumps({"type": "PC", "c": "", "d": "", "e": encrypted})
        })
        time.sleep(SYNC_REQUEST_DELAY_SECONDS)
        return result

    def get_part_list(self) -> Optional[dict]:
        """Get parts list from original site."""
        result = api_post("/getPartList")
        time.sleep(SYNC_REQUEST_DELAY_SECONDS)
        return result

    def load_part_info(self, product_id: str) -> Optional[dict]:
        """Get detailed part info from original site."""
        result = api_post("/loadPartInfo", {"data": product_id})
        time.sleep(SYNC_REQUEST_DELAY_SECONDS)
        return result

    def get_add_list(self, brand: str, car_name: str = "") -> Optional[dict]:
        """Get add-on items for a brand/model from original site."""
        result = api_post("/getAddList", {
            "time": str(int(time.time() * 1000)),
            "belongCarBrand": brand,
            "belongCarName": car_name,
        })
        time.sleep(SYNC_REQUEST_DELAY_SECONDS)
        return result

    def load_additem_info(self, product_id: str) -> Optional[dict]:
        """Get detailed add-on item info from original site."""
        result = api_post("/loadAdditemInfo", {"data": product_id})
        time.sleep(SYNC_REQUEST_DELAY_SECONDS)
        return result

    def download_asset(self, url_or_path: str, target_path: str) -> bool:
        """Download an asset from the original site."""
        url = url_or_path
        if not url.startswith("http"):
            url = f"{ORIGINAL_API_BASE}{url_or_path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=SYNC_TIMEOUT_SECONDS)
            Path(target_path).parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(resp.read())
            return True
        except Exception as e:
            logger.debug(f"Download failed for {url}: {e}")
            return False