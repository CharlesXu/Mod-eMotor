"""
Application configuration - centralized settings from environment variables.
"""
import os
from pathlib import Path

# Load .env file if it exists
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip()
                if key not in os.environ:
                    os.environ[key] = value


# --- Database ---
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/emotor"
)
SYNC_DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/emotor"
)

# --- Original API ---
ORIGINAL_API_BASE = os.getenv("ORIGINAL_API_BASE", "http://motomate.cn:3807")
ORIGINAL_ACTIVATION_CODE = os.getenv("ORIGINAL_ACTIVATION_CODE", "")
ORIGINAL_COOKIE = os.getenv("ORIGINAL_COOKIE", "")
ORIGINAL_HEADERS_JSON = os.getenv("ORIGINAL_HEADERS_JSON", "")

# --- Local Auth ---
LOCAL_AUTH_DISABLED = os.getenv("LOCAL_AUTH_DISABLED", "true").lower() == "true"

# --- Sync ---
SYNC_ENABLED = os.getenv("SYNC_ENABLED", "false").lower() == "true"
SYNC_ON_STARTUP = os.getenv("SYNC_ON_STARTUP", "false").lower() == "true"
SYNC_INTERVAL_HOURS = int(os.getenv("SYNC_INTERVAL_HOURS", "24"))
SYNC_TIMEOUT_SECONDS = int(os.getenv("SYNC_TIMEOUT_SECONDS", "30"))
SYNC_REQUEST_DELAY_SECONDS = float(os.getenv("SYNC_REQUEST_DELAY_SECONDS", "0.5"))

# --- Uploads ---
UPLOADS_DIR = os.getenv("UPLOADS_DIR", os.path.join(os.path.dirname(__file__), "uploads"))