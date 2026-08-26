"""Unit tests for the per-IP rate limiter dependency."""

import pytest

from app import config
from app.services import rate_limit as rl


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, host="1.2.3.4", forwarded=None):
        self.client = _FakeClient(host)
        self.headers = {"x-forwarded-for": forwarded} if forwarded else {}


@pytest.fixture(autouse=True)
def _enable_rate_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "30")
    config.get_settings.cache_clear()
    rl._BUCKETS.clear()
    yield
    rl._BUCKETS.clear()
    config.get_settings.cache_clear()


async def test_allows_up_to_limit_then_blocks():
    dep = rl.rate_limit("test", max_requests=3, window_seconds=60)
    req = _FakeRequest()
    for _ in range(3):
        await dep(req)  # no raise
    with pytest.raises(Exception) as exc:
        await dep(req)
    assert getattr(exc.value, "status_code", None) == 429


async def test_separate_ips_have_separate_budgets():
    dep = rl.rate_limit("test", max_requests=2, window_seconds=60)
    a, b = _FakeRequest("10.0.0.1"), _FakeRequest("10.0.0.2")
    await dep(a)
    await dep(a)
    # b is unaffected by a's usage
    await dep(b)
    await dep(b)
    with pytest.raises(Exception):
        await dep(a)


async def test_disabled_flag_never_blocks(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    config.get_settings.cache_clear()
    dep = rl.rate_limit("test", max_requests=1, window_seconds=60)
    req = _FakeRequest()
    for _ in range(10):
        await dep(req)  # never raises when disabled


async def test_uses_forwarded_for_first_hop():
    dep = rl.rate_limit("test", max_requests=1, window_seconds=60)
    req = _FakeRequest(host="proxy", forwarded="9.9.9.9, 10.0.0.1")
    await dep(req)
    # Same forwarded client is now over budget
    with pytest.raises(Exception):
        await dep(_FakeRequest(host="proxy", forwarded="9.9.9.9, 10.0.0.1"))
