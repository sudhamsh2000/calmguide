"""Generate suggested feedback tags from a coach response."""
import json
import logging

from app.schemas.feedback import PREDEFINED_TAGS
from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

_TAG_EXTRACTION_PROMPT = (
    "Extract 1-2 specific caregiving strategy keywords from this coach response's "
    "'RIGHT NOW' section. Return ONLY a JSON array of short keyword strings. "
    "Example: [\"play favorite music\", \"show photo album\"]. "
    "If no specific strategies beyond general advice, return []."
)


async def generate_suggested_tags(response_text: str, llm: LLMProvider) -> list[str]:
    """Generate hybrid tags: predefined base + LLM-extracted response-specific tags.

    Always returns at least the predefined tags. LLM failure falls back gracefully.
    """
    custom_tags: list[str] = []
    try:
        raw = await llm.completion(
            system_prompt=_TAG_EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": response_text}],
        )
        parsed = json.loads(raw.strip())
        if isinstance(parsed, list):
            custom_tags = [str(t).strip().lower() for t in parsed if isinstance(t, str) and t.strip()]
    except Exception as exc:
        logger.warning("Tag extraction failed, using predefined only: %s", exc)

    return list(PREDEFINED_TAGS) + custom_tags
