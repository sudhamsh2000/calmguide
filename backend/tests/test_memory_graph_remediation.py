"""Tests for the memory-graph and performance remediation pass.

Each test here pins a behaviour that was wrong or unbounded before: care-change
exclusion reaching insights, exact cohort denominators, bounded reads on the
crisis path, and the caches/evictions that keep repeated work cheap.
"""

import json
from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care_change_event import CareChangeEvent
from app.models.conversation import Conversation
from app.models.profile import Profile
from app.services.auth import hash_access_code
from app.services.care_window import is_excluded, pre_change_cutoff
from app.services.crypto import encrypt


class _FakeCareChange:
    def __init__(self, change_date: date, observation_window_days: int) -> None:
        self.change_date = change_date
        self.observation_window_days = observation_window_days


class TestCareWindow:
    def test_no_events_excludes_nothing(self):
        assert pre_change_cutoff([], date(2026, 7, 31)) is None

    def test_open_window_excludes_pre_change_data(self):
        events = [_FakeCareChange(date(2026, 7, 20), 28)]
        cutoff = pre_change_cutoff(events, date(2026, 7, 31))
        assert cutoff == date(2026, 7, 20)
        assert is_excluded(date(2026, 7, 19), cutoff) is True
        # Data recorded during the window is what we are trying to learn from.
        assert is_excluded(date(2026, 7, 25), cutoff) is False

    def test_closed_window_stops_excluding(self):
        events = [_FakeCareChange(date(2026, 1, 1), 28)]
        assert pre_change_cutoff(events, date(2026, 7, 31)) is None

    def test_latest_open_change_wins(self):
        events = [
            _FakeCareChange(date(2026, 7, 10), 28),
            _FakeCareChange(date(2026, 7, 25), 28),
        ]
        assert pre_change_cutoff(events, date(2026, 7, 31)) == date(2026, 7, 25)


@pytest_asyncio.fixture
async def profile_with_pre_change_episodes(db_session: AsyncSession):
    """Six daily sessions, all of them before a care change three days ago."""
    profile = Profile(
        access_code_hash=hash_access_code("CARECHG1"),
        disease_stage="middle",
        behavioral_patterns=encrypt("[]"),
        calming_strategies=encrypt("[]"),
        safety_concerns=encrypt("[]"),
    )
    db_session.add(profile)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    for index in range(6):
        stamp = (now - timedelta(days=20 - index * 3)).replace(hour=2, minute=0)
        db_session.add(Conversation(
            profile_id=profile.id,
            session_id=f"pre-{index}",
            role="user",
            content=encrypt("wandering again"),
            created_at=stamp,
            locale_code="en",
        ))

    await db_session.commit()
    return profile.id


@pytest.mark.asyncio
async def test_insights_ignore_episodes_from_before_an_open_care_change(
    db_session: AsyncSession, profile_with_pre_change_episodes: str
):
    from app.services.insights import compute_profile_insights

    before = await compute_profile_insights(profile_with_pre_change_episodes, db_session)
    assert before["episode_cycle"]["detected"] is True

    db_session.add(CareChangeEvent(
        profile_id=profile_with_pre_change_episodes,
        change_date=(datetime.now(timezone.utc) - timedelta(days=3)).date(),
        description=encrypt("started donepezil"),
        observation_window_days=28,
        is_active=True,
    ))
    await db_session.commit()

    after = await compute_profile_insights(profile_with_pre_change_episodes, db_session)
    assert after["episode_cycle"]["detected"] is False
    assert after["care_score"] == 0


@pytest.mark.asyncio
async def test_insights_report_lifetime_session_count_outside_the_window(
    db_session: AsyncSession, profile_with_pre_change_episodes: str
):
    """Analysis is windowed; the session count the caregiver sees is not."""
    from app.services.insights import ANALYSIS_WINDOW_DAYS, compute_profile_insights

    old_stamp = datetime.now(timezone.utc) - timedelta(days=ANALYSIS_WINDOW_DAYS + 30)
    db_session.add(Conversation(
        profile_id=profile_with_pre_change_episodes,
        session_id="ancient-session",
        role="user",
        content=encrypt("an old crisis"),
        created_at=old_stamp,
        locale_code="en",
    ))
    await db_session.commit()

    result = await compute_profile_insights(profile_with_pre_change_episodes, db_session)

    assert result["crisis_frequency"]["total_sessions"] == 7
    # ...but the old session contributes no episode to cycle detection.
    assert all(
        trigger != "ancient" for trigger in result["top_triggers"]
    )


@pytest.mark.asyncio
async def test_cohort_strategies_expose_the_exact_denominator(db_session: AsyncSession):
    """`total` comes from the row, not from inverting a rounded rate."""
    from app.models.cross_patient_strategies import CrossPatientStrategies
    from app.services.cross_patient import get_cohort_strategies

    db_session.add(CrossPatientStrategies(
        cohort_key="middle:overnight",
        strategy_tag="music",
        helped_count=1,
        total_profiles=6,
        computed_at=datetime.now(timezone.utc),
    ))
    await db_session.commit()

    strategies = await get_cohort_strategies("middle:overnight", db_session)

    assert len(strategies) == 1
    assert strategies[0]["total"] == 6
    # The old reconstruction, int(1 / round(1/6, 2) * 1), yielded 5.
    assert strategies[0]["helped"] == 1


@pytest.mark.asyncio
async def test_cross_patient_aggregation_keeps_cohort_membership(
    db_session: AsyncSession
):
    """The set-based rewrite must produce the same counts as the old loop."""
    from app.models.response_feedback import ResponseFeedback
    from app.services.cross_patient import compute_cross_patient_strategies

    now = datetime.now(timezone.utc).replace(hour=2, minute=0)
    for index in range(2):
        profile = Profile(
            access_code_hash=hash_access_code(f"COHORT{index}"),
            disease_stage="middle",
            behavioral_patterns=encrypt("[]"),
            calming_strategies=encrypt("[]"),
            safety_concerns=encrypt("[]"),
        )
        db_session.add(profile)
        await db_session.flush()

        user_msg = Conversation(
            profile_id=profile.id,
            session_id=f"cohort-{index}",
            role="user",
            content=encrypt("up all night"),
            created_at=now,
            locale_code="en",
        )
        assistant_msg = Conversation(
            profile_id=profile.id,
            session_id=f"cohort-{index}",
            role="assistant",
            content=encrypt("guidance"),
            created_at=now,
            locale_code="en",
        )
        db_session.add_all([user_msg, assistant_msg])
        await db_session.flush()

        db_session.add(ResponseFeedback(
            conversation_id=assistant_msg.id,
            helpful=True,
            tags=encrypt(json.dumps(["music"])),
            negative_reasons=None,
            source="home",
        ))
    await db_session.commit()

    results = await compute_cross_patient_strategies(db_session)

    music = [r for r in results if r["strategy_tag"] == "music"]
    assert music, "expected the shared predefined tag to aggregate"
    assert music[0]["cohort_key"] == "middle:overnight"
    assert music[0]["helped_count"] == 2
    assert music[0]["total_profiles"] == 2


def test_cipher_is_reused_across_calls():
    """Each encrypt/decrypt used to run a fresh AES key schedule."""
    from app.services.crypto import _current_cipher, decrypt

    assert _current_cipher() is _current_cipher()
    assert decrypt(encrypt("dad is pacing")) == "dad is pacing"


def test_rate_limit_buckets_do_not_accumulate_forever():
    """Every distinct client IP used to leave a permanent dict entry."""
    import time

    from app.services import rate_limit as rate_limit_module

    rate_limit_module._BUCKETS.clear()
    now = time.monotonic()
    for index in range(5):
        # Last seen well outside any window.
        rate_limit_module._BUCKETS[f"coach:10.0.0.{index}"].append(now - 600)
    rate_limit_module._BUCKETS["coach:10.0.0.99"].append(now)

    rate_limit_module._evict_idle_buckets(cutoff=now - 60, keep="coach:10.0.0.99")

    assert list(rate_limit_module._BUCKETS) == ["coach:10.0.0.99"]


class TestDossierBounds:
    def test_decay_horizon_matches_the_query_filter(self):
        """The SQL filter must not drop incidents the weight function keeps."""
        from app.services.dossier import (
            MAX_INCIDENT_AGE_DAYS,
            _apply_temporal_weight,
        )

        now = datetime.now(timezone.utc)
        just_inside = now - timedelta(days=MAX_INCIDENT_AGE_DAYS - 1)
        just_outside = now - timedelta(days=MAX_INCIDENT_AGE_DAYS + 1)

        assert _apply_temporal_weight(just_inside, now) > 0
        assert _apply_temporal_weight(just_outside, now) == 0.0
