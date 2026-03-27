"""
Tests for POST /api/parking/ and GET /api/parking/ endpoints.

Covers:
- Unauthenticated POST returns 401
- Out-of-bounds coordinates return 400
- Valid submission saves with is_verified=False
- submitted_by is set to current user
- GET /api/parking/ returns all spots
- GET /api/parking/search works with query
"""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.parking_spot import ParkingSpot
from tests.conftest import auth_header


class TestGetParkingSpots:
    async def test_get_all_spots_returns_list(self, client: AsyncClient, test_spot: ParkingSpot):
        resp = await client.get("/api/parking/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["spot_name"] == "Oak Street Ramp"

    async def test_search_spots_returns_matching(self, client: AsyncClient, test_spot: ParkingSpot):
        resp = await client.get("/api/parking/search", params={"q": "Oak"})
        assert resp.status_code == 200
        data = resp.json()
        assert any(s["spot_name"] == "Oak Street Ramp" for s in data)

    async def test_search_spots_returns_empty_for_no_match(self, client: AsyncClient, test_spot: ParkingSpot):
        resp = await client.get("/api/parking/search", params={"q": "NonExistentSpot"})
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_filter_by_campus(self, client: AsyncClient, multiple_spots: list[ParkingSpot]):
        resp = await client.get("/api/parking/filter", params={"campus": "East Bank"})
        assert resp.status_code == 200
        data = resp.json()
        assert all(s["campus_location"] == "East Bank" for s in data)


class TestCreateParkingSpot:
    VALID_SPOT = {
        "spot_name": "Test Ramp",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 2.00,
        "address": "123 University Ave SE",
        "latitude": 44.9750,
        "longitude": -93.2320,
    }

    async def test_unauthenticated_post_returns_401(self, client: AsyncClient):
        resp = await client.post("/api/parking/", json=self.VALID_SPOT)
        assert resp.status_code == 401

    async def test_out_of_bounds_returns_400(self, client: AsyncClient, test_user: User):
        bad_spot = {**self.VALID_SPOT, "latitude": 0.0, "longitude": 0.0}
        resp = await client.post("/api/parking/", json=bad_spot, headers=auth_header(test_user))
        assert resp.status_code == 400
        assert "campus boundary" in resp.json()["detail"].lower()

    async def test_valid_submission_returns_201(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/parking/", json=self.VALID_SPOT, headers=auth_header(test_user))
        assert resp.status_code == 201
        data = resp.json()
        assert data["spot_name"] == "Test Ramp"

    async def test_new_spot_is_unverified(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/parking/", json=self.VALID_SPOT, headers=auth_header(test_user))
        assert resp.status_code == 201
        assert resp.json()["is_verified"] is False

    async def test_submitted_by_is_current_user(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/parking/", json=self.VALID_SPOT, headers=auth_header(test_user))
        assert resp.status_code == 201
        assert resp.json()["submitted_by"] == test_user.user_id
