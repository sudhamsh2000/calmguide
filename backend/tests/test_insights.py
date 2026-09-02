"""Integration tests for behavioral pattern insights service."""

import json
from datetime import UTC, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.profile import Profile
from app.services.auth import hash_access_code
from app.services.crypto import encrypt


def _make_conv(
    profile_id: str,
    session_id: str,
    role: str,
    content: str,
    created_at: datetime,
    locale_code: str = "en",
) -> Conversation:
    return Conversation(
        profile_id=profile_id,
        session_id=session_id,
        role=role,
        content=encrypt(content),
        created_at=created_at,
        locale_code=locale_code,
    )


@pytest_asyncio.fixture
async def profile_with_history(db_session: AsyncSession):
    """A profile with 4 sessions: 3 this week (2 overnight), 1 last week."""
    profile = Profile(
        access_code_hash=hash_access_code("TESTCODE"),
        disease_stage="middle",
        behavioral_patterns=encrypt("[]"),
        calming_strategies=encrypt("[]"),
        safety_concerns=encrypt("[]"),
    )
    db_session.add(profile)
    await db_session.flush()

    now = datetime.now(UTC)
    week_ago = now - timedelta(days=7)

    def _days_ago_at_hour(days: int, hour: int) -> datetime:
        # Pin the hour-of-day explicitly so the "peak time" bucket is
        # deterministic regardless of the wall-clock time the test runs at.
        return (now - timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)

    # This week: 3 sessions (2 overnight at 2am, 1 morning at 9am)
    sessions_this_week = [
        ("s1", _days_ago_at_hour(1, 2), "Dad wandering at night"),
        ("s2", _days_ago_at_hour(2, 2), "sundowning again"),
        ("s3", _days_ago_at_hour(3, 9), "morning confusion"),
    ]
    for sid, ts, msg in sessions_this_week:
        db_session.add(_make_conv(profile.id, sid, "user", msg, ts))
        db_session.add(
            _make_conv(
                profile.id, sid, "assistant", "Here is guidance.", ts + timedelta(seconds=30)
            )
        )

    # Last week: 1 session
    db_session.add(
        _make_conv(profile.id, "s4", "user", "wandering episode", week_ago - timedelta(days=1))
    )
    db_session.add(
        _make_conv(
            profile.id, "s4", "assistant", "guidance", week_ago - timedelta(days=1, seconds=-30)
        )
    )

    await db_session.commit()
    return profile.id


@pytest.mark.asyncio
async def test_crisis_frequency(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert result["crisis_frequency"]["this_week"] == 3
    assert result["crisis_frequency"]["last_week"] == 1
    assert result["crisis_frequency"]["trend"] == "increasing"


@pytest.mark.asyncio
async def test_peak_time_overnight(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert result["peak_time"] == "overnight"


@pytest.mark.asyncio
async def test_drift_alert_set_when_increasing(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert result["drift_alert"] is not None
    assert result["drift_alert"]["this_count"] == 3  # this week's count


@pytest.mark.asyncio
async def test_top_triggers_extracted(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    # "wandering" appears in multiple messages
    assert "wandering" in result["top_triggers"]


@pytest.mark.asyncio
async def test_upsert_creates_then_updates(db_session, profile_with_history):
    from sqlalchemy import select

    from app.models.profile_insights import ProfileInsights
    from app.services.crypto import decrypt
    from app.services.insights import compute_profile_insights, upsert_profile_insights

    payload = await compute_profile_insights(profile_with_history, db_session)
    await upsert_profile_insights(profile_with_history, payload, db_session)
    await upsert_profile_insights(profile_with_history, payload, db_session)  # second upsert

    result = await db_session.execute(
        select(ProfileInsights).where(ProfileInsights.profile_id == profile_with_history)
    )
    rows = result.scalars().all()
    assert len(rows) == 1  # upsert, not duplicate insert
    stored = json.loads(decrypt(rows[0].insights_json))
    assert stored["crisis_frequency"]["this_week"] == 3


@pytest.mark.asyncio
async def test_total_sessions_in_frequency(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert result["crisis_frequency"]["total_sessions"] == 4  # 3 this week + 1 last week


@pytest.mark.asyncio
async def test_effective_strategies_from_feedback(db_session, profile_with_history):
    """Insights should include effective_strategies from feedback data."""
    import json

    from sqlalchemy import select

    from app.models.conversation import Conversation
    from app.models.response_feedback import ResponseFeedback
    from app.services.crypto import encrypt
    from app.services.insights import compute_profile_insights

    result = await db_session.execute(
        select(Conversation)
        .where(
            Conversation.profile_id == profile_with_history,
            Conversation.role == "assistant",
        )
        .limit(2)
    )
    assistants = result.scalars().all()

    for i, a in enumerate(assistants):
        db_session.add(
            ResponseFeedback(
                conversation_id=a.id,
                helpful=True,
                tags=encrypt(
                    json.dumps(["calm_approach", "music"] if i == 0 else ["calm_approach"])
                ),
                negative_reasons=None,
                source="home",
            )
        )
    await db_session.commit()

    payload = await compute_profile_insights(profile_with_history, db_session)
    assert "effective_strategies" in payload
    assert payload["effective_strategies"]["calm_approach"] == 2
    assert payload["effective_strategies"]["music"] == 1


@pytest.mark.asyncio
async def test_ineffective_reasons_from_feedback(db_session, profile_with_history):
    """Insights should include ineffective_reasons from negative feedback."""
    import json

    from sqlalchemy import select

    from app.models.conversation import Conversation
    from app.models.response_feedback import ResponseFeedback
    from app.services.crypto import encrypt
    from app.services.insights import compute_profile_insights

    result = await db_session.execute(
        select(Conversation)
        .where(
            Conversation.profile_id == profile_with_history,
            Conversation.role == "assistant",
        )
        .limit(1)
    )
    assistant = result.scalars().first()

    db_session.add(
        ResponseFeedback(
            conversation_id=assistant.id,
            helpful=False,
            tags=None,
            negative_reasons=encrypt(json.dumps(["too_generic"])),
            source="home",
        )
    )
    await db_session.commit()

    payload = await compute_profile_insights(profile_with_history, db_session)
    assert "ineffective_reasons" in payload
    assert payload["ineffective_reasons"]["too_generic"] == 1


@pytest.mark.asyncio
async def test_episode_cycle_in_insights(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert "episode_cycle" in result
    assert isinstance(result["episode_cycle"], dict)
    assert "detected" in result["episode_cycle"]


@pytest.mark.asyncio
async def test_care_level_in_insights(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert "care_level" in result
    assert result["care_level"] in ("needs_attention", "stable", None)


@pytest.mark.asyncio
async def test_top_strategies_for_context(db_session, profile_with_history):
    from app.services.insights import compute_profile_insights

    result = await compute_profile_insights(profile_with_history, db_session)
    assert "top_strategies_for_context" in result
    assert isinstance(result["top_strategies_for_context"], list)
