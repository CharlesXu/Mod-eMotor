"""
Scheduler for periodic data sync from the original site.
"""
import asyncio
import logging
from datetime import datetime

from .config import SYNC_INTERVAL_HOURS, SYNC_ENABLED
from .database import async_session
from .sync_service import SyncService

logger = logging.getLogger("emotor.scheduler")

_scheduler_task: asyncio.Task = None


async def _sync_loop():
    """Background loop that runs sync at configured intervals."""
    logger.info(f"Sync loop started, interval={SYNC_INTERVAL_HOURS}h")
    svc = SyncService()
    while True:
        try:
            async with async_session() as db:
                result = await svc.full_sync(db)
                logger.info(f"Scheduled sync completed: {result}")
        except Exception as e:
            logger.error(f"Scheduled sync failed: {e}")
        await asyncio.sleep(SYNC_INTERVAL_HOURS * 3600)


def start_scheduler():
    """Start the background sync scheduler."""
    global _scheduler_task
    if _scheduler_task is not None:
        return
    if not SYNC_ENABLED:
        logger.info("Sync scheduler is disabled (SYNC_ENABLED=false)")
        return
    _scheduler_task = asyncio.create_task(_sync_loop())


def stop_scheduler():
    """Stop the background sync scheduler."""
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None