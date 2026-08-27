"""Unit tests for app.services.availability, the in-process LLM
availability tracker backing /health's degraded-mode reporting."""

import pytest

from app.services import availability


@pytest.fixture(autouse=True)
def _reset():
    availability.reset()
    yield
    availability.reset()


def test_unknown_with_no_samples():
    assert availability.get_llm_status() == "unknown"


def test_unknown_below_min_samples():
    availability.record_llm_failure()
    availability.record_llm_failure()
    # Only 2 samples recorded; _MIN_SAMPLES is 3 — too early to call it.
    assert availability.get_llm_status() == "unknown"


def test_available_when_all_recent_calls_succeed():
    for _ in range(5):
        availability.record_llm_success()
    assert availability.get_llm_status() == "available"


def test_degraded_when_majority_of_recent_calls_fail():
    for _ in range(2):
        availability.record_llm_success()
    for _ in range(3):
        availability.record_llm_failure()
    # 3/5 failures = 60% >= 50% threshold
    assert availability.get_llm_status() == "degraded"


def test_available_when_minority_of_recent_calls_fail():
    for _ in range(4):
        availability.record_llm_success()
    availability.record_llm_failure()
    # 1/5 failures = 20% < 50% threshold
    assert availability.get_llm_status() == "available"


def test_recovers_after_failures_age_out_of_window():
    for _ in range(20):
        availability.record_llm_failure()
    assert availability.get_llm_status() == "degraded"

    # New successes push the old failures out of the fixed-size window.
    for _ in range(20):
        availability.record_llm_success()
    assert availability.get_llm_status() == "available"


def test_window_is_bounded():
    for _ in range(100):
        availability.record_llm_success()
    # deque(maxlen=_WINDOW_SIZE) — internal size never exceeds the window.
    assert len(availability._recent) == availability._WINDOW_SIZE
