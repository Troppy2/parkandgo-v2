"""
Tests for GET /api/recommendations/ endpoint.

Covers:
- Recommendations require auth (401 without token)
- Response includes score and score_breakdown
- limit param is respected
- Higher scored spots appear first
- campus_location filter works
- verified_only filter works
"""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.parking_spot import ParkingSpot
from tests.conftest import auth_header


class TestRecommendationsAuth:
    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/recommendations/")
        assert resp.status_code == 401


class TestRecommendationsResponse:
    async def test_response_includes_score_and_breakdown(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        resp = await client.get("/api/recommendations/", headers=auth_header(test_user))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        rec = data[0]
        assert "score" in rec
        assert "score_breakdown" in rec
        assert "spot" in rec
        # score_breakdown should contain all scoring factors
        breakdown = rec["score_breakdown"]
        assert "cost" in breakdown
        assert "distance" in breakdown
        assert "preferences" in breakdown
        assert "major" in breakdown
        assert "verified" in breakdown

    async def test_limit_param_is_respected(
        self, client: AsyncClient, test_user: User, multiple_spots: list[ParkingSpot]
    ):
        resp = await client.get(
            "/api/recommendations/",
            params={"limit": 2},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 2

    async def test_higher_scored_spots_first(
        self, client: AsyncClient, test_user: User, multiple_spots: list[ParkingSpot]
    ):
        resp = await client.get(
            "/api/recommendations/",
            params={"limit": 10},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        scores = [r["score"] for r in data]
        assert scores == sorted(scores, reverse=True), "Recommendations should be sorted by score descending"

    async def test_campus_location_filter(
        self, client: AsyncClient, test_user: User, multiple_spots: list[ParkingSpot]
    ):
        resp = await client.get(
            "/api/recommendations/",
            params={"campus_location": "East Bank", "limit": 10},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        for rec in data:
            assert rec["spot"]["campus_location"] == "East Bank"

    async def test_verified_only_filter(
        self, client: AsyncClient, test_user: User, multiple_spots: list[ParkingSpot]
    ):
        resp = await client.get(
            "/api/recommendations/",
            params={"verified_only": True, "limit": 10},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        for rec in data:
            assert rec["spot"]["is_verified"] is True
