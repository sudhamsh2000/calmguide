"""LLM-based incident extraction from Moment Coach conversations.

Uses single-pass extraction with confidence scoring. Fields below the
confidence threshold are set to None. Narrative fields are PII-scrubbed
before returning. Negative strategy patterns are flagged as safety concerns.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any


def _parse_json_object(raw: str) -> dict:
    """Parse a JSON object from an LLM response, tolerating ```json fences and
    surrounding prose (a common cause of silently-dropped extractions)."""
    s = (raw or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", s, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise

from jinja2 import Environment, FileSystemLoader

from app.services.pii_scrubber import scrub_third_party_pii

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)

CONFIDENCE_THRESHOLD = 0.60

NEGATIVE_STRATEGY_PATTERNS = [
    "physical restraint", "held down", "pinned",
    "held her down", "held him down", "hold her down", "hold him down",
    "locked in", "locked her in", "locked him in",
    "isolation", "locked room", "locked the door",
    "withholding food", "withholding medication",
    "threatening", "intimidating", "yelling at",
    "sedating without prescription",
]


def _render_extraction_prompt(profile: dict, patient_name: str) -> str:
    template = _env.get_template("extraction_system.jinja2")
    return template.render(
        disease_stage=profile.get("disease_stage", "unknown"),
        behavioral_patterns=profile.get("behavioral_patterns", []),
        calming_strategies=profile.get("calming_strategies", []),
    )


def _check_abuse_indicators(extraction: dict) -> bool:
    text_fields = [
        extraction.get("intervention_description", "") or "",
        extraction.get("behavior_description", "") or "",
    ]
    combined = " ".join(text_fields).lower()
    return any(pattern in combined for pattern in NEGATIVE_STRATEGY_PATTERNS)


def _apply_confidence_filter(extraction: dict) -> dict:
    confidences = extraction.get("field_confidences", {})
    filtered = dict(extraction)

    if confidences.get("antecedent", 1.0) < CONFIDENCE_THRESHOLD:
        filtered["antecedent_description"] = None
        filtered["antecedent_category"] = None
    if confidences.get("intervention", 1.0) < CONFIDENCE_THRESHOLD:
        filtered["intervention_description"] = None
    if confidences.get("outcome", 1.0) < CONFIDENCE_THRESHOLD:
        filtered["intervention_outcome"] = None

    return filtered


async def _call_extraction_llm(
    system_prompt: str,
    conversation_text: str,
    llm_provider: Any = None,
) -> dict[str, Any]:
    """Call LLM for extraction. Wired to provider in Task 7."""
    if llm_provider is None:
        raise NotImplementedError("LLM provider not wired yet")

    response_text = await llm_provider.completion(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": conversation_text}],
    )
    return _parse_json_object(response_text)


async def extract_incident_from_conversation(
    conversation_messages: list[dict[str, str]],
    profile: dict,
    patient_name: str,
    llm_provider: Any = None,
) -> dict[str, Any] | None:
    system_prompt = _render_extraction_prompt(profile, patient_name)

    conversation_text = "\n".join(
        f"{'Caregiver' if m['role'] == 'user' else 'AI'}: {m['content']}"
        for m in conversation_messages
    )

    try:
        raw_extraction = await _call_extraction_llm(
            system_prompt, conversation_text, llm_provider
        )
    except NotImplementedError:
        raise
    except Exception:
        logger.exception("Extraction LLM call failed")
        return None

    if not raw_extraction or not raw_extraction.get("behavior_category"):
        return None

    filtered = _apply_confidence_filter(raw_extraction)

    if filtered.get("behavior_description"):
        filtered["behavior_description"] = scrub_third_party_pii(
            filtered["behavior_description"], patient_name
        )
    if filtered.get("antecedent_description"):
        filtered["antecedent_description"] = scrub_third_party_pii(
            filtered["antecedent_description"], patient_name
        )
    if filtered.get("intervention_description"):
        filtered["intervention_description"] = scrub_third_party_pii(
            filtered["intervention_description"], patient_name
        )

    if _check_abuse_indicators(filtered):
        filtered["safety_concern"] = "potential_abuse_indicator"

    return filtered
