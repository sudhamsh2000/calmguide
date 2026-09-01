"""Tests for the in-process LLM token-usage tracker.

Mirrors the shape of the response_timing tests: this is an observability
module, so the contract that matters is (a) aggregates are correct, (b) an
empty window reports "no signal" rather than zeros, and (c) nothing here can
raise into a request path.
"""

import pytest

from app.services import token_usage


@pytest.fixture(autouse=True)
def _clear_samples():
    token_usage.reset()
    yield
    token_usage.reset()


def test_empty_window_reports_no_signal_not_zeros():
    """An untrafficked window must be distinguishable from genuinely-zero usage.

    Averages are None rather than 0 so a caller can't mistake "we haven't
    measured anything" for "the prompt is free".
    """
    stats = token_usage.get_token_stats()
    assert stats["samples"] == 0
    assert stats["avg_prompt_tokens"] is None
    assert stats["avg_completion_tokens"] is None
    assert stats["cache_hit_rate"] is None
    assert stats["by_model"] == {}


def test_records_and_averages_usage():
    token_usage.record_usage("gpt-4o-mini", prompt_tokens=6000, completion_tokens=400)
    token_usage.record_usage("gpt-4o-mini", prompt_tokens=6200, completion_tokens=600)

    stats = token_usage.get_token_stats()
    assert stats["samples"] == 2
    assert stats["avg_prompt_tokens"] == 6100.0
    assert stats["avg_completion_tokens"] == 500.0
    assert stats["total_prompt_tokens"] == 12200
    assert stats["total_completion_tokens"] == 1000


def test_cache_hit_rate_is_share_of_prompt_tokens():
    token_usage.record_usage(
        "gpt-4o-mini", prompt_tokens=1000, completion_tokens=100, cached_tokens=750
    )
    assert token_usage.get_token_stats()["cache_hit_rate"] == 0.75


def test_cache_hit_rate_zero_when_nothing_cached():
    """The signal this module exists to surface: a big prompt caching nothing.

    A prompt that interpolates a high-cardinality value near the top reports
    ~0 cached tokens no matter how large it is, which is what distinguishes a
    prompt-structure problem from a prompt-length one.
    """
    token_usage.record_usage(
        "gpt-4o-mini", prompt_tokens=6247, completion_tokens=500, cached_tokens=0
    )
    stats = token_usage.get_token_stats()
    assert stats["cache_hit_rate"] == 0.0
    assert stats["avg_prompt_tokens"] == 6247.0


def test_breaks_down_by_model():
    """The multilingual path uses a different (pricier) model, so per-model
    attribution is needed to reason about cost, not just totals."""
    token_usage.record_usage("gpt-4o-mini", prompt_tokens=6000, completion_tokens=400)
    token_usage.record_usage("gpt-4o", prompt_tokens=6100, completion_tokens=500)
    token_usage.record_usage("gpt-4o", prompt_tokens=5900, completion_tokens=300)

    by_model = token_usage.get_token_stats()["by_model"]
    assert by_model["gpt-4o-mini"]["samples"] == 1
    assert by_model["gpt-4o"]["samples"] == 2
    assert by_model["gpt-4o"]["prompt_tokens"] == 12000
    assert by_model["gpt-4o"]["completion_tokens"] == 800


def test_window_is_bounded():
    """Fixed-size window — this is a rolling signal, not an unbounded ledger."""
    for _ in range(token_usage._WINDOW_SIZE + 50):
        token_usage.record_usage("gpt-4o-mini", prompt_tokens=100, completion_tokens=10)
    assert token_usage.get_token_stats()["samples"] == token_usage._WINDOW_SIZE
