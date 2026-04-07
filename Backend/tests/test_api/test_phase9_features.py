from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header
from app.models.user import User
from app.models.parking_spot import ParkingSpot


class TestReviewsApi:
    async def test_create_review_returns_201_and_summary_updates(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        resp = await client.post(
            "/api/reviews/",
            json={"spot_id": test_spot.spot_id, "rating": 4, "notes": "Good lighting"},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        assert resp.json()["rating"] == 4

        summary = await client.get(f"/api/reviews/{test_spot.spot_id}/summary")
        assert summary.status_code == 200
        assert summary.json()["average_rating"] == 4.0
        assert summary.json()["review_count"] == 1

    async def test_review_submit_updates_existing_user_review(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        await client.post(
            "/api/reviews/",
            json={"spot_id": test_spot.spot_id, "rating": 3, "notes": "Okay"},
            headers=auth_header(test_user),
        )
        resp = await client.post(
            "/api/reviews/",
            json={"spot_id": test_spot.spot_id, "rating": 5, "notes": "Improved"},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        assert resp.json()["rating"] == 5

        summary = await client.get(f"/api/reviews/{test_spot.spot_id}/summary")
        assert summary.json()["average_rating"] == 5.0
        assert summary.json()["review_count"] == 1


class TestHistoryApi:
    async def test_create_history_writes_row(self, client: AsyncClient, test_user: User, test_spot: ParkingSpot):
        resp = await client.post(
            "/api/history/",
            json={
                "spot_id": test_spot.spot_id,
                "start_time": datetime.now(timezone.utc).isoformat(),
                "consent_flag": False,
            },
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        assert resp.json()["spot_id"] == test_spot.spot_id

        history = await client.get("/api/history/me", headers=auth_header(test_user))
        assert history.status_code == 200
        assert len(history.json()) == 1


class TestPrivateSpotsApi:
    async def test_private_spot_crud(self, client: AsyncClient, test_user: User):
        create_resp = await client.post(
            "/api/private-spots/",
            json={
                "name": "Home Spot",
                "latitude": 44.98,
                "longitude": -93.23,
                "notes": "Use side entrance",
                "is_default": True,
            },
            headers=auth_header(test_user),
        )
        assert create_resp.status_code == 201
        private_spot_id = create_resp.json()["private_spot_id"]

        list_resp = await client.get("/api/private-spots/", headers=auth_header(test_user))
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

        update_resp = await client.patch(
            f"/api/private-spots/{private_spot_id}",
            json={"notes": "Updated note", "is_default": False},
            headers=auth_header(test_user),
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["notes"] == "Updated note"

        delete_resp = await client.delete(
            f"/api/private-spots/{private_spot_id}",
            headers=auth_header(test_user),
        )
        assert delete_resp.status_code == 204

        final_list = await client.get("/api/private-spots/", headers=auth_header(test_user))
        assert final_list.json() == []
