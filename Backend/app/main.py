from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import (
    admin, auth, campus_buildings, events, health, parking, recommendations, reviews, users
)
import app.api.logging as logging_api
import app.api.private_spots as private_spots
from app.core.startup_health import run_startup_health_checks
from app.task.scheduler import start_scheduler, stop_scheduler
from app.core.caching import close_redis
from app.core.limiter import limiter
from app.core.config import settings
from app.utils.metrics import instrumentator


logger = logging.getLogger("app.main")


async def _run_startup_checks_background() -> None:
    """Run schema/seed checks in the background so the app serves requests immediately."""
    try:
        await run_startup_health_checks()
    except Exception:
        logger.exception(
            "Background startup health checks failed. "
            "Check DATABASE_URL and PostgreSQL credentials."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch the scheduler immediately, then run health checks in the background.
    The app starts serving requests without waiting for DB checks to complete.
    Shutdown: cancel the background task, stop the scheduler, close Redis."""
    scheduler_started = False
    startup_task: asyncio.Task | None = None

    try:
        start_scheduler()
        scheduler_started = True
    except Exception:
        logger.exception("Failed to start scheduler on startup.")

    startup_task = asyncio.create_task(_run_startup_checks_background())

    yield

    if startup_task and not startup_task.done():
        startup_task.cancel()
        try:
            await startup_task
        except asyncio.CancelledError:
            pass

    if scheduler_started:
        stop_scheduler()
    await close_redis()


app = FastAPI(title="ParkandGo Backend", version="2.0", lifespan=lifespan)

# Attach the limiter to app state so slowapi middleware can read it,
# and register the 429 error handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

"""
Local host should use both development and Vercel origins to allow testing from either environment.
In production, only the Vercel origin is needed.
"""
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(parking.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(logging_api.router, prefix="/api")
app.include_router(logging_api.history_router, prefix="/api")
app.include_router(private_spots.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(campus_buildings.router, prefix="/api")
app.include_router(health.router, prefix="/api")


# Prometheus /metrics endpoint - auto-instruments all HTTP routes
instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/")
async def root():
    return {"message": "Park&Go backend is running"}
