"""Behavioral pattern insights — derived from conversation history per profile."""
import json
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care_change_event import CareChangeEvent
from app.models.conversation import Conversation
from app.models.daily_checkin import DailyCheckin
from app.models.profile_insights import ProfileInsights
from app.models.response_feedback import ResponseFeedback
from app.services.care_window import is_excluded, pre_change_cutoff
from app.services.crypto import decrypt, encrypt
from app.services.pattern_detector import detect_episode_cycle, compute_risk_score, care_level_from_score

# How far back behavioural analysis looks. Long enough for cycle detection
# (which needs >=5 episodes over >=14 days) and seasonal-ish drift, short
# enough that the work stays flat as a family's history grows.
ANALYSIS_WINDOW_DAYS = 90

_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "have", "has", "had",
    "was", "are", "not", "but", "they", "what", "when", "will", "just", "does",
    "doesn", "didn", "won", "isn", "wasn", "aren", "weren", "hasn", "hadn",
    "him", "her", "his", "she", "you", "your", "our", "their", "don",
    "can", "about", "been", "were", "more", "than", "then", "into", "over",
    "also", "some", "very", "much", "said", "like", "know", "help", "going",
    "gets", "keep", "come", "back", "still", "down", "even", "time",
    "where", "here", "there", "really", "again", "night", "want", "need",
    "think", "make", "made", "take", "took", "tell", "told", "gave", "give",
}


async def compute_profile_insights(profile_id: str, db: AsyncSession) -> dict:
    """Compute behavioral pattern insights from a profile's conversation history."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    window_start = now - timedelta(days=ANALYSIS_WINDOW_DAYS)

    # Session count spans all history — it is a "how long have we been doing
    # this" number for the caregiver — but it is a COUNT, not a row fetch.
    total_result = await db.execute(
        select(func.count(distinct(Conversation.session_id)))
        .where(Conversation.profile_id == profile_id)
    )
    total = total_result.scalar_one() or 0

    # Everything else looks at recent behaviour only. Reading the full history
    # here meant every message ever sent was fetched and AES-decrypted on each
    # recompute, so the cost of a crisis session grew with how long the family
    # had been using the app — exactly backwards.
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.profile_id == profile_id,
            Conversation.created_at >= window_start,
        )
        .order_by(Conversation.created_at)
    )
    convs = result.scalars().all()

    # Group messages by session
    sessions: dict[str, list[Conversation]] = {}
    for c in convs:
        sessions.setdefault(c.session_id, []).append(c)

    # First message timestamp per session
    session_times: dict[str, datetime] = {}
    for sid, msgs in sessions.items():
        first = min(
            m.created_at.replace(tzinfo=timezone.utc) if m.created_at.tzinfo is None else m.created_at
            for m in msgs
        )
        session_times[sid] = first

    this_week = [sid for sid, t in session_times.items() if t >= week_ago]
    last_week = [sid for sid, t in session_times.items() if two_weeks_ago <= t < week_ago]

    # Time-of-day peak
    buckets: dict[str, int] = {"overnight": 0, "morning": 0, "afternoon": 0, "evening": 0}
    for t in session_times.values():
        h = t.hour
        if h < 6:
            buckets["overnight"] += 1
        elif h < 12:
            buckets["morning"] += 1
        elif h < 18:
            buckets["afternoon"] += 1
        else:
            buckets["evening"] += 1
    peak_time = max(buckets, key=buckets.get)  # type: ignore[arg-type]

    # Trend
    this_count, last_count = len(this_week), len(last_week)
    if last_count == 0 and this_count > 0:
        trend = "increasing"
    elif last_count == 0 and this_count == 0:
        trend = "stable"
    elif this_count >= last_count * 1.5:
        trend = "increasing"
    elif this_count <= last_count * 0.7:
        trend = "decreasing"
    else:
        trend = "stable"

    drift_alert = None
    if trend == "increasing" and this_count >= 3:
        drift_alert = {
            "last_count": last_count,
            "this_count": this_count,
        }

    # Resolution proxy: sessions with only 1 user message (resolved quickly).
    # Measured against the sessions in the window, not the lifetime count, so
    # older sessions can't dilute a rate computed from recent ones.
    windowed_sessions = len(sessions)
    resolved = sum(
        1 for msgs in sessions.values()
        if sum(1 for m in msgs if m.role == "user") == 1
    )
    resolution_rate = (
        round(resolved / windowed_sessions, 2) if windowed_sessions > 0 else 0.0
    )

    # Top trigger keywords from user messages
    words: list[str] = []
    for msgs in sessions.values():
        for m in msgs:
            if m.role == "user":
                text = decrypt(m.content)
                words.extend(
                    w for w in re.findall(r"[a-z]{4,}", text.lower())
                    if w not in _STOPWORDS
                )
    top_triggers = [w for w, _ in Counter(words).most_common(5)]

    # Feedback-based metrics
    effective_strategies: dict[str, int] = {}
    ineffective_reasons: dict[str, int] = {}

    # Correlated subquery rather than an IN-list of every assistant message id:
    # that list grew with the profile's history and was sent to the database on
    # every recompute.
    windowed_assistant_ids = (
        select(Conversation.id)
        .where(
            Conversation.profile_id == profile_id,
            Conversation.created_at >= window_start,
            Conversation.role == "assistant",
        )
        .scalar_subquery()
    )
    feedback_result = await db.execute(
        select(ResponseFeedback).where(
            ResponseFeedback.conversation_id.in_(windowed_assistant_ids),
            ResponseFeedback.helpful.is_not(None),
        )
    )
    all_feedback = feedback_result.scalars().all()

    for fb in all_feedback:
        if fb.helpful and fb.tags:
            for tag in json.loads(decrypt(fb.tags)):
                effective_strategies[tag] = effective_strategies.get(tag, 0) + 1
        if not fb.helpful and fb.negative_reasons:
            for reason in json.loads(decrypt(fb.negative_reasons)):
                ineffective_reasons[reason] = ineffective_reasons.get(reason, 0) + 1

    # Direct thumbs-up/down beats the single-message heuristic once there is
    # enough of it.
    if len(all_feedback) >= 3:
        helpful_count = sum(1 for fb in all_feedback if fb.helpful)
        resolution_rate = round(helpful_count / len(all_feedback), 2)

    # === Phase 3: Cycle detection + Risk scoring ===
    from datetime import date as date_type

    # A declared medication/care change holds out everything that came before
    # it for the length of its observation window (spec S-07b). The dossier
    # already honoured this; cycle detection and the risk score did not, so a
    # freshly medicated patient was still being scored on pre-change episodes.
    care_changes_result = await db.execute(
        select(CareChangeEvent).where(
            CareChangeEvent.profile_id == profile_id,
            CareChangeEvent.is_active == True,
        )
    )
    cutoff = pre_change_cutoff(care_changes_result.scalars().all(), now.date())

    episode_dates: list[date_type] = []
    for sid, t in session_times.items():
        episode_day = t.date() if isinstance(t, datetime) else t
        if not is_excluded(episode_day, cutoff):
            episode_dates.append(episode_day)

    # Also include daily check-in entries with severity != "calm"
    checkin_result = await db.execute(
        select(DailyCheckin).where(
            DailyCheckin.profile_id == profile_id,
            DailyCheckin.severity != "calm",
            DailyCheckin.check_date >= window_start.date(),
        )
    )
    for checkin in checkin_result.scalars().all():
        if not is_excluded(checkin.check_date, cutoff):
            episode_dates.append(checkin.check_date)

    episode_cycle = detect_episode_cycle(episode_dates)

    care_score_val = compute_risk_score(episode_cycle, trend, peak_time)
    care_level = care_level_from_score(care_score_val) if care_score_val > 0 else None

    # Top strategies from effective_strategies (feedback), sorted by count
    top_strategies = sorted(effective_strategies.keys(), key=lambda k: effective_strategies[k], reverse=True)[:3]

    return {
        "crisis_frequency": {
            "this_week": this_count,
            "last_week": last_count,
            "trend": trend,
            "total_sessions": total,
        },
        "peak_time": peak_time,
        "drift_alert": drift_alert,
        "resolution_rate": resolution_rate,
        "top_triggers": top_triggers,
        "effective_strategies": effective_strategies,
        "ineffective_reasons": ineffective_reasons,
        "episode_cycle": episode_cycle,
        "care_score": care_score_val,
        "care_level": care_level,
        "top_strategies_for_context": top_strategies,
    }


async def upsert_profile_insights(profile_id: str, payload: dict, db: AsyncSession) -> None:
    """Upsert profile_insights — one row per profile, updated on each computation."""
    encrypted = encrypt(json.dumps(payload))
    now = datetime.now(timezone.utc)

    # Try to get existing row
    existing = await db.execute(
        select(ProfileInsights).where(ProfileInsights.profile_id == profile_id)
    )
    row = existing.scalar_one_or_none()

    if row is None:
        db.add(ProfileInsights(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            computed_at=now,
            insights_json=encrypted,
        ))
    else:
        row.computed_at = now
        row.insights_json = encrypted

    await db.commit()
