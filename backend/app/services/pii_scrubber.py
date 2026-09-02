"""Strip third-party PII from narrative text before encryption.

Preserves the patient's name and generic dementia relationship labels.
Uses regex heuristics — intentionally conservative (prefers false negatives
over false positives to avoid corrupting clinical narratives).
"""

import re

_NAME_PATTERN = re.compile(
    r"\b(?:Dr\.?\s+|Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+)?[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b"
)

_LOCATION_PATTERN = re.compile(r"\b(?:from|in|at|to)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*)\b")

_DOCTOR_PATTERN = re.compile(r"\bDr\.?\s+[A-Z][a-z]+\b")

GENERIC_DEMENTIA_NAMES = {
    "mom",
    "dad",
    "mother",
    "father",
    "grandma",
    "grandpa",
    "grandmother",
    "grandfather",
    "nana",
    "papa",
    "husband",
    "wife",
}


def scrub_third_party_pii(text: str, patient_name: str) -> str:
    patient_tokens = set()
    for token in patient_name.lower().split():
        patient_tokens.add(token)
    patient_tokens.update(GENERIC_DEMENTIA_NAMES)

    result = text

    for match in _DOCTOR_PATTERN.finditer(result):
        name_part = match.group().split()[-1].lower()
        if name_part not in patient_tokens:
            result = result.replace(match.group(), "[doctor]")

    for match in _LOCATION_PATTERN.finditer(result):
        location = match.group(1)
        if location.lower() not in patient_tokens:
            result = result.replace(location, "[location]")

    for match in _NAME_PATTERN.finditer(result):
        name = match.group()
        name_lower = name.lower().strip()
        if name_lower in patient_tokens:
            continue
        if name_lower.startswith("dr") or name_lower.startswith("["):
            continue
        is_sentence_start = match.start() == 0 or result[match.start() - 2 : match.start()] in (
            ". ",
            "! ",
            "? ",
        )
        if not is_sentence_start:
            result = result.replace(name, "[family member]")

    return result
