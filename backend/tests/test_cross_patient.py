"""Tests for cross-patient strategy aggregation."""
import json
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.models.conversation import Conversation
from app.models.response_feedback import ResponseFeedback
from app.services.auth import hash_access_code
from app.services.crypto import encrypt


@pytest_asyncio.fixture
async def two_profiles_with_feedback(db_session: AsyncSession):
    """Two middle-stage profiles with feedback."""
    profiles = []
    for i, code in enumerate(["TESTPAT1", "TESTPAT2"]):
        p = Profile(
            access_code_hash=hash_access_code(code),
            disease_stage="middle",
            behavioral_patterns=encrypt("[]"),
            calming_strategies=encrypt("[]"),
            safety_concerns=encrypt("[]"),
        )
        db_session.add(p)
        await db_session.flush()
        profiles.append(p)

        from datetime import datetime, timezone
        conv_user = Conversation(
            session_id=f"session-{i}",
            profile_id=p.id,
            role="user",
            content=encrypt("test crisis"),
            locale_code="en",
            created_at=datetime.now(timezone.utc),
        )
        conv_asst = Conversation(
            session_id=f"session-{i}",
            profile_id=p.id,
            role="assistant",
            content=encrypt("guidance"),
            locale_code="en",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(conv_user)
        db_session.add(conv_asst)
        await db_session.flush()

        fb = ResponseFeedback(
            conversation_id=conv_asst.id,
            helpful=True,
            tags=encrypt(json.dumps(["music", "calm_approach"] if i == 0 else ["music"])),
            negative_reasons=None,
            source="home",
        )
        db_session.add(fb)

    await db_session.commit()
    return [p.id for p in profiles]


@pytest.mark.asyncio
async def test_aggregate_strategies(db_session, two_profiles_with_feedback):
    from app.services.cross_patient import compute_cross_patient_strategies
    result = await compute_cross_patient_strategies(db_session)
    assert len(result) > 0
    music_entries = [r for r in result if r["strategy_tag"] == "music"]
    assert len(music_entries) > 0
    assert music_entries[0]["helped_count"] >= 2


@pytest.mark.asyncio
async def test_get_cohort_strategies(db_session, two_profiles_with_feedback):
    from app.services.cross_patient import compute_cross_patient_strategies, get_cohort_strategies
    await compute_cross_patient_strategies(db_session)
    strategies = await get_cohort_strategies("middle:evening", db_session)
    assert isinstance(strategies, list)


@pytest.mark.asyncio
async def test_k_anonymity_threshold(db_session):
    """Cohorts with fewer than 5 profiles should return empty."""
    from app.services.cross_patient import get_cohort_strategies
    strategies = await get_cohort_strategies("late:morning", db_session)
    assert strategies == []
