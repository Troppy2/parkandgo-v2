"""
Tests for admin-only parking spot CRUD endpoints.

Covers:
- Non-admin access returns 403
- GET /api/admin/spots/ returns all spots
- POST /api/admin/spots/ creates a spot (201, is_verified=True)
- PATCH /api/admin/spots/{id} updates the specified fields
- PATCH /api/admin/spots/{id}/verify marks a spot verified
- DELETE /api/admin/spots/{id} removes the spot
"""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.parking_spot import ParkingSpot
from tests.conftest import auth_header


VALID_SPOT = {
    "spot_name": "Admin Test Ramp",
    "campus_location": "East Bank",
    "parking_type": "Parking Garage",
    "cost": 3.00,
    "address": "999 Admin Ave SE",
    "latitude": 44.9750,
    "longitude": -93.2320,
}


class TestAdminAccessControl:
    async def test_non_admin_list_all_spots_returns_403(
        self, client: AsyncClient, test_user: User
    ):
        resp = await client.get("/api/admin/spots/", headers=auth_header(test_user))
        assert resp.status_code == 403

    async def test_non_admin_create_spot_returns_403(
        self, client: AsyncClient, test_user: User
    ):
        resp = await client.post(
            "/api/admin/spots/", json=VALID_SPOT, headers=auth_header(test_user)
        )
        assert resp.status_code == 403

    async def test_non_admin_update_spot_returns_403(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        resp = await client.patch(
            f"/api/admin/spots/{test_spot.spot_id}",
            json={"cost": 9.99},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/admin/spots/")
        assert resp.status_code == 401


class TestAdminListAllSpots:
    async def test_returns_all_spots_including_unverified(
        self, client: AsyncClient, admin_user: User, multiple_spots: list[ParkingSpot]
    ):
        resp = await client.get("/api/admin/spots/", headers=auth_header(admin_user))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == len(multiple_spots)

    async def test_returns_empty_list_when_no_spots(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.get("/api/admin/spots/", headers=auth_header(admin_user))
        assert resp.status_code == 200
        assert resp.json() == []


class TestAdminCreateSpot:
    async def test_create_returns_201(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.post(
            "/api/admin/spots/", json=VALID_SPOT, headers=auth_header(admin_user)
        )
        assert resp.status_code == 201

    async def test_create_spot_is_verified_by_default(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.post(
            "/api/admin/spots/", json=VALID_SPOT, headers=auth_header(admin_user)
        )
        assert resp.status_code == 201
        assert resp.json()["is_verified"] is True

    async def test_create_spot_appears_in_list(
        self, client: AsyncClient, admin_user: User
    ):
        await client.post(
            "/api/admin/spots/", json=VALID_SPOT, headers=auth_header(admin_user)
        )
        resp = await client.get("/api/admin/spots/", headers=auth_header(admin_user))
        names = [s["spot_name"] for s in resp.json()]
        assert "Admin Test Ramp" in names

    async def test_create_returns_spot_data(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.post(
            "/api/admin/spots/", json=VALID_SPOT, headers=auth_header(admin_user)
        )
        data = resp.json()
        assert data["spot_name"] == "Admin Test Ramp"
        assert data["cost"] == 3.00
        assert data["spot_id"] is not None


class TestAdminUpdateSpot:
    async def test_update_cost_field(
        self, client: AsyncClient, admin_user: User, test_spot: ParkingSpot
    ):
        resp = await client.patch(
            f"/api/admin/spots/{test_spot.spot_id}",
            json={"cost": 4.50},
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 200
        assert resp.json()["cost"] == 4.50

    async def test_update_multiple_fields(
        self, client: AsyncClient, admin_user: User, test_spot: ParkingSpot
    ):
        resp = await client.patch(
            f"/api/admin/spots/{test_spot.spot_id}",
            json={"address": "New Address 123", "walk_time": "10 min walk"},
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["address"] == "New Address 123"
        assert data["walk_time"] == "10 min walk"

    async def test_update_unset_fields_are_unchanged(
        self, client: AsyncClient, admin_user: User, test_spot: ParkingSpot
    ):
        original_name = test_spot.spot_name
        resp = await client.patch(
            f"/api/admin/spots/{test_spot.spot_id}",
            json={"cost": 2.00},
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 200
        assert resp.json()["spot_name"] == original_name

    async def test_update_nonexistent_spot_returns_404(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.patch(
            "/api/admin/spots/999999",
            json={"cost": 1.00},
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 404


class TestAdminVerifySpot:
    async def test_verify_marks_spot_as_verified(
        self, client: AsyncClient, admin_user: User, unverified_spot: ParkingSpot
    ):
        resp = await client.patch(
            f"/api/admin/spots/{unverified_spot.spot_id}/verify",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 200
        assert resp.json()["is_verified"] is True

    async def test_verify_nonexistent_spot_returns_404(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.patch(
            "/api/admin/spots/999999/verify",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 404


class TestAdminDeleteSpot:
    async def test_delete_returns_204(
        self, client: AsyncClient, admin_user: User, test_spot: ParkingSpot
    ):
        resp = await client.delete(
            f"/api/admin/spots/{test_spot.spot_id}",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 204

    async def test_delete_removes_spot_from_list(
        self, client: AsyncClient, admin_user: User, test_spot: ParkingSpot
    ):
        await client.delete(
            f"/api/admin/spots/{test_spot.spot_id}",
            headers=auth_header(admin_user),
        )
        resp = await client.get("/api/admin/spots/", headers=auth_header(admin_user))
        ids = [s["spot_id"] for s in resp.json()]
        assert test_spot.spot_id not in ids

    async def test_delete_nonexistent_spot_returns_404(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.delete(
            "/api/admin/spots/999999",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 404
