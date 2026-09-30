"""Generate live Moment Coach replies and score them against the evaluation framework.

Usage (from backend/, needs the configured provider's API key):
    python -m tests.evaluation.run_coach_validation --samples 3 --out ../docs/clinical-evaluation/runs

Each scenario goes through the same steps as a production turn: Safety Gate v2,
then (if allowed) the production coach prompt, the configured provider and
model, and the response guard with its repair pass. Two things differ from
production and are recorded in the run metadata:
  * RAG context is empty unless a vector store is reachable locally.
  * There is no conversation history, incident memory or clinical record.

Writes <out>/<run_id>/replies.jsonl (every sample, raw text + scores) and
<out>/<run_id>/summary.json. Framework: docs/clinical-evaluation/EVALUATION_FRAMEWORK.md.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

from app.config import get_settings
from app.services.llm import get_llm_provider
from app.services.prompt import render_coach_prompt
from app.services.response_guard import guard_response_text, validate_response_quality
from app.services.safety_decision import evaluate_safety_v2
from tests.evaluation.coach_framework import QUALITY_CODES, SAFETY_CODES, score_reply

REPO = Path(__file__).resolve().parents[3]
BATCH_DIR = REPO / "docs" / "clinical-evaluation" / "batches"
LEGACY_DIR = REPO / "backend" / "tests" / "scenarios"

# Legacy scenarios predate the framework. Only direct questions get a Q1
# "answer" pattern; routing is recorded but not scored (no expected_route).
_LEGACY_ANSWER = {
    "scenario_011": [r"tell (her|mom) (the time|what time)", r"answer (her|mom|the question)"],
}
# Categories where the prompt requires naming one unmet need (repetitive or
# escalating behaviour) — the 24 Sep unmet-needs defect is measured on these.
UNMET_NEED_CATEGORIES = {
    "repetition",
    "repetitive_questions",
    "sundowning",
    "aggression",
    "exit_seeking",
    "multiple_behaviours",
    "resistance",
}


def load_scenarios(which: str) -> list[dict]:
    scenarios: list[dict] = []
    if which in ("batch", "all"):
        for path in sorted(BATCH_DIR.glob("batch_*.json")):
            batch = json.loads(path.read_text())
            for sc in batch["scenarios"]:
                scenarios.append({**sc, "set": batch["batch"]})
    if which in ("legacy", "all"):
        for path in sorted(LEGACY_DIR.glob("scenario_*.json")):
            sc = json.loads(path.read_text())
            if sc["id"] in _LEGACY_ANSWER:
                sc["must_include"] = [{"id": "answer", "any_of": _LEGACY_ANSWER[sc["id"]]}]
            scenarios.append({**sc, "set": "legacy"})
    return scenarios


def _git_sha() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO)
            .decode()
            .strip()
        )
    except Exception:  # pragma: no cover
        return "unknown"


class PacedLLM:
    """Spaces out calls and retries rate-limit errors.

    The evaluation key may share an organisation-wide token limit with the live
    app, so runs stay well under it (default ~90k tokens/min at ~6k per call)
    rather than bursting and throttling real caregivers.
    """

    def __init__(self, llm, calls_per_minute: float = 15.0, retries: int = 6):
        self._llm = llm
        self._interval = 60.0 / calls_per_minute
        self._retries = retries
        self._lock = asyncio.Lock()
        self._next_at = 0.0

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        loop = asyncio.get_running_loop()
        for attempt in range(self._retries):
            async with self._lock:
                wait = self._next_at - loop.time()
                if wait > 0:
                    await asyncio.sleep(wait)
                self._next_at = loop.time() + self._interval
            try:
                return await self._llm.completion(system_prompt, messages, model_override)
            except Exception as exc:
                if "rate" not in type(exc).__name__.lower() or attempt == self._retries - 1:
                    raise
                await asyncio.sleep(10 * (attempt + 1))
        raise RuntimeError("unreachable")


async def run_one(llm, scenario: dict, sample: int, sem: asyncio.Semaphore) -> dict:
    situation = scenario["situation"]
    decision = evaluate_safety_v2(situation, locale_code="en")
    route = "coach" if decision.allow_llm else decision.risk_level.value.lower()
    record = {
        "scenario_id": scenario["id"],
        "set": scenario["set"],
        "category": scenario["category"],
        "sample": sample,
        "route": route,
        "gate_category": decision.category.value if decision.category else None,
        "guard_repaired": False,
        "text": "",
    }
    if decision.allow_llm:
        p = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=p["name"],
            disease_stage=p["disease_stage"],
            behavioral_patterns=p.get("behavioral_patterns", []),
            calming_strategies=p.get("calming_strategies", []),
            safety_concerns=p.get("safety_concerns", []),
        )
        async with sem:
            text = await llm.completion(prompt, [{"role": "user", "content": situation}])
            if not validate_response_quality(text, "en").is_valid:
                record["guard_repaired"] = True
                text = await guard_response_text(
                    llm, mode="coach", locale_code="en", language="English", text=text
                )
        record["text"] = text
    record["score"] = score_reply(record["text"], scenario, route=route).as_dict()
    return record


def summarise(records: list[dict], meta: dict) -> dict:
    coached = [r for r in records if r["route"] == "coach"]
    verdicts = Counter(r["score"]["verdict"] for r in records)
    safety = {}
    for code in SAFETY_CODES:
        vals = [
            r["score"]["safety"][code] for r in records if r["score"]["safety"][code] is not None
        ]
        safety[code] = {"n": len(vals), "pass": sum(vals)}
    quality = {}
    for code in QUALITY_CODES:
        vals = [
            r["score"]["quality"][code] for r in coached if r["score"]["quality"][code] is not None
        ]
        quality[code] = {
            "n": len(vals),
            "mean": round(sum(vals) / len(vals), 2) if vals else None,
            "dist": dict(Counter(vals)),
        }
    unmet = [r for r in coached if r["category"] in UNMET_NEED_CATEGORIES]
    per_scenario: dict[str, dict] = defaultdict(lambda: {"verdicts": [], "route": set()})
    for r in records:
        entry = per_scenario[r["scenario_id"]]
        entry["verdicts"].append(r["score"]["verdict"])
        entry["route"].add(r["route"])
        entry["set"] = r["set"]
        entry["category"] = r["category"]
    return {
        "meta": meta,
        "samples": len(records),
        "coached": len(coached),
        "gated": len(records) - len(coached),
        "guard_repairs": sum(r["guard_repaired"] for r in records),
        "missing_section_markers": sum("markers" in r["score"]["notes"] for r in coached),
        "verdicts": dict(verdicts),
        "safety": safety,
        "quality": quality,
        "unmet_need_check": {
            "n": len(unmet),
            "named_in_right_now": sum(r["score"]["quality"]["Q3"] == 2 for r in unmet),
            "named_anywhere": sum(r["score"]["quality"]["Q3"] >= 1 for r in unmet),
        },
        "per_scenario": {
            k: {**v, "route": sorted(v["route"])} for k, v in sorted(per_scenario.items())
        },
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--scenarios", choices=["batch", "legacy", "all"], default="all")
    parser.add_argument("--only", nargs="*", help="scenario ids to run")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--calls-per-minute", type=float, default=15.0)
    parser.add_argument("--out", type=Path, default=REPO / "docs" / "clinical-evaluation" / "runs")
    args = parser.parse_args()

    settings = get_settings()
    api_key = (
        settings.OPENAI_API_KEY if settings.LLM_PROVIDER == "openai" else settings.ANTHROPIC_API_KEY
    )
    model = settings.OPENAI_MODEL if settings.LLM_PROVIDER == "openai" else settings.ANTHROPIC_MODEL
    if not api_key:
        sys.exit(f"No API key configured for provider {settings.LLM_PROVIDER!r}")
    llm = PacedLLM(get_llm_provider(settings.LLM_PROVIDER, api_key, model), args.calls_per_minute)

    scenarios = load_scenarios(args.scenarios)
    if args.only:
        scenarios = [s for s in scenarios if s["id"] in args.only]
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    meta = {
        "run_id": run_id,
        "git_sha": _git_sha(),
        "provider": settings.LLM_PROVIDER,
        "model": model,
        "samples_per_scenario": args.samples,
        "scenarios": len(scenarios),
        "rag_context": "empty (no local vector store)",
    }
    print(f"Run {run_id}: {len(scenarios)} scenarios x {args.samples} on {model}")

    sem = asyncio.Semaphore(args.concurrency)
    jobs = [run_one(llm, sc, i, sem) for sc in scenarios for i in range(args.samples)]
    records = await asyncio.gather(*jobs)

    out = args.out / run_id
    out.mkdir(parents=True, exist_ok=True)
    with (out / "replies.jsonl").open("w") as fh:
        for r in records:
            fh.write(json.dumps(r) + "\n")
    summary = summarise(list(records), meta)
    (out / "summary.json").write_text(json.dumps(summary, indent=2))

    # A clinician scoring sheet: one blind reply per coached scenario.
    rng = random.Random(run_id)
    by_scenario: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        if r["route"] == "coach":
            by_scenario[r["scenario_id"]].append(r)
    sheet = [rng.choice(v) for _, v in sorted(by_scenario.items())]
    with (out / "clinician_sample.jsonl").open("w") as fh:
        for r in sheet:
            fh.write(json.dumps({k: r[k] for k in ("scenario_id", "sample", "text")}) + "\n")

    print(json.dumps({k: summary[k] for k in ("samples", "gated", "verdicts", "unmet_need_check")}))
    print(f"Wrote {out}")


if __name__ == "__main__":
    asyncio.run(main())
