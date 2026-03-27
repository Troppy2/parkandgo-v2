"""
Unit tests for each scoring function in RecommendationEngine.

Tests _score_cost, _score_distance, _score_preferences, _score_major,
_score_verified, and _score_event_proximity in isolation.
"""
import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from app.services.recommendation_engine import RecommendationEngine


def make_spot(**overrides):
    """Create a spot-like object with sensible defaults, overriding as needed."""
    defaults = {
        "spot_id": 1,
        "spot_name": "Test Spot",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 2.0,
        "walk_time": "5 min walk",
        "near_buildings": "Keller Hall",
        "address": "100 Test St",
        "latitude": 44.974,
        "longitude": -93.228,
        "is_verified": True,
        "submitted_by": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_user(**overrides):
    """Create a user-like object with sensible defaults."""
    defaults = {
        "user_id": 1,
        "preferred_parking_types": "Parking Garage,Surface Lot",
        "major_category": "STEM",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.fixture
def engine():
    """RecommendationEngine with a mock repo (not used for unit scoring tests)."""
    return RecommendationEngine(MagicMock())


# ── Cost scoring ──

class TestScoreCost:
    def test_zero_cost_gets_full_points(self, engine):
        spot = make_spot(cost=0.0)
        assert engine._score_cost(spot) == 40.0

    def test_mid_cost_gets_proportional(self, engine):
        spot = make_spot(cost=2.50)
        score = engine._score_cost(spot)
        assert score == pytest.approx(20.0)

    def test_max_cost_gets_zero(self, engine):
        spot = make_spot(cost=5.0)
        assert engine._score_cost(spot) == 0.0

    def test_above_max_cost_still_zero(self, engine):
        spot = make_spot(cost=10.0)
        assert engine._score_cost(spot) == 0.0

    def test_none_cost_gets_zero(self, engine):
        spot = make_spot(cost=None)
        assert engine._score_cost(spot) == 0.0


# ── Distance scoring ──

class TestScoreDistance:
    def test_no_user_location_gives_half_credit(self, engine):
        spot = make_spot()
        assert engine._score_distance(spot, None, None) == 12.5

    def test_no_spot_coordinates_gives_half_credit(self, engine):
        spot = make_spot(latitude=None, longitude=None)
        assert engine._score_distance(spot, 44.974, -93.228) == 12.5

    def test_same_location_gives_high_score(self, engine):
        spot = make_spot(latitude=44.974, longitude=-93.228)
        score = engine._score_distance(spot, 44.974, -93.228)
        assert score > 24.0  # nearly full 25 + walk bonus

    def test_far_away_gives_zero(self, engine):
        spot = make_spot(latitude=45.5, longitude=-94.0)  # ~40 miles away
        score = engine._score_distance(spot, 44.974, -93.228)
        assert score == 0.0


# ── Preferences scoring ──

class TestScorePreferences:
    def test_matching_type_gets_full_points(self, engine):
        spot = make_spot(parking_type="Parking Garage")
        user = make_user(preferred_parking_types="Parking Garage,Surface Lot")
        assert engine._score_preferences(spot, user) == 10.0

    def test_non_matching_type_gets_zero(self, engine):
        spot = make_spot(parking_type="Street Parking")
        user = make_user(preferred_parking_types="Parking Garage,Surface Lot")
        assert engine._score_preferences(spot, user) == 0.0

    def test_no_user_prefs_gets_zero(self, engine):
        spot = make_spot(parking_type="Parking Garage")
        user = make_user(preferred_parking_types=None)
        assert engine._score_preferences(spot, user) == 0.0

    def test_no_spot_type_gets_zero(self, engine):
        spot = make_spot(parking_type=None)
        user = make_user(preferred_parking_types="Parking Garage")
        assert engine._score_preferences(spot, user) == 0.0


# ── Major scoring ──

class TestScoreMajor:
    def test_stem_on_east_bank_gets_full(self, engine):
        spot = make_spot(campus_location="East Bank")
        user = make_user(major_category="STEM")
        assert engine._score_major(spot, user) == 5.0

    def test_stem_on_west_bank_gets_zero(self, engine):
        spot = make_spot(campus_location="West Bank")
        user = make_user(major_category="STEM")
        assert engine._score_major(spot, user) == 0.0

    def test_arts_on_west_bank_gets_full(self, engine):
        spot = make_spot(campus_location="West Bank")
        user = make_user(major_category="Arts")
        assert engine._score_major(spot, user) == 5.0

    def test_no_major_category_gets_zero(self, engine):
        spot = make_spot(campus_location="East Bank")
        user = make_user(major_category=None)
        assert engine._score_major(spot, user) == 0.0

    def test_unknown_major_gets_zero(self, engine):
        spot = make_spot(campus_location="East Bank")
        user = make_user(major_category="UnknownField")
        assert engine._score_major(spot, user) == 0.0


# ── Verified scoring ──

class TestScoreVerified:
    def test_verified_gets_full(self, engine):
        spot = make_spot(is_verified=True)
        assert engine._score_verified(spot) == 5.0

    def test_unverified_gets_zero(self, engine):
        spot = make_spot(is_verified=False)
        assert engine._score_verified(spot) == 0.0


# ── Event proximity scoring ──

class TestScoreEventProximity:
    def test_no_event_coords_gets_zero(self, engine):
        spot = make_spot()
        assert engine._score_event_proximity(spot, None, None) == 0.0

    def test_very_close_to_event_gets_full(self, engine):
        spot = make_spot(latitude=44.974, longitude=-93.228)
        # Same location as spot
        score = engine._score_event_proximity(spot, 44.974, -93.228)
        assert score == 15.0

    def test_far_from_event_gets_zero(self, engine):
        spot = make_spot(latitude=44.974, longitude=-93.228)
        # ~5 miles away
        score = engine._score_event_proximity(spot, 45.05, -93.3)
        assert score == 0.0
