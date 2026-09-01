"""In-process LLM token accounting — cost visibility, not billing.

Third companion to `app.services.availability` (did recent LLM calls
*succeed*) and `app.services.response_timing` (how *long* did they take).
This module tracks how many *tokens* they consumed, so prompt-size and
caching decisions can be made from measurements instead of estimates.

Motivating question: the coach system prompt is large (~6k tokens) and is
re-sent on every request. Whether that is worth optimising depends on real
traffic and on how much of it the provider is already serving from its
prompt cache — neither of which was observable before this module existed.

`cached_tokens` is the number of prompt tokens the provider reported
serving from its own cache. OpenAI does this automatically for prompts
over ~1024 tokens, but only for a *stable prefix* — so a template that
interpolates a high-cardinality value (a patient name, say) near the top
will report ~0 cached tokens no matter how large it is. A persistently low
`cache_hit_rate` here is the signal that prompt structure, not prompt
length, is the thing to fix.

Same scope decision as its two siblings: an in-memory, fixed-size window
per process, not a metrics store. In a multi-instance deployment each
worker only sees its own requests. Back this with a real metrics backend
before using it for budgeting or forecasting.

Only calls that actually reported usage are recorded. Providers that don't
return usage (or streams that fail mid-flight) are skipped rather than
recorded as zero, which would silently drag the averages toward zero and
make the prompt look cheaper than it is.
"""

from collections import deque
from dataclasses import dataclass
from threading import Lock

# How many of the most recent samples to keep.
_WINDOW_SIZE = 200

_lock = Lock()
_samples: deque["TokenSample"] = deque(maxlen=_WINDOW_SIZE)


@dataclass(frozen=True, slots=True)
class TokenSample:
    """One LLM call's reported token usage."""

    model: str
    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int


def record_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cached_tokens: int = 0,
) -> None:
    """Record one LLM call's token usage.

    `cached_tokens` is the subset of `prompt_tokens` the provider served
    from its prompt cache (0 when the provider doesn't report it).
    """
    with _lock:
        _samples.append(
            TokenSample(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cached_tokens=cached_tokens,
            )
        )


def reset() -> None:
    """Test/ops helper — clear all tracked samples."""
    with _lock:
        _samples.clear()


def get_token_stats() -> dict[str, object]:
    """Rolling token-usage aggregates, informational only.

    Returns `{"samples": 0}` with null averages when there's been no
    traffic yet — same convention as `response_timing.get_timing_stats()`:
    not enough signal, not a fault.
    """
    with _lock:
        values = list(_samples)

    if not values:
        return {
            "samples": 0,
            "avg_prompt_tokens": None,
            "avg_completion_tokens": None,
            "avg_cached_tokens": None,
            "cache_hit_rate": None,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "by_model": {},
        }

    n = len(values)
    total_prompt = sum(s.prompt_tokens for s in values)
    total_completion = sum(s.completion_tokens for s in values)
    total_cached = sum(s.cached_tokens for s in values)

    by_model: dict[str, dict[str, float | int]] = {}
    for s in values:
        m = by_model.setdefault(
            s.model, {"samples": 0, "prompt_tokens": 0, "completion_tokens": 0, "cached_tokens": 0}
        )
        m["samples"] = int(m["samples"]) + 1
        m["prompt_tokens"] = int(m["prompt_tokens"]) + s.prompt_tokens
        m["completion_tokens"] = int(m["completion_tokens"]) + s.completion_tokens
        m["cached_tokens"] = int(m["cached_tokens"]) + s.cached_tokens

    return {
        "samples": n,
        "avg_prompt_tokens": round(total_prompt / n, 1),
        "avg_completion_tokens": round(total_completion / n, 1),
        "avg_cached_tokens": round(total_cached / n, 1),
        # Share of prompt tokens the provider served from its own cache.
        # Near-zero on a large prompt means the cacheable prefix is being
        # broken early — see the module docstring.
        "cache_hit_rate": round(total_cached / total_prompt, 3) if total_prompt else None,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "by_model": by_model,
    }
