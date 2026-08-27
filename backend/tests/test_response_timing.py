"""Unit tests for app.services.response_timing, the in-process response-
latency tracker backing /health's informational timing block."""

import pytest

from app.services import response_timing


@pytest.fixture(autouse=True)
def _reset():
    response_timing.reset()
    yield
    response_timing.reset()


def test_empty_stats_report_zero_samples_and_null_percentiles():
    stats = response_timing.get_timing_stats()
    assert stats["llm"]["time_to_first_chunk"] == {"p50_ms": None, "p95_ms": None, "samples": 0}
    assert stats["llm"]["total"] == {"p50_ms": None, "p95_ms": None, "samples": 0}
    assert stats["rag_retrieval"] == {"p50_ms": None, "p95_ms": None, "samples": 0}


def test_llm_timing_recorded_and_reflected_in_stats():
    response_timing.record_llm_timing(time_to_first_chunk_ms=100, total_ms=500)
    response_timing.record_llm_timing(time_to_first_chunk_ms=200, total_ms=900)
    stats = response_timing.get_timing_stats()
    assert stats["llm"]["time_to_first_chunk"]["samples"] == 2
    assert stats["llm"]["total"]["samples"] == 2
    # p50 of [100, 200] (nearest-rank) is one of the two recorded values.
    assert stats["llm"]["time_to_first_chunk"]["p50_ms"] in (100, 200)


def test_rag_timing_recorded_and_reflected_in_stats():
    response_timing.record_rag_timing(50)
    response_timing.record_rag_timing(150)
    stats = response_timing.get_timing_stats()
    assert stats["rag_retrieval"]["samples"] == 2


def test_percentiles_over_known_distribution():
    # 1..100 ms, evenly spaced — p50/p95 should land near the expected rank.
    for ms in range(1, 101):
        response_timing.record_rag_timing(ms)
    stats = response_timing.get_timing_stats()
    assert stats["rag_retrieval"]["samples"] == 100
    assert 45 <= stats["rag_retrieval"]["p50_ms"] <= 55
    assert 90 <= stats["rag_retrieval"]["p95_ms"] <= 100


def test_window_is_bounded_to_most_recent_samples():
    # Fill well beyond the window with a single low value, then push in high
    # values — once the window is full of highs, the old lows should have
    # aged out and no longer pull the percentile down.
    for _ in range(response_timing._WINDOW_SIZE):
        response_timing.record_rag_timing(1)
    for _ in range(response_timing._WINDOW_SIZE):
        response_timing.record_rag_timing(1000)
    stats = response_timing.get_timing_stats()
    assert stats["rag_retrieval"]["samples"] == response_timing._WINDOW_SIZE
    assert stats["rag_retrieval"]["p50_ms"] == 1000


def test_reset_clears_all_metrics():
    response_timing.record_llm_timing(time_to_first_chunk_ms=10, total_ms=20)
    response_timing.record_rag_timing(5)
    response_timing.reset()
    stats = response_timing.get_timing_stats()
    assert stats["llm"]["total"]["samples"] == 0
    assert stats["rag_retrieval"]["samples"] == 0
