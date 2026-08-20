"""
Tests for DELETE /api/users/me.

These lock the exact behavior the privacy policy promises, so a change here
should be treated as a change to a published commitment, not just a refactor:
personal records go, community parking spots survive without their author, and
analytics rows survive without their user.
"""
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_event import ConsentEvent
from app.models.parking_history import ParkingHistory
from app.models.parking_spot import ParkingSpot
from app.models.recommendation_context_log import RecommendationContextLog
from app.models.saved_spot import SavedSpot
from app.models.spot_reviews import SpotReview
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.user_private_spots import UserPrivateSpot
from tests.conftest import auth_header


class TestAccountDeletion:
    async def test_requires_authentication(self, client: AsyncClient):
        resp = await client.delete("/api/users/me")
        assert resp.status_code == 401

    async def test_deletes_the_user(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User
    ):
        user_id = test_user.user_id

        resp = await client.delete("/api/users/me", headers=auth_header(test_user))
        assert resp.status_code == 204

        remaining = await db_session.execute(select(User).where(User.user_id == user_id))
        assert remaining.scalar_one_or_none() is None

    async def test_removes_every_personal_record(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_spot: ParkingSpot,
    ):
        user_id = test_user.user_id

        db_session.add_all([
            SavedSpot(user_id=user_id, spot_id=test_spot.spot_id),
            UserPrivateSpot(
                user_id=user_id, name="Behind the co-op", latitude=44.97, longitude=-93.23
            ),
            SpotReview(user_id=user_id, spot_id=test_spot.spot_id, rating=4, notes="fine"),
            UserPreferences(user_id=user_id, data_consent=True),
            ConsentEvent(user_id=user_id, granted=True, source="user_toggle"),
        ])
        await db_session.flush()

        resp = await client.delete("/api/users/me", headers=auth_header(test_user))
        assert resp.status_code == 204

        for model in (SavedSpot, UserPrivateSpot, SpotReview, UserPreferences, ConsentEvent,
                      ParkingHistory):
            rows = await db_session.execute(select(model).where(model.user_id == user_id))
            assert rows.scalars().all() == [], f"{model.__name__} survived deletion"

    async def test_keeps_submitted_spots_but_drops_authorship(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        unverified_spot: ParkingSpot,
    ):
        # The spot is shared community content that other people's saved spots
        # and recommendations point at, so deleting the author must not delete it.
        spot_id = unverified_spot.spot_id
        assert unverified_spot.submitted_by == test_user.user_id

        resp = await client.delete("/api/users/me", headers=auth_header(test_user))
        assert resp.status_code == 204

        db_session.expire_all()
        result = await db_session.execute(
            select(ParkingSpot).where(ParkingSpot.spot_id == spot_id)
        )
        spot = result.scalar_one_or_none()
        assert spot is not None
        assert spot.submitted_by is None

    async def test_anonymizes_context_logs_rather_than_deleting_them(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User
    ):
        # context_data holds only ids, flags, and counts, never coordinates, so
        # an unlinked row carries nothing identifying.
        db_session.add(
            RecommendationContextLog(
                user_id=test_user.user_id,
                action="recommendation_view",
                context_data={"result_count": 3, "has_location": True},
            )
        )
        await db_session.flush()

        resp = await client.delete("/api/users/me", headers=auth_header(test_user))
        assert resp.status_code == 204

        db_session.expire_all()
        result = await db_session.execute(select(RecommendationContextLog))
        logs = result.scalars().all()
        assert len(logs) == 1
        assert logs[0].user_id is None
        assert logs[0].context_data == {"result_count": 3, "has_location": True}

    async def test_token_stops_working_afterwards(
        self, client: AsyncClient, test_user: User
    ):
        headers = auth_header(test_user)
        assert (await client.delete("/api/users/me", headers=headers)).status_code == 204

        # The JWT is still cryptographically valid, but it now names a user row
        # that is gone, so authenticated routes must reject it.
        resp = await client.get("/api/users/me/preferences", headers=headers)
        assert resp.status_code == 401

    async def test_leaves_other_users_alone(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        admin_user: User,
        test_spot: ParkingSpot,
    ):
        db_session.add(SavedSpot(user_id=admin_user.user_id, spot_id=test_spot.spot_id))
        await db_session.flush()

        resp = await client.delete("/api/users/me", headers=auth_header(test_user))
        assert resp.status_code == 204

        survivor = await db_session.execute(
            select(User).where(User.user_id == admin_user.user_id)
        )
        assert survivor.scalar_one_or_none() is not None
        saved = await db_session.execute(
            select(SavedSpot).where(SavedSpot.user_id == admin_user.user_id)
        )
        assert len(saved.scalars().all()) == 1
