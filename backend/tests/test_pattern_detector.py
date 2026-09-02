"""Unit tests for episode cycle detection and risk scoring."""

from datetime import date, timedelta

import pytest


def _make_episode_dates(start: date, interval_days: int, count: int) -> list[date]:
    return [start + timedelta(days=i * interval_days) for i in range(count)]


def test_detect_cycle_regular_3day():
    from app.services.pattern_detector import detect_episode_cycle

    today = date.today()
    episodes = _make_episode_dates(today - timedelta(days=30), 3, 10)
    result = detect_episode_cycle(episodes)
    assert result["detected"] is True
    assert 2.5 <= result["avg_interval_days"] <= 3.5


def test_detect_cycle_insufficient_data():
    from app.services.pattern_detector import detect_episode_cycle

    episodes = [date.today(), date.today() - timedelta(days=3)]
    result = detect_episode_cycle(episodes)
    assert result["detected"] is False


def test_detect_cycle_irregular_no_pattern():
    from app.services.pattern_detector import detect_episode_cycle

    today = date.today()
    episodes = [today - timedelta(days=d) for d in [0, 1, 8, 10, 25, 28, 38, 39, 47]]
    result = detect_episode_cycle(episodes)
    assert result["detected"] is False or result["confidence"] == "low"


def test_risk_score_high_when_due():
    from app.services.pattern_detector import compute_risk_score

    cycle = {
        "detected": True,
        "avg_interval_days": 3.0,
        "last_episode_date": str(date.today() - timedelta(days=3)),
    }
    score = compute_risk_score(cycle, "increasing", "overnight")
    assert score > 50


def test_risk_score_low_after_recent_episode():
    from app.services.pattern_detector import compute_risk_score

    cycle = {"detected": True, "avg_interval_days": 3.0, "last_episode_date": str(date.today())}
    score = compute_risk_score(cycle, "stable", "overnight")
    assert score < 40


def test_risk_score_zero_when_no_cycle():
    from app.services.pattern_detector import compute_risk_score

    cycle = {"detected": False}
    score = compute_risk_score(cycle, "stable", "morning")
    assert score == 0


def test_care_level_from_score():
    from app.services.pattern_detector import care_level_from_score

    assert care_level_from_score(62) == "needs_attention"
    assert care_level_from_score(35) == "stable"
    assert care_level_from_score(0) == "stable"
