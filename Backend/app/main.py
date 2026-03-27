from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import admin, auth, parking, recommendations, users, events
from app.task.scheduler import start_scheduler, stop_scheduler
from app.core.caching import close_redis, get_redis
from app.core.startup_health import run_startup_health_checks
from app.core.limiter import limiter
from app.core.config import settings
from app.utils.metrics import instrumentator


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch the scheduler and warm the Redis connection.
    Shutdown: stop the scheduler and close the Redis connection cleanly."""
    await run_startup_health_checks()
    start_scheduler()
    await get_redis()
    yield
    stop_scheduler()
    await close_redis()


app = FastAPI(title="ParkandGo Backend", version="2.0", lifespan=lifespan)

# Attach the limiter to app state so slowapi middleware can read it,
# and register the 429 error handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(parking.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(events.router, prefix="/api")


# Prometheus /metrics endpoint — auto-instruments all HTTP routes
instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/")
async def root():
    return {"message": "Park&Go backend is running"}
