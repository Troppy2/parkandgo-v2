from datetime import datetime, timezone

import pytest

from app.core.database import Base
from app.models.parking_history import ParkingHistory
from app.models.recommendation_context_log import RecommendationContextLog
from app.models.spot_reviews import SpotReview
from app.models.user_private_spots import UserPrivateSpot
from app.repositories.parking_history_repository import ParkingHistoryRepository
from app.repositories.recommendation_context_log_repository import RecommendationContextLogRepository
from app.repositories.spot_reviews_repository import SpotReviewsRepository
from app.repositories.user_private_spots_repository import UserPrivateSpotRepository
from app.schemas.parking_history import ParkingHistoryCreate, ParkingHistoryUpdate
from app.schemas.spot_reviews import SpotReviewCreate, SpotReviewUpdate
from app.schemas.user_private_spots import UserPrivateSpotCreate, UserPrivateSpotUpdate


def test_phase8_tables_are_registered() -> None:
    tables = set(Base.metadata.tables.keys())
    assert {"spot_reviews", "parking_history", "recommendation_context_log", "user_private_spots"}.issubset(tables)


@pytest.mark.asyncio
async def test_spot_reviews_repository_crud(db_session, test_user, test_spot):
    repo = SpotReviewsRepository(db_session)
    created = await repo.create_review(
        test_user.user_id,
        SpotReviewCreate(spot_id=test_spot.spot_id, rating=5, notes="Well lit and safe"),
    )

    assert created.review_id is not None
    assert created.user_id == test_user.user_id

    reviews = await repo.get_reviews_for_spot(test_spot.spot_id)
    assert len(reviews) == 1
    assert reviews[0].notes == "Well lit and safe"

    average, count = await repo.get_average_rating(test_spot.spot_id)
    assert average == 5.0
    assert count == 1

    updated = await repo.update_review(created.review_id, SpotReviewUpdate(notes="Changed note"))
    assert updated is not None
    assert updated.notes == "Changed note"


@pytest.mark.asyncio
async def test_parking_history_repository_crud(db_session, test_user, test_spot):
    repo = ParkingHistoryRepository(db_session)
    created = await repo.create_history(
        test_user.user_id,
        ParkingHistoryCreate(
            spot_id=test_spot.spot_id,
            start_time=datetime.now(timezone.utc),
            consent_flag=True,
        ),
    )

    assert created.history_id is not None
    assert created.consent_flag is True

    rows = await repo.get_by_user(test_user.user_id)
    assert len(rows) == 1

    updated = await repo.update_history(created.history_id, ParkingHistoryUpdate(consent_flag=False))
    assert updated is not None
    assert updated.consent_flag is False


@pytest.mark.asyncio
async def test_user_private_spot_repository_crud(db_session, test_user):
    repo = UserPrivateSpotRepository(db_session)
    created = await repo.create_private_spot(
        test_user.user_id,
        UserPrivateSpotCreate(
            name="Home Spot",
            latitude=44.98,
            longitude=-93.23,
            notes="Use the back entrance",
            is_default=True,
        ),
    )

    assert created.private_spot_id is not None
    assert created.is_default is True

    rows = await repo.get_by_user(test_user.user_id)
    assert len(rows) == 1

    updated = await repo.update_private_spot(
        test_user.user_id,
        created.private_spot_id,
        UserPrivateSpotUpdate(notes="Updated note", is_default=False),
    )
    assert updated is not None
    assert updated.notes == "Updated note"
    assert updated.is_default is False

    deleted = await repo.delete_private_spot(test_user.user_id, created.private_spot_id)
    assert deleted is True


@pytest.mark.asyncio
async def test_recommendation_context_log_repository_create(db_session, test_user):
    repo = RecommendationContextLogRepository(db_session)
    created = await repo.create_log(
        action="recommendations_served",
        context_data={"travel_mode": "walking", "limit": 5},
        user_id=test_user.user_id,
    )

    assert created.log_id is not None
    assert created.action == "recommendations_served"
    rows = await repo.get_recent()
    assert len(rows) == 1
    assert rows[0].context_data["limit"] == 5