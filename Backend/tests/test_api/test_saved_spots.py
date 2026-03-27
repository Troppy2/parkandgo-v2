"""
Tests for saved spots CRUD under /api/users/me/saved.

Covers:
- Save spot returns 201
- Duplicate save returns 409
- Unsave returns 204
- Rename updates custom_name
- Get saved spots returns list
"""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.parking_spot import ParkingSpot
from tests.conftest import auth_header


class TestSaveSpot:
    async def test_save_returns_201(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        resp = await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["spot_id"] == test_spot.spot_id

    async def test_duplicate_save_returns_409(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        # First save
        await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        # Second save — should conflict
        resp = await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 409


class TestUnsaveSpot:
    async def test_unsave_returns_204(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        # Save first
        await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        # Unsave
        resp = await client.delete(
            f"/api/users/me/saved/{test_spot.spot_id}",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 204

    async def test_unsave_nonexistent_returns_404(self, client: AsyncClient, test_user: User):
        resp = await client.delete(
            "/api/users/me/saved/99999",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 404


class TestRenameSavedSpot:
    async def test_rename_updates_custom_name(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        # Save the spot
        await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        # Rename it
        resp = await client.patch(
            f"/api/users/me/saved/{test_spot.spot_id}",
            json={"custom_name": "My Fave Ramp"},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert resp.json()["custom_name"] == "My Fave Ramp"


class TestGetSavedSpots:
    async def test_get_saved_returns_list(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        # Save a spot
        await client.post(
            "/api/users/me/saved",
            json={"spot_id": test_spot.spot_id},
            headers=auth_header(test_user),
        )
        # Get saved
        resp = await client.get("/api/users/me/saved", headers=auth_header(test_user))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
