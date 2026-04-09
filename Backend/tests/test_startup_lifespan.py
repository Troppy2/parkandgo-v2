import pytest
from fastapi import FastAPI

from app.main import lifespan


@pytest.mark.asyncio
async def test_lifespan_continues_when_startup_checks_fail(monkeypatch):
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

    async with lifespan(FastAPI()):
        pass

    assert started is False
    assert stopped is False
