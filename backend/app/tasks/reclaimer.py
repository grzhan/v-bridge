from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.order_service import expire_overdue_orders

scheduler: AsyncIOScheduler | None = None


async def _reclaim_job() -> None:
    db = SessionLocal()
    try:
        await expire_overdue_orders(db)
    finally:
        db.close()


def start_scheduler() -> None:
    global scheduler
    if scheduler is not None:
        return

    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone='UTC')
    scheduler.add_job(_reclaim_job, 'interval', seconds=settings.reclaim_interval_seconds, id='expire-orders')
    scheduler.start()


def stop_scheduler() -> None:
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
