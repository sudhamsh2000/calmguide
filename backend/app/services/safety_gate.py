"""Deterministic safety gate — fires BEFORE any LLM call.

Matches life-threat and suicide/self-harm patterns via regex across
all supported languages. Returns structured deflection responses
that bypass the LLM entirely.
"""

import re
from dataclasses import dataclass
from enum import Enum


class SafetyGateType(str, Enum):
    LIFE_THREAT = "life_threat"
    SELF_HARM = "self_harm"
    CAREGIVER_HARM_RISK = "caregiver_harm_risk"
    ELDER_ABUSE_NEGLECT = "elder_abuse_neglect"

    # Safety Gate v2 Phase 3 (docs/SAFETY_GATE_V2_PLAN.md) — added for richer
    # classification/metadata on top of the four categories above, which
    # remain the only ones `check_safety_gate` itself ever returns as
    # `gate_type` (unchanged in this phase — see that function's docstring).
    # These six are produced only by the new `safety_categories.py` module,
    # consumed only by `safety_decision.SafetyDecision.category`. None of
    # them has a `_GATE_RESPONSE_BUILDERS` entry and none is ever passed to
    # `build_gate_response_text` — the user-facing emergency response text
    # is still selected from the original LIFE_THREAT/SELF_HARM/etc. value
    # exactly as before. Kept on this same enum (rather than a new one)
    # because Phase 2 established SafetyGateType as the one canonical
    # category type project-wide.
    BREATHING_DIFFICULTY = "breathing_difficulty"
    FALL_OR_HEAD_INJURY = "fall_or_head_injury"
    REDUCED_CONSCIOUSNESS = "reduced_consciousness"
    ACUTE_CHANGE = "acute_change"
    MEDICATION_RISK = "medication_risk"
    ROUTINE_CAREGIVER_ISSUE = "routine_caregiver_issue"


@dataclass(frozen=True, slots=True)
class SafetyGateResult:
    triggered: bool
    gate_type: SafetyGateType | None = None
    response_text: str = ""


_LIFE_THREAT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # English
        r"\b(?:not\s+breathing|can'?t\s+breathe|stopped?\s+breathing|no\s+pulse)\b",
        r"\b(?:choking(?!\s+(?:up|back|on\s+tears))|choked(?!\s+up))\b",
        r"\b(?:(?:having\s+a\s+|is\s+having\s+a\s+|had\s+a\s+)seizure|convuls(?:ing|ions?)|seizing)\b",
        r"\b(?:unconscious|unresponsive|won'?t?\s+wake|fainted)\b",
        r"\b(?:passed?\s+out\b(?!\s+(?:the|of|with|flying|flyers|brochures|pamphlets|leaflets|candy|samples|cards|business\s+cards|awards|certificates|gifts|snacks|water\s+bottles)))",
        r"\b(?:collapsed?\s+(?:on|to|and|at))\b",
        r"\b(?:heart\s+attack|chest\s+pain|cardiac\s+arrest)\b",
        r"\b(?:(?:having\s+a\s+|is\s+having\s+a\s+|signs?\s+of\s+(?:a\s+)?)stroke|one\s+side\s+(?:of\s+)?(?:face|body)\s+droop\w*|face\s+(?:is\s+)?droop\w*|(?:speech\s+is\s+)?suddenly\s+slurred|slurred?\s+speech)\b",
        r"\b(?:severe(?:ly)?\s+bleed\w*|blood\s+everywhere|won'?t?\s+stop\s+bleed\w*|bleed\w*\s+(?:badly|a\s+lot|profusely))\b",
        r"\b(?:head\s+injur|hit\s+(?:his|her|their)\s+head\s+hard)\b",
        r"\b(?:fell\s+(?:down\s+)?(?:the\s+)?stairs|fell\s+and\s+(?:can'?t|cannot)\s+(?:get\s+up|move|stand))\b",
        r"\b(?:burn(?:ing|ed|s)?\s+\w+\s+(?:badly|severely)|on\s+fire|house\s+fire)\b",
        r"\b(?:drown|underwater|in\s+the\s+(?:pool|bath)\s+and)\b",
        r"\b(?:(?:swallowed?|drank|ingested?)\s+(?:\w+\s+){0,4}?(?:pills|bleach|poison|chemicals?|cleaning))\b",
        # "took" needs an abnormal-quantity qualifier before it means overdose —
        # "she took her pills at eight" is routine medication administration and
        # must never escalate. Added 2026-09-25: "took a whole bottle of pills"
        # was reaching the LLM as a routine issue.
        r"\b(?:took|taken|has\s+taken)\s+(?:a\s+whole\s+|an?\s+entire\s+|a\s+bunch\s+of\s+|a\s+handful\s+of\s+|too\s+many\s+|lots\s+of\s+|all\s+(?:of\s+)?(?:her|his|their|the)\s+)(?:\w+\s+){0,2}?(?:pills|tablets|capsules|medications?|meds|medicine)\b",
        r"\b(?:electric\s+shock|electrocuted)\b",
        r"\b(?:anaphyla|allergic\s+reaction\s+and\s+(?:can'?t|cannot)\s+breathe)\b",
        r"\b(?:overdos(?:e|ed|ing))\b",
        r"\b(?:turning\s+blue|(?:lips|face|skin)\s+(?:is\s+|are\s+|turned\s+|are\s+turning\s+)?blue|blue\s+around\s+the\s+lips)\b",
    ]
]

_MULTILINGUAL_LIFE_THREAT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Spanish
        r"(?:no\s+(?:está\s+|esta\s+)?respira(?:ndo)?|no\s+puede\s+respirar|dejó\s+de\s+respirar|dejo\s+de\s+respirar|sin\s+pulso|ataque\s+al\s+corazón|ataque\s+cardíaco|infarto|convulsion(?:es|ando)|inconsciente|se\s+desmayó|derrame\s+cerebral|sobredosis|se\s+(?:está\s+|esta\s+)?ahoga(?:ndo)?|se\s+atraganta(?:ndo)?|no\s+reacciona|sangra\s+mucho)",
        # French
        r"(?:ne\s+respire\s+plus|arrêt\s+cardiaque|crise\s+cardiaque|convulsion|inconscient|s'est\s+évanoui|AVC|accident\s+vasculaire|hémorragie|surdose|overdose|ne\s+réagit\s+plus|s'étouffe)",
        # German
        r"(?:atmet\s+nicht|kann\s+nicht\s+atmen|Herzinfarkt|Herzanfall|Schlaganfall|bewusstlos|ohnmächtig|Krampfanfall|Überdosis|erstickt|starke\s+Blutung|reagiert\s+nicht)",
        # Portuguese
        r"(?:não\s+(?:respira|consegue\s+respirar)|parou\s+de\s+respirar|ataque\s+cardíaco|infarto|convulsão|inconsciente|desmaiou|derrame|overdose|sobredose|engasgou|sangramento\s+grave|não\s+reage)",
        # Japanese
        r"(?:息ができない|呼吸(?:してない|停止|困難)|心臓(?:発作|麻痺)|心停止|けいれん|痙攣|意識(?:不明|がない|を失)|脳卒中|大量出血|溺れ|窒息|過量摂取)",
        # Korean
        r"(?:숨을?\s*못\s*(?:쉬|쉽)|호흡(?:이\s*없|정지|곤란)|심장(?:마비|발작)|심정지|경련|발작|의식(?:불명|이\s*없|을\s*잃)|뇌졸중|과다\s*출혈|익사|질식|과다\s*복용)",
        # Chinese (Simplified)
        r"(?:不(?:能呼吸|呼吸了)|呼吸(?:停止|困难)|心脏(?:病发|骤停)|心梗|抽搐|癫痫|失去意识|昏迷|不省人事|中风|脑卒中|大出血|溺水|窒息|过量服药|服药过量)",
        # Hindi
        r"(?:सांस\s*नहीं|सांस\s*रुक|दिल\s*का\s*दौरा|हार्ट\s*अटैक|बेहोश|होश\s*नहीं|दौरा\s*पड़|मिर्गी|लकवा|ब्रेन\s*स्ट्रोक|खून\s*बह|ज़हर\s*खा|ओवरडोज़)",
        # Tamil
        r"(?:மூச்சு\s*(?:விடவில்லை|நின்று|திணற)|மாரடைப்பு|இதய\s*செயலிழப்பு|வலிப்பு|நினைவிழ|மயக்கம்|பக்கவாதம்|மூளை\s*பாதிப்பு|அதிக\s*இரத்தப்போக்கு|மூழ்கு|விஷம்\s*குடி|அதிகப்படியான\s*மருந்து)",
        # Arabic
        r"(?:لا\s*يتنفس|توقف\s*(?:عن\s*)?التنفس|نوبة\s*قلبية|سكتة\s*(?:قلبية|دماغية)|تشنج|فاقد\s*الوعي|إغماء|نزيف\s*(?:حاد|شديد)|اختناق|غرق|تسمم|جرعة\s*زائدة)",
    ]
]

_SELF_HARM_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # English
        r"\b(?:kill\s+myself|want(?:s)?\s+to\s+die|end(?:ing)?\s+(?:it\s+all|my\s+life))\b",
        r"\b(?:suicid(?:e|al)|suicidal\s+thought)\b",
        r"\b(?:self[- ]?harm|hurt(?:ing)?\s+myself|cutting\s+myself)\b",
        r"\b(?:I\s+don'?t\s+want\s+to\s+(?:live|be\s+alive|exist)|I'?d?\s+rather\s+(?:be\s+dead|die))\b",
        r"\b(?:plan(?:ning)?\s+to\s+(?:kill|end|harm)\s+myself)\b",
        r"\b(?:no\s+(?:reason|point)\s+(?:to|in)\s+(?:go(?:ing)?\s+on\b(?!\s+(?:a\s+|that\s+|the\s+|his\s+|her\s+|any\s+|this\s+))|live|living|being\s+alive))\b",
        r"\b(?:thought(?:s)?\s+(?:of|about)\s+(?:suicide|killing\s+myself|ending\s+(?:it|my\s+life)|dying))\b",
    ]
]

_MULTILINGUAL_SELF_HARM_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Spanish
        r"(?:quiero\s+morir|matarme|suicid(?:io|arme)|no\s+quiero\s+vivir|acabar\s+con\s+(?:todo|mi\s+vida)|hacerme\s+daño)",
        # French
        r"(?:(?:me\s+|je\s+veux\s+)(?:tuer|suicider)|envie\s+de\s+mourir|en\s+finir|ne\s+veux\s+plus\s+vivre|suicide|me\s+faire\s+du\s+mal)",
        # German
        r"(?:(?:mich\s+)?umbringen|Selbstmord|Suizid|nicht\s+mehr\s+leben|will\s+sterben|mir\s+(?:etwas|was)\s+antun)",
        # Portuguese
        r"(?:(?:me\s+)?matar|suicíd(?:io|ar)|quero\s+morrer|não\s+quero\s+(?:mais\s+)?viver|acabar\s+com\s+tudo|me\s+machucar)",
        # Japanese — only unambiguous suicidal intent terms; もう嫌/もう無理 are common exhaustion phrases
        r"(?:死にたい|自殺|死のう|生きたくない|自(?:分を|害)|命を絶)",
        # Korean — removed 더 이상 못 살 and 살기 싫 (common exhaustion idioms, not suicidal intent)
        r"(?:죽고\s*싶|자살|살고\s*싶지\s*않|자해)",
        # Chinese — removed 了断 (common non-suicidal usage: settle a debt/grudge) and 活不下去 (common exhaustion hyperbole)
        r"(?:(?:想|要)(?:死|自杀)|不想活|自(?:杀|残)|结束(?:生命|一切))",
        # Hindi
        r"(?:मरना\s*चाहत|आत्महत्या|जीना\s*नहीं|ख़ुद\s*को\s*मार|जिंदगी\s*ख़त्म|अपने\s*आप\s*को\s*नुकसान)",
        # Tamil
        r"(?:சாக\s*(?:விரும்பு|ஆசை)|தற்கொலை|வாழ\s*விரும்பவில்லை|உயிரை\s*மாய்|என்னையே\s*(?:காயப்படுத்|கொல்ல))",
        # Arabic
        r"(?:أريد\s*(?:أن\s*)?أموت|انتحار|أقتل\s*نفسي|لا\s*أريد\s*(?:أن\s*)?أعيش|أنهي\s*حياتي|إيذاء\s*نفسي)",
    ]
]


_CAREGIVER_HARM_RISK_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\b(?:scared|afraid|terrified|worried)\s+(?:that\s+)?I\s+(?:might|could|will|would|am\s+going\s+to)\s+hurt\s+(?:him|her|them|myself|mom|dad|my\s+\w+)\b",
        r"\bI\s+(?:might|could)\s+(?:hurt|snap\s+at|lose\s+it\s+with|lash\s+out\s+at)\s+(?:him|her|them|mom|dad)\b",
        r"\bI\s+feel\s+like\s+I(?:'m|\s+am)\s+(?:going\s+to\s+)?(?:snap|lose\s+control|explode|hurt\s+(?:him|her|them))\b",
        r"\bafraid\s+of\s+what\s+I(?:'ll|\s+will|\s+might)\s+do\b",
        r"\bI\s+(?:almost|nearly)\s+(?:hit|hurt|shook|shoved)\s+(?:him|her|them|mom|dad)\b",
        r"\bI\s+can'?t\s+(?:control|trust)\s+my(?:self|\s+anger|\s+temper)\s+(?:around|with)\s+(?:him|her|them|mom|dad)\b",
    ]
]

_ELDER_ABUSE_NEGLECT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bleaves?\s+(?:him|her|them|mom|dad)\s+alone\s+for\s+days\b",
        r"\bhasn'?t\s+(?:been\s+)?(?:fed|bathed|changed|checked\s+on)\s+(?:in|for)\s+days\b",
        r"\b(?:unexplained\s+)?bruises?\s+(?:I\s+can'?t\s+explain|that\s+(?:worry|concern|scare)\s+me)\b",
        r"\b(?:my\s+\w+|the\s+(?:\w+\s+){0,2}?aide|the\s+(?:\w+\s+){0,2}?caregiver|the\s+staff)\s+(?:hits?|slaps?|slapped)\s+(?:him|her|them|mom|dad)\b",
        r"\bneglect(?:ed|ing|s)?\s+(?:him|her|them|mom|dad)\b",
        r"\blocks?\s+(?:him|her|them|mom|dad)\s+(?:in|out|in\s+(?:a|the)\s+room)\b",
        r"\bwithholds?\s+(?:his|her|their)\s+(?:food|medication|meds)\b",
        r"\bafraid\s+(?:someone|my\s+\w+|the\s+aide)\s+(?:is\s+)?(?:hurting|abusing|neglecting)\s+(?:him|her|them|mom|dad)\b",
    ]
]


# Emergency numbers by locale.
#
# This map is deliberately WIDER than the three languages CalmGuide answers in,
# and must not be trimmed to match them. Language scope and emergency geography
# are different things: a caregiver in Paris reading the English UI should still
# be told 15/112, not 911. Every gate response below is English prose regardless
# — the locale only selects which country's numbers appear in it.
#
# Callers therefore pass the *geographic* locale (resolve_emergency_locale),
# not the language-scoped one from prompt.resolve_locale_code().
LOCALE_EMERGENCY_NUMBERS: dict[str, dict[str, str]] = {
    "en": {
        "emergency": "911",
        "crisis": "988",
        "alzheimers": "1-800-272-3900",
        "crisis_text": "text HOME to 741741",
    },
    "es": {
        "emergency": "112 or 911",
        "crisis": "024 (Spain) / 800-290-0024 (Mexico)",
        "alzheimers": None,
        "crisis_text": None,
    },
    "fr": {"emergency": "15 or 112", "crisis": "3114", "alzheimers": None, "crisis_text": None},
    "de": {"emergency": "112", "crisis": "0800-111-0-111", "alzheimers": None, "crisis_text": None},
    "pt-br": {
        "emergency": "192 (SAMU)",
        "crisis": "188 (CVV)",
        "alzheimers": None,
        "crisis_text": None,
    },
    "ja": {"emergency": "119", "crisis": "0120-279-338", "alzheimers": None, "crisis_text": None},
    "ko": {"emergency": "119", "crisis": "1393", "alzheimers": None, "crisis_text": None},
    "zh": {"emergency": "120", "crisis": "12320-5", "alzheimers": None, "crisis_text": None},
    "hi": {
        "emergency": "112",
        "crisis": "9152987821 (iCall)",
        "alzheimers": None,
        "crisis_text": None,
    },
    "ta": {
        "emergency": "112",
        "crisis": "9152987821 (iCall)",
        "alzheimers": None,
        "crisis_text": None,
    },
    "ar": {
        "emergency": "911 (Saudi) / 999 (UAE) / 123 (Egypt) / 112",
        "crisis": None,
        "alzheimers": None,
        "crisis_text": None,
    },
}


def resolve_emergency_locale(accept_language: str | None) -> str:
    """Pick the locale whose emergency numbers to show, from a raw header.

    Separate from prompt.resolve_locale_code() on purpose. That one is capped at
    the three languages CalmGuide answers in; this one resolves against the full
    geography above, so narrowing language scope never silently starts telling a
    caregiver in Berlin to call 911. Unknown locales fall back to "en".
    """
    if not accept_language:
        return "en"
    for entry in accept_language.split(","):
        code = entry.strip().split(";")[0].strip().replace("_", "-").lower()
        if not code:
            continue
        if code in LOCALE_EMERGENCY_NUMBERS:
            return code
        base = code.split("-", 1)[0]
        if base in LOCALE_EMERGENCY_NUMBERS:
            return base
    return "en"


def _get_locale_numbers(locale_code: str) -> dict[str, str]:
    base = locale_code.lower().split("-", 1)[0] if locale_code else "en"
    if locale_code and locale_code.lower() in LOCALE_EMERGENCY_NUMBERS:
        return LOCALE_EMERGENCY_NUMBERS[locale_code.lower()]
    return LOCALE_EMERGENCY_NUMBERS.get(base, LOCALE_EMERGENCY_NUMBERS["en"])


def _build_911_response(locale_code: str) -> str:
    nums = _get_locale_numbers(locale_code)
    emergency = nums["emergency"]
    alzheimers_line = ""
    if nums.get("alzheimers"):
        alzheimers_line = (
            f"\n> **Alzheimer's Association 24/7 Helpline** — **{nums['alzheimers']}**"
        )

    return f"""## This sounds like a medical emergency.

**Call {emergency} now** (or your local emergency number).

While waiting for help:
- **Stay with them** — do not leave them alone
- **Do not move them** unless they are in immediate danger (fire, water)
- **Clear the area** around them to prevent further injury
- If they are **not breathing** and you know CPR, begin chest compressions
- **Unlock the front door** so paramedics can enter quickly

> **{emergency}** — Emergency services{alzheimers_line}

CalmGuide is not a substitute for emergency medical care. In life-threatening situations, always call {emergency} first."""


def _build_988_response(locale_code: str) -> str:
    nums = _get_locale_numbers(locale_code)
    crisis = nums.get("crisis") or "your local crisis helpline"
    emergency = nums["emergency"]

    crisis_line = f"**Crisis Helpline** — Call **{crisis}** (24/7, free, confidential)"
    if locale_code.lower().split("-", 1)[0] == "en":
        crisis_line = (
            "**988 Suicide & Crisis Lifeline** — Call or text **988** (24/7, free, confidential)"
        )

    alzheimers_line = ""
    if nums.get("alzheimers"):
        alzheimers_line = f"\n> **Alzheimer's Association 24/7 Helpline** — **{nums['alzheimers']}** (trained counselors who understand caregiver stress)"

    crisis_text_line = ""
    if nums.get("crisis_text"):
        crisis_text_line = f"\n> **Crisis Text Line** — {nums['crisis_text']}"

    return f"""## You are not alone.

What you're feeling is real, and reaching out takes courage.

**Please contact one of these services right now — they are available 24/7:**

> {crisis_line}{alzheimers_line}{crisis_text_line}

Caregiver burnout is a recognized, serious condition — not a personal failure. You deserve support, and trained humans are standing by right now.

If someone is in immediate physical danger, **call {emergency}**."""


def _build_caregiver_harm_risk_response(locale_code: str) -> str:
    """Deflection for caregivers disclosing fear of harming the care recipient.

    This is distinct from self-harm: the risk here is directed outward, at a
    moment of overwhelm/loss of control, not at the caregiver themselves.
    # TODO(CLINICAL-LEGAL-REVIEW): Jurisdictions may impose mandatory-reporting
    # or duty-to-warn obligations when a caregiver discloses risk of harming a
    # dependent adult. CalmGuide does not implement any such logic today — this
    # response only offers crisis resources and respite guidance. Any
    # mandatory-reporting behavior must be reviewed by clinical/legal counsel
    # and configured per jurisdiction before being added here.
    """
    nums = _get_locale_numbers(locale_code)
    crisis = nums.get("crisis") or "your local crisis helpline"
    emergency = nums["emergency"]
    crisis_line = f"**Crisis Helpline** — Call **{crisis}** (24/7, free, confidential)"
    if locale_code.lower().split("-", 1)[0] == "en":
        crisis_line = (
            "**988 Suicide & Crisis Lifeline** — Call or text **988** (24/7, free, confidential)"
        )
    alzheimers_line = ""
    if nums.get("alzheimers"):
        alzheimers_line = f"\n> **Alzheimer's Association 24/7 Helpline** — **{nums['alzheimers']}** (respite and caregiver-crisis support)"

    return f"""## Please pause and get support right now.

What you're describing — fearing you might hurt the person you care for — is a sign of caregiver burnout reaching a dangerous point. This is common, and it is not a moral failing, but it needs support right now, not later.

**If you feel you're close to losing control in this moment:**
- **Step away** — put the person somewhere safe and leave the room for a few minutes if you can
- **Call for backup** — a family member, neighbor, or respite service to take over right now
- **Reach out to one of these services immediately:**

> {crisis_line}{alzheimers_line}

If the person you care for is in immediate physical danger, **call {emergency}**.

CalmGuide is not a substitute for crisis intervention or professional support. Please talk to a trained counselor today."""


def _build_elder_abuse_neglect_response(locale_code: str) -> str:
    """Deflection when a caregiver discloses possible abuse/neglect of the care recipient.

    # TODO(CLINICAL-LEGAL-REVIEW): Elder abuse/neglect reporting obligations
    # (mandatory reporter status, timelines, agencies) vary by jurisdiction and
    # by the discloser's relationship to the patient (family caregiver vs.
    # licensed facility staff). CalmGuide does not determine mandatory-reporter
    # status or file reports. This response only surfaces the U.S. Eldercare
    # Locator as a general resource. Jurisdiction-specific hotlines/agencies
    # and any reporting-obligation logic must be added only after clinical/
    # legal review.
    """
    nums = _get_locale_numbers(locale_code)
    emergency = nums["emergency"]

    return f"""## This is serious, and you did the right thing by saying something.

What you're describing may be a sign of elder abuse or neglect. You don't have to figure out what to do about it alone.

**In the U.S.:**
> **Eldercare Locator** — Call **1-800-677-1116** (Mon–Fri, free, confidential) to be connected with your local Adult Protective Services agency

**If the person is in immediate danger, call {emergency}.**

If you're outside the U.S., search for "adult protective services" or "elder abuse hotline" plus your country or region.

CalmGuide is not a substitute for a formal report to protective services. Trained agencies can assess the situation and involve the right people to help keep everyone safe."""


_GATE_RESPONSE_BUILDERS = {
    SafetyGateType.LIFE_THREAT: _build_911_response,
    SafetyGateType.SELF_HARM: _build_988_response,
    SafetyGateType.CAREGIVER_HARM_RISK: _build_caregiver_harm_risk_response,
    SafetyGateType.ELDER_ABUSE_NEGLECT: _build_elder_abuse_neglect_response,
}


def build_gate_response_text(gate_type: SafetyGateType, locale_code: str = "en") -> str:
    """Build the deflection response text for a given gate type.

    Lets callers outside this module (e.g. the second-layer classifier) reuse
    the exact same locale-aware deflection copy as the deterministic gate,
    so a classifier-only match escalates identically to a regex match.

    Only accepts the four categories with an entry in `_GATE_RESPONSE_BUILDERS`
    (the original four `check_safety_gate`/`classify_message` can return).
    Safety Gate v2's finer categories (BREATHING_DIFFICULTY, etc.) have no
    entry here by design — see `response_category_for_text` below, which
    Phase 5 callers use to map them onto an existing builder instead of
    calling this function with them directly.
    """
    return _GATE_RESPONSE_BUILDERS[gate_type](locale_code)


# Safety Gate v2 Phase 5 (docs/SAFETY_GATE_V2_PLAN.md): categories Phase 3
# added for richer classification/metadata that still need a user-facing
# response when Phase 5 lets them escalate independently. Per the sprint's
# explicit instruction to "reuse existing localized escalation responses...
# do not add new clinical copy," each maps onto whichever of the four
# original categories' response text already fits — not a new template.
# The existing LIFE_THREAT (911) response already covers all three: it
# explicitly mentions checking breathing/CPR and covers any acute physical
# emergency generically, so BREATHING_DIFFICULTY, FALL_OR_HEAD_INJURY, and
# REDUCED_CONSCIOUSNESS all resolve to it rather than to invented,
# untested per-category copy.
_RESPONSE_TEXT_CATEGORY_MAP: dict[SafetyGateType, SafetyGateType] = {
    SafetyGateType.BREATHING_DIFFICULTY: SafetyGateType.LIFE_THREAT,
    SafetyGateType.FALL_OR_HEAD_INJURY: SafetyGateType.LIFE_THREAT,
    SafetyGateType.REDUCED_CONSCIOUSNESS: SafetyGateType.LIFE_THREAT,
}


def response_category_for_text(category: SafetyGateType) -> SafetyGateType:
    """Map any SafetyDecision category onto one `build_gate_response_text`
    already has a builder for. The four original categories pass through
    unchanged; Phase 3's finer LIFE_THREAT sub-categories map to
    LIFE_THREAT's own response. Raises KeyError (via build_gate_response_text)
    for ACUTE_CHANGE/MEDICATION_RISK/ROUTINE_CAREGIVER_ISSUE — those never
    reach this function; see safety_decision.py / coach.py for why."""
    return _RESPONSE_TEXT_CATEGORY_MAP.get(category, category)


def check_safety_gate(message: str, locale_code: str = "en") -> SafetyGateResult:
    """Check user message against deterministic safety patterns.

    Returns immediately if a life-threat or self-harm pattern matches.
    Life-threat takes priority over self-harm if both match.
    Checks patterns in all supported languages regardless of locale.
    """
    for pattern in _LIFE_THREAT_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.LIFE_THREAT,
                response_text=_build_911_response(locale_code),
            )

    for pattern in _MULTILINGUAL_LIFE_THREAT_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.LIFE_THREAT,
                response_text=_build_911_response(locale_code),
            )

    for pattern in _SELF_HARM_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.SELF_HARM,
                response_text=_build_988_response(locale_code),
            )

    for pattern in _MULTILINGUAL_SELF_HARM_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.SELF_HARM,
                response_text=_build_988_response(locale_code),
            )

    for pattern in _CAREGIVER_HARM_RISK_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.CAREGIVER_HARM_RISK,
                response_text=_build_caregiver_harm_risk_response(locale_code),
            )

    for pattern in _ELDER_ABUSE_NEGLECT_PATTERNS:
        if pattern.search(message):
            return SafetyGateResult(
                triggered=True,
                gate_type=SafetyGateType.ELDER_ABUSE_NEGLECT,
                response_text=_build_elder_abuse_neglect_response(locale_code),
            )

    return SafetyGateResult(triggered=False)
