"""
Tests for server side data consent and cross device preference storage.

The central guarantee: consent is decided by the database, never by anything
the client sends. A client cannot opt itself in with a request body, a header,
or a preferences PATCH.
"""
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_event import ConsentEvent
from app.models.parking_spot import ParkingSpot
from app.models.recommendation_context_log import RecommendationContextLog
from app.models.user import User
from tests.conftest import auth_header


async def _grant_consent(client: AsyncClient, user: User) -> None:
    resp = await client.put(
        "/api/users/me/preferences/consent",
        json={"granted": True},
        headers=auth_header(user),
    )
    assert resp.status_code == 200


class TestPreferencesStorage:
    async def test_defaults_created_on_first_read(self, client: AsyncClient, test_user: User):
        resp = await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        assert resp.status_code == 200
        body = resp.json()
        # Fail closed: nobody is opted in by default.
        assert body["data_consent"] is False
        assert body["map_style"] == "standard"
        assert body["campus_routing_enabled"] is True
        assert body["user_id"] == test_user.user_id

    async def test_preferences_persist_for_cross_device_reads(
        self, client: AsyncClient, test_user: User
    ):
        patch = await client.patch(
            "/api/users/me/preferences",
            json={"map_style": "satellite", "dark_mode": True, "verified_only": True},
            headers=auth_header(test_user),
        )
        assert patch.status_code == 200

        # A second "device" reading fresh sees the same values.
        resp = await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        body = resp.json()
        assert body["map_style"] == "satellite"
        assert body["dark_mode"] is True
        assert body["verified_only"] is True
        # Untouched fields keep their defaults.
        assert body["tts_enabled"] is False

    async def test_partial_update_leaves_other_fields_alone(
        self, client: AsyncClient, test_user: User
    ):
        await client.patch(
            "/api/users/me/preferences",
            json={"dark_mode": True, "tts_enabled": True},
            headers=auth_header(test_user),
        )
        await client.patch(
            "/api/users/me/preferences",
            json={"map_style": "3d"},
            headers=auth_header(test_user),
        )
        body = (
            await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        ).json()
        assert body["map_style"] == "3d"
        assert body["dark_mode"] is True
        assert body["tts_enabled"] is True

    async def test_preferences_require_auth(self, client: AsyncClient):
        assert (await client.get("/api/users/me/preferences")).status_code == 401

    async def test_invalid_map_style_rejected(self, client: AsyncClient, test_user: User):
        resp = await client.patch(
            "/api/users/me/preferences",
            json={"map_style": "not_a_style"},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 422


class TestConsentIsServerAuthoritative:
    async def test_consent_cannot_be_set_through_preferences_patch(
        self, client: AsyncClient, test_user: User
    ):
        resp = await client.patch(
            "/api/users/me/preferences",
            json={"data_consent": True},
            headers=auth_header(test_user),
        )
        # extra="forbid" means this is a loud 422, not a silent ignore.
        assert resp.status_code == 422

        body = (
            await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        ).json()
        assert body["data_consent"] is False

    async def test_consent_endpoint_grants_and_revokes(
        self, client: AsyncClient, test_user: User
    ):
        granted = await client.put(
            "/api/users/me/preferences/consent",
            json={"granted": True},
            headers=auth_header(test_user),
        )
        assert granted.status_code == 200
        assert granted.json()["data_consent"] is True
        assert granted.json()["changed"] is True

        revoked = await client.put(
            "/api/users/me/preferences/consent",
            json={"granted": False},
            headers=auth_header(test_user),
        )
        assert revoked.json()["data_consent"] is False
        assert revoked.json()["changed"] is True

    async def test_repeat_toggle_is_not_a_transition(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        await _grant_consent(client, test_user)
        again = await client.put(
            "/api/users/me/preferences/consent",
            json={"granted": True},
            headers=auth_header(test_user),
        )
        assert again.json()["data_consent"] is True
        assert again.json()["changed"] is False

        count = await db_session.scalar(
            select(func.count())
            .select_from(ConsentEvent)
            .where(ConsentEvent.user_id == test_user.user_id)
        )
        # Only the real transition is recorded, not the repeated click.
        assert count == 1

    async def test_every_transition_is_audited(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        for granted in (True, False, True):
            await client.put(
                "/api/users/me/preferences/consent",
                json={"granted": granted},
                headers=auth_header(test_user),
            )

        result = await db_session.execute(
            select(ConsentEvent)
            .where(ConsentEvent.user_id == test_user.user_id)
            .order_by(ConsentEvent.event_id)
        )
        events = list(result.scalars().all())
        assert [e.granted for e in events] == [True, False, True]
        assert all(e.source == "user_toggle" for e in events)


class TestContextLogGating:
    async def test_not_stored_without_consent(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        resp = await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"setting": "dark_mode"}},
            headers=auth_header(test_user),
        )
        # Still a success so callers need no new error handling.
        assert resp.status_code == 201
        assert resp.json()["stored"] is False
        assert resp.json()["log_id"] is None

        count = await db_session.scalar(
            select(func.count()).select_from(RecommendationContextLog)
        )
        assert count == 0

    async def test_stored_with_consent(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        await _grant_consent(client, test_user)
        resp = await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"setting": "dark_mode"}},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        assert resp.json()["stored"] is True
        assert resp.json()["log_id"] is not None

        count = await db_session.scalar(
            select(func.count()).select_from(RecommendationContextLog)
        )
        assert count == 1

    async def test_guest_never_stored(self, client: AsyncClient, db_session: AsyncSession):
        resp = await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"setting": "dark_mode"}},
        )
        assert resp.status_code == 201
        assert resp.json()["stored"] is False

        count = await db_session.scalar(
            select(func.count()).select_from(RecommendationContextLog)
        )
        assert count == 0

    async def test_consent_header_cannot_opt_in(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        resp = await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"setting": "dark_mode"}},
            headers={**auth_header(test_user), "X-Data-Consent": "true"},
        )
        assert resp.json()["stored"] is False

        count = await db_session.scalar(
            select(func.count()).select_from(RecommendationContextLog)
        )
        assert count == 0

    async def test_revoking_consent_stops_collection(
        self, client: AsyncClient, test_user: User, db_session: AsyncSession
    ):
        await _grant_consent(client, test_user)
        await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"n": 1}},
            headers=auth_header(test_user),
        )
        await client.put(
            "/api/users/me/preferences/consent",
            json={"granted": False},
            headers=auth_header(test_user),
        )
        after = await client.post(
            "/api/logging/context",
            json={"action": "user_action", "context_data": {"n": 2}},
            headers=auth_header(test_user),
        )
        assert after.json()["stored"] is False

        count = await db_session.scalar(
            select(func.count()).select_from(RecommendationContextLog)
        )
        assert count == 1


class TestParkingHistoryConsentFlag:
    async def test_client_claimed_consent_flag_is_ignored(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        resp = await client.post(
            "/api/history/",
            json={
                "spot_id": test_spot.spot_id,
                "start_time": datetime.now(timezone.utc).isoformat(),
                # Client lies about consent.
                "consent_flag": True,
            },
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        # The row is still written, it is the user's own history, but the
        # analytics flag reflects the server's stored consent.
        assert resp.json()["consent_flag"] is False

    async def test_history_is_recorded_even_without_consent(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        await client.post(
            "/api/history/",
            json={
                "spot_id": test_spot.spot_id,
                "start_time": datetime.now(timezone.utc).isoformat(),
            },
            headers=auth_header(test_user),
        )
        history = await client.get("/api/history/me", headers=auth_header(test_user))
        # Consent gates analytics use, not the user's own feature.
        assert len(history.json()) == 1

    async def test_consent_flag_true_when_granted(
        self, client: AsyncClient, test_user: User, test_spot: ParkingSpot
    ):
        await _grant_consent(client, test_user)
        resp = await client.post(
            "/api/history/",
            json={
                "spot_id": test_spot.spot_id,
                "start_time": datetime.now(timezone.utc).isoformat(),
                "consent_flag": False,
            },
            headers=auth_header(test_user),
        )
        assert resp.json()["consent_flag"] is True
