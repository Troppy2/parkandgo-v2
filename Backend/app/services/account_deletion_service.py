from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_event import ConsentEvent
from app.models.parking_history import ParkingHistory
from app.models.parking_spot import ParkingSpot
from app.models.recommendation_context_log import RecommendationContextLog
from app.models.saved_building import SavedBuilding
from app.models.saved_spot import SavedSpot
from app.models.spot_reviews import SpotReview
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.user_private_spots import UserPrivateSpot

"""
Deletion of a user account and everything personal attached to it.

Every table is handled EXPLICITLY rather than leaning on database cascades.
Only three of the nine foreign keys into `users` declare ondelete CASCADE
(user_preferences, consent_events, saved_buildings), and SQLite does not
enforce cascades at all unless PRAGMA foreign_keys is on, which the test suite
does not set. Doing it in application code means the behavior is identical on
Postgres and SQLite, and it is readable: this module is the answer to "what
exactly happens to my data when I delete my account", which the privacy policy
has to state accurately.

Two categories are deliberately NOT deleted:

1. Parking spots the user submitted. They are shared community content that
   other people's recommendations and saved spots point at, and `submitted_by`
   is nullable precisely so authorship can be dropped without destroying the
   spot. The link to the person is removed, the spot survives.

2. Recommendation context logs. `user_id` is nulled rather than the row being
   removed. What remains is `action` plus `context_data`, which by construction
   holds only spot ids, travel modes, and counts, never coordinates and never
   anything identifying, so an unlinked row is genuinely anonymous rather than
   pseudonymous.

Everything else is personal to the account and is removed outright.
"""


async def delete_user_account(db: AsyncSession, user: User) -> dict[str, int]:
    """
    Delete `user` and all personal records belonging to them.

    Returns a count per table so the caller can log or surface what happened.
    Runs inside the caller's transaction, so a failure part way through rolls
    the whole deletion back rather than leaving a half deleted account.
    """
    user_id = user.user_id
    removed: dict[str, int] = {}

    # Anonymize first, so nothing can observe a row that points at a user that
    # is already gone.
    result = await db.execute(
        update(ParkingSpot)
        .where(ParkingSpot.submitted_by == user_id)
        .values(submitted_by=None)
    )
    removed["parking_spots_unlinked"] = result.rowcount or 0

    result = await db.execute(
        update(RecommendationContextLog)
        .where(RecommendationContextLog.user_id == user_id)
        .values(user_id=None)
    )
    removed["context_logs_anonymized"] = result.rowcount or 0

    # Personal records, deleted outright.
    for label, model in (
        ("saved_spots", SavedSpot),
        ("saved_buildings", SavedBuilding),
        ("private_spots", UserPrivateSpot),
        ("parking_history", ParkingHistory),
        ("reviews", SpotReview),
        ("consent_events", ConsentEvent),
        ("preferences", UserPreferences),
    ):
        result = await db.execute(delete(model).where(model.user_id == user_id))
        removed[label] = result.rowcount or 0

    result = await db.execute(delete(User).where(User.user_id == user_id))
    removed["user"] = result.rowcount or 0

    return removed
