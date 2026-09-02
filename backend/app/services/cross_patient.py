"""Cross-patient strategy aggregation — anonymized effectiveness data."""

import json
import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.cross_patient_strategies import CrossPatientStrategies
from app.models.profile import Profile
from app.models.response_feedback import ResponseFeedback
from app.schemas.feedback import PREDEFINED_TAGS
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

MIN_COHORT_SIZE = 5


async def compute_cross_patient_strategies(db: AsyncSession) -> list[dict]:
    """Compute anonymized strategy effectiveness across all profiles.

    Groups by (disease_stage, peak_time). Only counts predefined tags.
    """
    profiles_result = await db.execute(select(Profile))
    profiles = {p.id: p.disease_stage for p in profiles_result.scalars().all()}

    # Three queries for the whole population. This used to issue two per
    # profile inside a loop, each re-scanning that profile's entire
    # conversation history, so the nightly job's cost grew quadratically with
    # the user base.
    timestamps_result = await db.execute(
        select(Conversation.profile_id, Conversation.created_at).where(Conversation.role == "user")
    )

    hour_buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {"overnight": 0, "morning": 0, "afternoon": 0, "evening": 0}
    )
    for profile_id, created_at in timestamps_result.all():
        ts = created_at.replace(tzinfo=UTC) if created_at.tzinfo is None else created_at
        hour = ts.hour
        if hour < 6:
            bucket = "overnight"
        elif hour < 12:
            bucket = "morning"
        elif hour < 18:
            bucket = "afternoon"
        else:
            bucket = "evening"
        hour_buckets[profile_id][bucket] += 1

    # Build cohort key per profile
    cohort_map: dict[str, str] = {}
    for pid, stage in profiles.items():
        buckets = hour_buckets.get(pid)
        if buckets and sum(buckets.values()) > 0:
            peak = max(buckets, key=buckets.get)  # type: ignore[arg-type]
            cohort_map[pid] = f"{stage}:{peak}"

    # Aggregate feedback tags by cohort
    cohort_strategies: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    cohort_profiles: dict[str, set] = defaultdict(set)

    for pid, cohort_key in cohort_map.items():
        cohort_profiles[cohort_key].add(pid)

    feedback_result = await db.execute(
        select(Conversation.profile_id, ResponseFeedback.tags)
        .join(ResponseFeedback, ResponseFeedback.conversation_id == Conversation.id)
        .where(
            Conversation.role == "assistant",
            ResponseFeedback.helpful == True,
            ResponseFeedback.tags.is_not(None),
        )
    )
    for profile_id, encrypted_tags in feedback_result.all():
        cohort_key = cohort_map.get(profile_id)
        if not cohort_key:
            continue
        for tag in json.loads(decrypt(encrypted_tags)):
            if tag in PREDEFINED_TAGS:
                cohort_strategies[cohort_key][tag].add(profile_id)

    # Write to table
    now = datetime.now(UTC)
    await db.execute(delete(CrossPatientStrategies))

    results = []
    for cohort_key, strategies in cohort_strategies.items():
        total = len(cohort_profiles[cohort_key])
        for tag, profile_ids in strategies.items():
            entry = {
                "cohort_key": cohort_key,
                "strategy_tag": tag,
                "helped_count": len(profile_ids),
                "total_profiles": total,
            }
            db.add(
                CrossPatientStrategies(
                    id=str(uuid.uuid4()),
                    cohort_key=cohort_key,
                    strategy_tag=tag,
                    helped_count=len(profile_ids),
                    total_profiles=total,
                    computed_at=now,
                )
            )
            results.append(entry)

    await db.commit()
    return results


async def get_cohort_strategies(cohort_key: str, db: AsyncSession) -> list[dict]:
    """Get strategies for a specific cohort. Returns [] if cohort < 5 profiles."""
    result = await db.execute(
        select(CrossPatientStrategies)
        .where(CrossPatientStrategies.cohort_key == cohort_key)
        .order_by(CrossPatientStrategies.helped_count.desc())
    )
    strategies = []
    for row in result.scalars().all():
        if row.total_profiles < MIN_COHORT_SIZE:
            continue
        strategies.append(
            {
                "tag": row.strategy_tag,
                "helped": row.helped_count,
                # Exact cohort size, not something to be reconstructed from `rate`:
                # callers show "helped N of M families" to the model, and inverting
                # a rounded rate produced a wrong M.
                "total": row.total_profiles,
                "rate": round(row.helped_count / row.total_profiles, 2)
                if row.total_profiles > 0
                else 0,
            }
        )
    return strategies[:5]
