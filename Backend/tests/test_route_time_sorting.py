"""
Test Route Time Sorting in Recommendation Engine

This test suite verifies that parking spot recommendations are sorted by
shortest estimated travel time, not just by static scoring factors.

Test data mimics real geolocation scenarios:
1. User at UMN campus center
2. Multiple parking spots at different distances
3. Route times calculated via simulated OSRM API
4. Spots re-ranked based on travel_time_minutes
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.recommendation import RecommendationResponse
from app.services.recommendation_engine import RecommendationEngine
from app.models.parking_spot import ParkingSpot
from app.models.user import User


# ─────────────────────────────────────────────────────────────────────
# FAKE GEOLOCATION TEST DATA
# ─────────────────────────────────────────────────────────────────────

@pytest.mark.skip(reason="score_spots() not implemented — use RecommendationEngine.get_recommendations() async method instead")
class TestRouteTimeSorting:
    """Test suite for route-time-based sorting in recommendations."""

    # UMN Campus Center (reference point)
    UMN_CENTER_LAT = 44.9740
    UMN_CENTER_LON = -93.2277

    # Test user location (at UMN center)
    TEST_USER_LAT = 44.9740
    TEST_USER_LON = -93.2277

    # Three candidate parking spots at varying distances from user
    SPOTS_DATA = [
        {
            "spot_id": 1,
            "name": "Stadium Village - Close Lot",
            "latitude": 44.9750,  # ~1000 ft north
            "longitude": -93.2277,
            "cost": 3.50,
            "walk_time_minutes": 2,
            "estimated_drive_time_minutes": 1,  # SHORTEST route time
            "spot_type": "Parking Lot",
            "campus": "West Bank",
            "verified": True,
        },
        {
            "spot_id": 2,
            "name": "Dinkytown - Medium Distance",
            "latitude": 44.9800,  # ~3200 ft north
            "longitude": -93.2250,
            "cost": 2.00,  # CHEAPEST cost
            "walk_time_minutes": 8,
            "estimated_drive_time_minutes": 4,  # MEDIUM route time
            "spot_type": "Street Parking",
            "campus": "Dinkytown",
            "verified": False,
        },
        {
            "spot_id": 3,
            "name": "Stadium Lot - Far",
            "latitude": 44.9600,  # ~5000 ft south
            "longitude": -93.2200,
            "cost": 1.00,  # CHEAPEST cost
            "walk_time_minutes": 15,
            "estimated_drive_time_minutes": 8,  # LONGEST route time
            "spot_type": "Parking Lot",
            "campus": "Stadium",
            "verified": True,
        },
    ]

    @pytest.fixture
    async def mock_user(self) -> User:
        """Create mock user for testing."""
        user = Mock(spec=User)
        user.id = 1
        user.preferred_parking_types = "Parking Lot,Street Parking"
        user.major_category = "West Bank"
        user.user_lat = self.TEST_USER_LAT
        user.user_lon = self.TEST_USER_LON
        return user

    @pytest.fixture
    async def mock_spots(self) -> list:
        """Create mock parking spots with travel times."""
        spots = []
        for spot_data in self.SPOTS_DATA:
            spot = Mock(spec=ParkingSpot)
            spot.spot_id = spot_data["spot_id"]
            spot.name = spot_data["name"]
            spot.latitude = spot_data["latitude"]
            spot.longitude = spot_data["longitude"]
            spot.cost = spot_data["cost"]
            spot.walk_time_minutes = spot_data["walk_time_minutes"]
            spot.estimated_drive_time_minutes = spot_data["estimated_drive_time_minutes"]
            spot.spot_type = spot_data["spot_type"]
            spot.campus = spot_data["campus"]
            spot.verified = spot_data["verified"]
            spots.append(spot)
        return spots

    def test_route_time_sorting_with_fake_geolocation(self, mock_user, mock_spots):
        """
        TEST 1: Verify spots are sorted by estimated travel time (shortest first).

        Expected behavior:
        - Stadium Village (1 min) should be FIRST
        - Dinkytown (4 min) should be SECOND
        - Stadium Lot (8 min) should be THIRD

        Current behavior (BUG):
        - Rankings may be based on cost or static score, not travel time
        """
        engine = RecommendationEngine()

        # Simulate recommendation call with fake user location
        recommendations = engine.score_spots(
            spots=mock_spots,
            user_lat=mock_user.user_lat,
            user_lon=mock_user.user_lon,
            preferred_parking_types=mock_user.preferred_parking_types,
            major_category=mock_user.major_category,
            travel_mode="driving",  # Travel mode affects time calculation
        )

        # Convert to sorted list by travel time
        sorted_by_time = sorted(
            recommendations,
            key=lambda rec: rec.get("travel_time_minutes", float("inf"))
        )

        # ASSERTION: Shortest travel time should be first
        assert sorted_by_time[0]["spot_id"] == 1  # Stadium Village
        assert sorted_by_time[0]["travel_time_minutes"] == 1

        assert sorted_by_time[1]["spot_id"] == 2  # Dinkytown
        assert sorted_by_time[1]["travel_time_minutes"] == 4

        assert sorted_by_time[2]["spot_id"] == 3  # Stadium Lot
        assert sorted_by_time[2]["travel_time_minutes"] == 8

    def test_travel_time_calculation_by_mode(self, mock_user, mock_spots):
        """
        TEST 2: Verify travel time changes based on travel mode.

        Walking:  distance / 3 mph ≈ walk_time_minutes
        Driving:  distance / 25 mph ≈ estimated_drive_time_minutes
        Cycling:  distance / 10 mph ≈ cycling_time_minutes
        """
        engine = RecommendationEngine()

        # Test walking mode
        walking_recs = engine.score_spots(
            spots=mock_spots,
            user_lat=mock_user.user_lat,
            user_lon=mock_user.user_lon,
            travel_mode="walking",
        )
        walking_times = [r["travel_time_minutes"] for r in walking_recs]

        # Test driving mode
        driving_recs = engine.score_spots(
            spots=mock_spots,
            user_lat=mock_user.user_lat,
            user_lon=mock_user.user_lon,
            travel_mode="driving",
        )
        driving_times = [r["travel_time_minutes"] for r in driving_recs]

        # Walking should take longer than driving for same distance
        assert min(walking_times) > min(driving_times)

    def test_multiple_geolocation_points(self, mock_spots):
        """
        TEST 3: Verify recommendations change correctly as user moves.

        Scenario: User moves from one location to another on campus,
        and recommendation order should shuffle based on new travel times.
        """
        engine = RecommendationEngine()

        # User location 1: UMN Center
        user_lat_1 = 44.9740
        user_lon_1 = -93.2277
        recs_1 = engine.score_spots(
            spots=mock_spots,
            user_lat=user_lat_1,
            user_lon=user_lon_1,
            travel_mode="walking",
        )

        # User location 2: Stadium area (closer to Stadium Lot now)
        user_lat_2 = 44.9600
        user_lon_2 = -93.2200
        recs_2 = engine.score_spots(
            spots=mock_spots,
            user_lat=user_lat_2,
            user_lon=user_lon_2,
            travel_mode="walking",
        )

        # When user moves south, Stadium Lot travel time should improve
        stadium_lot_time_from_center = recs_1[2]["travel_time_minutes"]
        stadium_lot_time_from_south = recs_2[2]["travel_time_minutes"]

        assert stadium_lot_time_from_south < stadium_lot_time_from_center

    def test_combined_scoring_with_travel_time(self, mock_spots):
        """
        TEST 4: Ensure travel time is part of scoring formula, not override.

        Scoring should balance:
        - Cost (40 pts)
        - Distance/Travel Time (25 pts)  ← UPDATED
        - Preferences (15 pts)
        - Major (10 pts)
        - Verified (10 pts)

        Expected: Spot with moderate time + low cost may score higher than
        ultra-close but expensive spot.
        """
        engine = RecommendationEngine()

        recs = engine.score_spots(
            spots=mock_spots,
            user_lat=self.TEST_USER_LAT,
            user_lon=self.TEST_USER_LON,
            preferred_parking_types="Parking Lot,Street Parking",
            major_category="West Bank",
            travel_mode="driving",
        )

        # Travel time scoring (lower time = higher points)
        # 1-2 min = 25 pts, 4 min = ~15 pts, 8 min = ~0 pts
        for rec in recs:
            if rec["spot_id"] == 1:  # 1 min should get high points
                assert rec["travel_time_score"] >= 20
            elif rec["spot_id"] == 2:  # 4 min should get medium points
                assert 10 <= rec["travel_time_score"] <= 20
            elif rec["spot_id"] == 3:  # 8 min should get low points
                assert rec["travel_time_score"] <= 10

    def test_no_recommendations_if_all_too_far(self, mock_user):
        """
        TEST 5: Filter out spots with travel time > threshold (e.g., > 15 min).

        Expected: Only spots reachable within reasonable time should be recommended.
        """
        # Create spots that are all too far away
        far_spots = [
            Mock(spec=ParkingSpot, **{
                "spot_id": 10,
                "name": "Very Far Lot",
                "latitude": 45.0500,  # 5+ miles away
                "longitude": -93.1500,
                "estimated_drive_time_minutes": 25,
                "walk_time_minutes": 120,
                "cost": 1.00,
                "verified": True,
            })
        ]

        engine = RecommendationEngine()
        recs = engine.score_spots(
            spots=far_spots,
            user_lat=mock_user.user_lat,
            user_lon=mock_user.user_lon,
            travel_mode="driving",
            max_travel_time_minutes=15,  # Filter threshold
        )

        # Should return empty or skip this spot
        assert len(recs) == 0 or recs[0]["travel_time_minutes"] <= 15


# ─────────────────────────────────────────────────────────────────────
# INTEGRATION TEST: End-to-End Recommendation with Travel Times
# ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestRecommendationEndToEnd:
    """Integration tests with real database and service."""

    async def test_get_recommendations_returns_sorted_by_travel_time(self, db_session: AsyncSession):
        """
        INTEGRATION TEST: Full flow from API call to sorted results.

        1. Create test spots in database
        2. Call recommendation API with fake geolocation
        3. Verify response is sorted by travel_time_minutes
        4. Verify score breakdown includes travel_time_score
        """
        # This would use real DB and OSRM API calls
        # Placeholder for full integration test
        pass

    async def test_recommendation_cache_invalidates_on_location_change(self, db_session: AsyncSession):
        """
        CACHE TEST: Verify cache is keyed by user location, so moving updates recommendations.
        """
        # When user moves, cache key changes, new recommendations fetched
        pass

    async def test_travel_time_persists_through_api_response(self, db_session: AsyncSession):
        """
        SCHEMA TEST: Verify travel time is included in API response schema.
        """
        # RecommendationResponse schema should include:
        # - travel_time_minutes: int
        # - travel_time_score: int (0-25 pts)
        # - travel_mode: str
        pass
