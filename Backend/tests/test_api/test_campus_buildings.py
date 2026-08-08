"""
Tests for Campus Mode backend behavior.

Coverage:
- GET /api/campus-buildings/ listing and campus filtering
- GET /api/campus-buildings/search by name, abbreviation, and address
- GET /api/campus-buildings/nearby distance ordering and radius cutoff
- GET /api/campus-buildings/{id} including the 404 path
- Saved buildings round trip, duplicate handling, and auth requirements
- app_mode on the preferences endpoints
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campus_building import CampusBuilding
from app.repositories.campus_building_repository import CampusBuildingRepository
from tests.conftest import auth_header

# Coffman Memorial Union, used as the reference point for proximity tests.
COFFMAN_LAT = 44.972823
COFFMAN_LON = -93.235350


class TestListBuildings:
    async def test_returns_all_buildings(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/")
        assert response.status_code == 200
        assert len(response.json()) == 5

    async def test_filters_by_campus(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/", params={"campus": "West Bank"})
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["name"] == "Blegen Hall"

    async def test_rejects_unknown_campus(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/", params={"campus": "Duluth"})
        assert response.status_code == 400

    async def test_is_public(self, client: AsyncClient, multiple_buildings):
        """Buildings are reference data, so guests can browse them without a token."""
        response = await client.get("/api/campus-buildings/")
        assert response.status_code == 200

    async def test_distance_is_absent_without_a_location(self, client: AsyncClient, test_building):
        """Only /nearby knows where the user is, so the list endpoint must not invent a distance."""
        response = await client.get("/api/campus-buildings/")
        assert response.json()[0]["distance_miles"] is None


class TestSearchBuildings:
    async def test_matches_on_name(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/search", params={"q": "Keller"})
        assert response.status_code == 200
        assert response.json()[0]["name"] == "Kenneth H Keller Hall"

    async def test_matches_on_official_abbreviation(self, client: AsyncClient, multiple_buildings):
        """A student typing CMU should find Coffman without knowing the full name."""
        response = await client.get("/api/campus-buildings/search", params={"q": "CMU"})
        assert response.status_code == 200
        assert response.json()[0]["name"] == "Coffman Memorial Union"

    async def test_matches_on_address(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/search", params={"q": "Pleasant"})
        assert response.json()[0]["name"] == "Walter Library"

    async def test_is_case_insensitive(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/search", params={"q": "wAlTeR"})
        assert len(response.json()) == 1

    async def test_empty_query_returns_nothing(self, client: AsyncClient, multiple_buildings):
        """A cleared search box must not turn into a dump of every building."""
        response = await client.get("/api/campus-buildings/search", params={"q": "   "})
        assert response.status_code == 200
        assert response.json() == []

    async def test_no_match_returns_empty_list(self, client: AsyncClient, multiple_buildings):
        response = await client.get("/api/campus-buildings/search", params={"q": "Hogwarts"})
        assert response.json() == []


class TestNearbyBuildings:
    async def test_orders_by_actual_distance(self, client: AsyncClient, multiple_buildings):
        """
        Ordering must reflect real geography, not insertion order.

        Standing at Coffman: Coffman is 0 miles, Keller is roughly 0.25 mi
        northeast, Walter is roughly 0.19 mi north. Asserting the sequence
        rather than mere membership is what makes this a real proximity test.
        """
        response = await client.get(
            "/api/campus-buildings/nearby",
            params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON},
        )
        assert response.status_code == 200
        body = response.json()

        assert body[0]["name"] == "Coffman Memorial Union"
        assert body[0]["distance_miles"] == pytest.approx(0.0, abs=0.001)

        distances = [b["distance_miles"] for b in body]
        assert distances == sorted(distances), "results are not nearest first"

    async def test_attaches_distance(self, client: AsyncClient, multiple_buildings):
        response = await client.get(
            "/api/campus-buildings/nearby",
            params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON},
        )
        assert all(b["distance_miles"] is not None for b in response.json())

    async def test_radius_excludes_far_buildings(self, client: AsyncClient, multiple_buildings):
        """Borlaug Hall is on the St. Paul campus, roughly 2.5 miles away."""
        response = await client.get(
            "/api/campus-buildings/nearby",
            params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON, "radius_miles": 1.0},
        )
        names = [b["name"] for b in response.json()]
        assert "Borlaug Hall" not in names
        assert "Coffman Memorial Union" in names

    async def test_wide_radius_includes_other_campuses(self, client: AsyncClient, multiple_buildings):
        response = await client.get(
            "/api/campus-buildings/nearby",
            params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON, "radius_miles": 10},
        )
        assert "Borlaug Hall" in [b["name"] for b in response.json()]

    async def test_respects_limit(self, client: AsyncClient, multiple_buildings):
        response = await client.get(
            "/api/campus-buildings/nearby",
            params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON, "radius_miles": 10, "limit": 2},
        )
        assert len(response.json()) == 2

    async def test_rejects_out_of_range_coordinates(self, client: AsyncClient):
        response = await client.get(
            "/api/campus-buildings/nearby", params={"lat": 999, "lon": -93.2}
        )
        assert response.status_code == 422

    async def test_requires_coordinates(self, client: AsyncClient):
        response = await client.get("/api/campus-buildings/nearby")
        assert response.status_code == 422


class TestGetBuilding:
    async def test_returns_a_building(self, client: AsyncClient, test_building):
        response = await client.get(f"/api/campus-buildings/{test_building.building_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Coffman Memorial Union"
        assert body["short_name"] == "CMU"
        assert body["campus_location"] == "East Bank"

    async def test_missing_building_returns_404(self, client: AsyncClient, test_building):
        response = await client.get("/api/campus-buildings/999999")
        assert response.status_code == 404

    async def test_nearby_path_is_not_shadowed(self, client: AsyncClient, multiple_buildings):
        """
        /nearby must not be swallowed by /{building_id}.

        Route order in the module is what prevents this, so it is worth a test:
        a later refactor that moves the detail route up would break the nearby
        endpoint with a confusing 422 rather than an obvious failure.
        """
        response = await client.get(
            "/api/campus-buildings/nearby", params={"lat": COFFMAN_LAT, "lon": COFFMAN_LON}
        )
        assert response.status_code == 200


class TestSavedBuildings:
    async def test_requires_authentication(self, client: AsyncClient):
        assert (await client.get("/api/users/me/saved-buildings")).status_code in (401, 403)

    async def test_starts_empty(self, client: AsyncClient, test_user):
        response = await client.get("/api/users/me/saved-buildings", headers=auth_header(test_user))
        assert response.status_code == 200
        assert response.json() == []

    async def test_save_then_list_round_trip(self, client: AsyncClient, test_user, test_building):
        created = await client.post(
            "/api/users/me/saved-buildings",
            json={"building_id": test_building.building_id},
            headers=auth_header(test_user),
        )
        assert created.status_code == 201
        assert created.json()["building"]["name"] == "Coffman Memorial Union"

        listed = await client.get("/api/users/me/saved-buildings", headers=auth_header(test_user))
        assert len(listed.json()) == 1
        assert listed.json()[0]["building_id"] == test_building.building_id

    async def test_duplicate_save_returns_409(self, client: AsyncClient, test_user, test_building):
        payload = {"building_id": test_building.building_id}
        first = await client.post(
            "/api/users/me/saved-buildings", json=payload, headers=auth_header(test_user)
        )
        assert first.status_code == 201

        second = await client.post(
            "/api/users/me/saved-buildings", json=payload, headers=auth_header(test_user)
        )
        assert second.status_code == 409

    async def test_saving_unknown_building_returns_404(self, client: AsyncClient, test_user):
        response = await client.post(
            "/api/users/me/saved-buildings",
            json={"building_id": 999999},
            headers=auth_header(test_user),
        )
        assert response.status_code == 404

    async def test_delete_removes_the_bookmark(self, client: AsyncClient, test_user, test_building):
        await client.post(
            "/api/users/me/saved-buildings",
            json={"building_id": test_building.building_id},
            headers=auth_header(test_user),
        )
        deleted = await client.delete(
            f"/api/users/me/saved-buildings/{test_building.building_id}",
            headers=auth_header(test_user),
        )
        assert deleted.status_code == 204

        listed = await client.get("/api/users/me/saved-buildings", headers=auth_header(test_user))
        assert listed.json() == []

    async def test_deleting_something_not_saved_returns_404(
        self, client: AsyncClient, test_user, test_building
    ):
        response = await client.delete(
            f"/api/users/me/saved-buildings/{test_building.building_id}",
            headers=auth_header(test_user),
        )
        assert response.status_code == 404

    async def test_bookmarks_are_per_user(
        self, client: AsyncClient, test_user, admin_user, test_building
    ):
        await client.post(
            "/api/users/me/saved-buildings",
            json={"building_id": test_building.building_id},
            headers=auth_header(test_user),
        )
        other = await client.get("/api/users/me/saved-buildings", headers=auth_header(admin_user))
        assert other.json() == []


class TestAppModePreference:
    async def test_defaults_to_parking(self, client: AsyncClient, test_user):
        response = await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        assert response.status_code == 200
        assert response.json()["app_mode"] == "parking"

    async def test_can_switch_to_campus(self, client: AsyncClient, test_user):
        response = await client.patch(
            "/api/users/me/preferences",
            json={"app_mode": "campus"},
            headers=auth_header(test_user),
        )
        assert response.status_code == 200
        assert response.json()["app_mode"] == "campus"

    async def test_rejects_an_unknown_mode(self, client: AsyncClient, test_user):
        response = await client.patch(
            "/api/users/me/preferences",
            json={"app_mode": "spaceship"},
            headers=auth_header(test_user),
        )
        assert response.status_code == 422

    async def test_is_independent_of_campus_routing_enabled(self, client: AsyncClient, test_user):
        """
        The two similarly named settings must not be wired together.

        campus_routing_enabled controls whether driving is offered as a travel
        mode. app_mode controls which list the app shows. Changing one must
        leave the other alone.
        """
        await client.patch(
            "/api/users/me/preferences",
            json={"app_mode": "campus"},
            headers=auth_header(test_user),
        )
        response = await client.get("/api/users/me/preferences", headers=auth_header(test_user))
        body = response.json()
        assert body["app_mode"] == "campus"
        assert body["campus_routing_enabled"] is True


class TestNearbyRepository:
    async def test_bounding_box_prefilter_keeps_everything_in_radius(
        self, db_session: AsyncSession, multiple_buildings
    ):
        """
        The SQL box is an overestimate, so it must never drop a building the
        exact Haversine check would have kept. Comparing the two-stage query
        against a brute force scan is what proves the prefilter is safe.
        """
        repo = CampusBuildingRepository(db_session)
        radius = 3.0
        found = await repo.find_nearby(COFFMAN_LAT, COFFMAN_LON, limit=100, radius_miles=radius)

        from app.utils.geo import haversine_miles
        expected = {
            b.name for b in multiple_buildings
            if haversine_miles(COFFMAN_LAT, COFFMAN_LON, b.latitude, b.longitude) <= radius
        }
        assert {b.name for b, _ in found} == expected

    async def test_returns_empty_when_nothing_is_close(
        self, db_session: AsyncSession, multiple_buildings
    ):
        repo = CampusBuildingRepository(db_session)
        # Somewhere in the Atlantic.
        assert await repo.find_nearby(0.0, 0.0, radius_miles=1.5) == []
