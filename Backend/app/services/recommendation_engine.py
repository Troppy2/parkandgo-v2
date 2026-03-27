from dataclasses import dataclass
from math import radians, sin, cos, sqrt, atan2
from app.models.parking_spot import ParkingSpot
from app.models.user import User
from app.repositories.parking_repository import ParkingRepository
import re
"""
Scoring Rubric (total = 75 points base + up to 15 event bonus):
1. Cost (40pts):        Cheapest spots score highest
2. Travel Time (15pts): Shortest estimated travel time (replaced Distance in scoring formula)
3. Preferences (10pts): Matches user's preferred parking type
4. Major (5pts):        Spot is on the same campus as the user's major
5. Verified (5pts):     Verified spots are more trustworthy
Note: distance_score is computed and surfaced in score_breakdown for display only —
      it does not contribute to the total score (travel_time replaced it).
"""

# Maps major categories to their primary campus
# Used by _score_major to check if a spot is on the right campus
MAJOR_CAMPUS_MAP = {
    "STEM": "East Bank",
    "Business": "East Bank",
    "Liberal Arts": "East Bank",
    "Social Science": "West Bank",
    "Arts": "West Bank",
}

@dataclass
class ScoredSpot:
    spot: ParkingSpot
    score: float
    score_breakdown: dict  # Shows WHY a spot was recommended

class RecommendationEngine:
    def __init__(self, parking_repo: ParkingRepository):
        self.parking_repo = parking_repo

    async def get_recommendations(
    self,
    user: User | None,
    user_lat: float | None = None,
    user_lon: float | None = None,
    limit: int = 3,
    event_lat: float | None = None,
    event_lon: float | None = None,
    travel_mode: str = "driving",  # NEW: added travel_mode parameter
    ) -> list[ScoredSpot]:
        spots = await self.parking_repo.get_all()
        scored = []
        for spot in spots:
            scored_spot = self._score_spot(
                spot, user, user_lat, user_lon, event_lat, event_lon, travel_mode
            )
            scored.append(scored_spot)

        # Sort by score (descending), then by travel time (ascending) as tiebreaker
        scored.sort(key=lambda x: (-x.score, x.score_breakdown.get("travel_time", float("inf"))))
        return scored[:limit]

    def _score_spot(
        self,
        spot: ParkingSpot,
        user: User | None,
        user_lat: float | None,
        user_lon: float | None,
        event_lat: float | None = None,
        event_lon: float | None = None,
        travel_mode: str = "driving",  # NEW: added travel_mode parameter
    ) -> ScoredSpot:
        cost_score = self._score_cost(spot)
        distance_score = self._score_distance(spot, user_lat, user_lon)
        travel_time_score = self._score_travel_time(spot, user_lat, user_lon, travel_mode)  # NEW
        preference_score = self._score_preferences(spot, user)
        major_score = self._score_major(spot, user)
        verified_score = self._score_verified(spot)
        event_score = self._score_event_proximity(spot, event_lat, event_lon)

        # Updated scoring formula with travel_time (15pts) given higher weight
        total = cost_score + travel_time_score + preference_score + major_score + verified_score + event_score

        breakdown = {
            "cost": round(cost_score, 1),
            "distance": round(distance_score, 1),
            "travel_time": round(travel_time_score, 1),  # NEW: travel time in breakdown
            "preferences": round(preference_score, 1),
            "major": round(major_score, 1),
            "verified": round(verified_score, 1),
            "event": round(event_score, 1),
        }

        return ScoredSpot(spot=spot, score=round(total, 1), score_breakdown=breakdown)
    def _score_cost(self, spot: ParkingSpot) -> float:
        """
        Weight = 40pts
        Cheaper spots score higher. $0 = 40pts, $5+ = 0pts.
        Formula: (max_cost - actual_cost) / max_cost * 40
        Example: $1.00 spot → (5 - 1) / 5 * 40 = 32pts
        Example: $2.50 spot → (5 - 2.5) / 5 * 40 = 20pts
        """
        if spot.cost is None:
            return 0.0
        max_cost = 5.0
        # Clamp cost so anything >= max_cost scores 0
        clamped = min(spot.cost, max_cost)
        return (max_cost - clamped) / max_cost * 40

    def _score_distance(self, spot: ParkingSpot, user_lat: float | None, user_lon: float | None) -> float:
        """
        Weight = 25pts
        Closer spots score higher. Uses haversine formula for real distance.
        Within 0.1 miles = full 25pts, beyond 2 miles = 0pts.
        If no user location provided, give half credit (12.5pts).
        """
        # If we don't have the user's location or the spot's coordinates, give half credit
        if user_lat is None or user_lon is None:
            return 12.5
        if spot.latitude is None or spot.longitude is None:
            return 12.5

        distance_miles = self._haversine_distance(user_lat, user_lon, spot.latitude, spot.longitude)

        # Max distance we care about — beyond this, score is 0
        max_distance = 2.0
        if distance_miles >= max_distance:
            return 0.0
        walk_minutes = self._parse_walk_minutes(spot.walk_time)
        if walk_minutes is not None:
            max_walk = 20.0
            walk_bonus = max(0.0, (max_walk - walk_minutes) / max_walk * 2.5)
        # Closer = higher score, linearly scaled
        distance_score = (max_distance - distance_miles) / max_distance * 25
        if walk_minutes is not None:
            distance_score += walk_bonus
        return distance_score

    def _score_preferences(self, spot: ParkingSpot, user: User | None) -> float:
        """
        Weight = 10pts (reduced from 15pts)
        Full points if the spot's parking type matches what the user prefers.
        The user can have multiple preferred types (comma-separated).
        Example: user prefers "Parking Garage,Surface Lot"
                 spot is "Parking Garage" → 10pts
        """
        if not user or not user.preferred_parking_types or not spot.parking_type:
            return 0.0

        # Split user's preferences into a list and clean whitespace
        # e.g. "Parking Garage, Street Parking" → ["Parking Garage", "Street Parking"]
        preferred = [p.strip().lower() for p in user.preferred_parking_types.split(",")]

        if spot.parking_type.lower() in preferred:
            return 10.0  # CHANGED: 15.0 → 10.0

        return 0.0

    def _score_travel_time(self, spot: ParkingSpot, user_lat: float | None, user_lon: float | None, travel_mode: str = "driving") -> float:
        """
        Weight = 15pts (NEW - prioritizes shortest travel time to parking spot)
        Calculates estimated time to reach parking based on travel mode.
        
        Travel modes and estimated speeds:
        - Walking: 3 mph (~20 min/mile)
        - Cycling: 10 mph (~6 min/mile)
        - Driving: 25 mph (~2.4 min/mile)
        
        Scoring:
        - 0-5 min = 15 pts (excellent)
        - 5-10 min = 10 pts (good)
        - 10-15 min = 5 pts (acceptable)
        - 15+ min = 0 pts (too far)
        """
        if user_lat is None or user_lon is None:
            return 7.5  # Half credit if no user location
        if spot.latitude is None or spot.longitude is None:
            return 7.5
        
        distance_miles = self._haversine_distance(user_lat, user_lon, spot.latitude, spot.longitude)
        
        # Convert distance to travel time based on mode
        if travel_mode == "walking":
            travel_time_minutes = distance_miles * 20  # ~3 mph
        elif travel_mode == "cycling":
            travel_time_minutes = distance_miles * 6  # ~10 mph  
        else:  # driving (default)
            travel_time_minutes = distance_miles * 2.4  # ~25 mph
        
        # Score based on time buckets (prioritizes shortest times)
        if travel_time_minutes <= 5:
            return 15.0
        elif travel_time_minutes <= 10:
            return 10.0
        elif travel_time_minutes <= 15:
            return 5.0
        else:
            return 0.0



    def _score_major(self, spot: ParkingSpot, user: User | None) -> float:
        """
        Weight = 5pts (reduced from 10pts)
        Full points if the spot is on the same campus as the user's major.
        Uses major_category to determine campus:
          STEM / Business → East Bank
          Social Science / Arts → West Bank
          Liberal Arts → mixed, defaults to East Bank
        """
        if not user or not user.major_category or not spot.campus_location:
            return 0.0

        # Look up which campus this major category belongs to
        expected_campus = MAJOR_CAMPUS_MAP.get(user.major_category)
        if expected_campus is None:
            return 0.0

        # Full points if spot is on the right campus
        if spot.campus_location.lower() == expected_campus.lower():
            return 5.0  # CHANGED: 10.0 → 5.0

        return 0.0

    def _score_verified(self, spot: ParkingSpot) -> float:
        """
        Weight = 5pts (reduced from 10pts)
        Verified spots get full points — they're confirmed to exist
        and be in a safe, legitimate area.
        """
        return 5.0 if spot.is_verified else 0.0  # CHANGED: 10.0 → 5.0

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates the real-world distance between two lat/lon points in miles.
        Uses the Haversine formula which accounts for Earth's curvature.
        """
        EARTHS_RADIUS = 3959  # Earth's radius in miles

        # Convert degrees to radians (required for trig functions)
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        # Haversine formula
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return EARTHS_RADIUS * c
    def _parse_walk_minutes(self, walk_time: str | None) -> float | None:
        """
        Converts a walk time string like "5 min walk" into a numeric value (5.0).
        If the format is unexpected or walk_time is None, returns None.
        """
        if walk_time is None:
            return None
        try:
            walk_time = re.findall(r'\d+', walk_time)
            return float(walk_time[0]) if walk_time else None
        except (ValueError, IndexError):
            return None
    def _score_event_proximity(
        self,
        spot: ParkingSpot,
        event_lat: float | None,
        event_lon: float | None
        )-> float:
        """
        Weight = up to 15 bonus pts
        Only nonzero when event coordinates are provided
        Within 0.1 miles of event = full 15pts
        Beyond 1 mile = 0pts
        the frontend can choose to hide the event row when it's zero rather than showing a useless bar.
        """
        if event_lat is None or event_lon is None:
            return 0.0
        if spot.latitude is None or spot.longitude is None:
            return 0.0
        # scale the result between 0 and 15 using 1.0 mile as max distance
        # anything at or beyond 1 mile returns 0.0
        distance = self._haversine_distance(event_lat, event_lon, spot.latitude, spot.longitude)
        max_distance = 1.0
        if distance >= max_distance:
            return 0.0
        if distance <= 0.1:
            return 15.0
        # Closer = higher score, linearly scaled
        return (max_distance - distance) / max_distance * 15
