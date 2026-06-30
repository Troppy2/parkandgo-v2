import pytest
from fastapi import FastAPI

from app.main import lifespan


@pytest.mark.asyncio
async def test_lifespan_continues_when_startup_checks_fail(monkeypatch):
    """A failure in the background startup health checks must not crash the app.

    The lifespan starts the scheduler immediately and runs the DB health checks
    in a background task, so a check failure is swallowed and the app keeps
    serving. The scheduler still starts on entry and is stopped on shutdown.
    """
    started = False
    stopped = False

    async def fail_startup_checks():
        raise RuntimeError("database auth failed")

    def fake_start_scheduler():
        nonlocal started
        started = True

    def fake_stop_scheduler():
        nonlocal stopped
        stopped = True

    monkeypatch.setattr("app.main.run_startup_health_checks", fail_startup_checks)
    monkeypatch.setattr("app.main.start_scheduler", fake_start_scheduler)
    monkeypatch.setattr("app.main.stop_scheduler", fake_stop_scheduler)

    # Entering and exiting the lifespan must not raise even though the
    # background health checks fail.
    async with lifespan(FastAPI()):
        pass

    # Scheduler starts immediately (independent of the DB checks) and is
    # stopped cleanly on shutdown.
    assert started is True
    assert stopped is True
