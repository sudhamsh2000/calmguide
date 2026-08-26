"""Episode cycle detection and care-level scoring for behavioral pattern alerts."""
from datetime import date, datetime, timedelta, timezone
from statistics import mean, stdev


def detect_episode_cycle(episode_dates: list[date]) -> dict:
    """Detect recurring cycle in episode dates.

    Requires >=5 episodes across >=14 days. Returns cycle info with confidence.
    """
    if len(episode_dates) < 5:
        return {"detected": False}

    sorted_dates = sorted(set(episode_dates))
    if len(sorted_dates) < 5:
        return {"detected": False}

    span = (sorted_dates[-1] - sorted_dates[0]).days
    if span < 14:
        return {"detected": False}

    intervals = [(sorted_dates[i + 1] - sorted_dates[i]).days for i in range(len(sorted_dates) - 1)]
    intervals = [i for i in intervals if i > 0]

    if len(intervals) < 3:
        return {"detected": False}

    avg = mean(intervals)
    if avg < 0.5:
        return {"detected": False}

    sd = stdev(intervals) if len(intervals) > 1 else 0.0
    cv = sd / avg if avg > 0 else 999.0

    if cv > 0.7:
        return {"detected": False}

    confidence = "high" if cv < 0.3 else "moderate" if cv < 0.5 else "low"
    last_episode = sorted_dates[-1]
    next_expected = last_episode + timedelta(days=round(avg))

    return {
        "detected": True,
        "avg_interval_days": round(avg, 1),
        "last_episode_date": str(last_episode),
        "next_expected_date": str(next_expected),
        "confidence": confidence,
    }


def compute_risk_score(cycle: dict, trend: str, peak_time: str) -> int:
    """Compute 0-100 risk score from cycle position + trend.

    Returns 0 if no cycle detected.
    """
    if not cycle.get("detected"):
        return 0

    avg_interval = cycle.get("avg_interval_days", 0)
    if avg_interval <= 0:
        return 0

    last_date_str = cycle.get("last_episode_date")
    if not last_date_str:
        return 0

    last_date = date.fromisoformat(last_date_str)
    days_since = (date.today() - last_date).days

    position = days_since / avg_interval

    if position < 0.3:
        base = int(position * 30)
    elif position < 0.7:
        base = int(10 + (position - 0.3) * 75)
    elif position < 1.0:
        base = int(40 + (position - 0.7) * 100)
    else:
        base = 70

    trend_bonus = {"increasing": 20, "stable": 5, "decreasing": 0}.get(trend, 5)

    now_hour = datetime.now(timezone.utc).hour
    time_bonus = 0
    peak_hours = {"overnight": (22, 6), "morning": (6, 12), "afternoon": (12, 18), "evening": (18, 22)}
    if peak_time in peak_hours:
        start, end = peak_hours[peak_time]
        if start <= now_hour or now_hour < end:
            time_bonus = 10

    return min(100, base + trend_bonus + time_bonus)


def care_level_from_score(score: int) -> str:
    """Convert raw score to care level string."""
    return "needs_attention" if score >= 50 else "stable"
