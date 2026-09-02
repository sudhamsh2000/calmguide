"""Response quality guardrails for multilingual LLM output."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.llm_provider import LLMProvider


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    reason: str = ""


@dataclass(frozen=True)
class ScriptRule:
    pattern: re.Pattern[str]
    min_letters: int
    min_ratio: float


SCRIPT_RULES: dict[str, ScriptRule] = {
    "ar": ScriptRule(re.compile(r"[\u0600-\u06FF]"), min_letters=100, min_ratio=0.65),
    "hi": ScriptRule(re.compile(r"[\u0900-\u097F]"), min_letters=100, min_ratio=0.65),
    "ja": ScriptRule(re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF]"), min_letters=100, min_ratio=0.55),
    "ko": ScriptRule(
        re.compile(r"[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]"), min_letters=100, min_ratio=0.65
    ),
    "ta": ScriptRule(re.compile(r"[\u0B80-\u0BFF]"), min_letters=100, min_ratio=0.65),
    "zh": ScriptRule(re.compile(r"[\u4E00-\u9FFF]"), min_letters=100, min_ratio=0.65),
}

LATIN_SCRIPT_LOCALES = {"de", "en", "es", "fr", "pt-br"}

KNOWN_BAD_PHRASES = (
    "i am designed specifically for dementia caregiving support",
    "if you need help with a caregiving situation",
    "please share, and i'll do my best to assist you",
)

_DISRESPECTFUL_WORD_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bcrazy\b",
        r"\bcraziness\b",
        r"\bsenil\w*\b",
        r"\bmake\s+(?:him|her|them)\s+obey\b",
        r"\battention\s*seek\w*\b",
        r"\bmanipulat\w+\b",
        r"\b(?:such\s+a\s+|what\s+a\s+|just\s+a\s+)burden\b",
        r"\bdifficult\s+patient\b",
        r"\bdemented\b",
        r"\bvegetable\b",
        r"\bgone\s+(?:in\s+the\s+head|mental)\b",
    ]
]

_NEGATION_PREFIX = re.compile(
    r"\b(?:don'?t|do\s+not|never|avoid|stop)\b",
    re.IGNORECASE,
)
_DIRECTIVE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bcontrol\s+(?:him|her|them)\b",
        r"\bforce\s+(?:him|her|them)\b",
        r"\bshut\s+(?:him|her|them)\s+up\b",
    ]
]

# Non-English disrespectful phrases — keyed by base locale
LOCALIZED_DISRESPECTFUL_PHRASES: dict[str, tuple[str, ...]] = {
    "ta": (
        "பைத்தியம்",  # crazy
        "மூளை கெட்டவர்",  # brain-damaged (pejorative)
        "பாரம்",  # burden
        "கட்டுப்படுத்து",  # control (imperative)
        "வாயை மூடு",  # shut up
        "அடங்கு",  # obey/submit
    ),
    "hi": (
        "पागल",  # crazy
        "बोझ",  # burden
        "बूढ़ा",  # old (pejorative)
        "चुप करो",  # shut up
        "काबू करो",  # control
        "जबरदस्ती",  # force
    ),
    "ar": (
        "مجنون",  # crazy
        "عبء",  # burden
        "أسكته",  # shut him up
        "سيطر عليه",  # control him
        "أجبره",  # force him
    ),
    "zh": (
        "疯子",  # crazy
        "老糊涂",  # senile
        "负担",  # burden
        "控制",  # control
        "强迫",  # force
    ),
    "ja": (
        "ボケ老人",  # senile old person
        "負担",  # burden
        "おかしい",  # crazy
    ),
    "ko": (
        "미친",  # crazy
        "짐",  # burden
        "치매 노인",  # demented old person (pejorative)
    ),
}

LOCALIZED_FALLBACKS: dict[str, dict[str, str]] = {
    "coach": {
        "en": "I’m sorry — I didn’t generate that correctly. Please ask again. If this is urgent, stay with your loved one, lower noise, and use a calm voice.",
        "es": "Lo siento, no generé esa respuesta correctamente. Vuelve a intentarlo. Si es urgente, quédate con tu ser querido, reduce el ruido y habla con calma.",
        "zh": "抱歉，我刚才没有正确生成回复。请再试一次。如果情况紧急，请陪在亲人身边，降低周围噪音，并用平静的语气说话。",
        "hi": "क्षमा करें, मैं सही उत्तर नहीं दे पाया। कृपया फिर से पूछें। अगर स्थिति तुरंत ध्यान मांगती है, तो अपने प्रियजन के पास रहें, आसपास का शोर कम करें और शांत स्वर में बात करें।",
        "ta": "மன்னிக்கவும், சரியான பதிலை உருவாக்க முடியவில்லை. தயவுசெய்து மீண்டும் கேளுங்கள். நிலை அவசரமாக இருந்தால், உங்கள் அன்புக்குரியவருடன் அருகில் இருங்கள், சுற்றியுள்ள சத்தத்தை குறைக்கவும், அமைதியான குரலில் பேசவும்.",
        "ar": "عذرًا، لم أُنشئ الرد بشكل صحيح. يرجى المحاولة مرة أخرى. إذا كان الوضع عاجلًا، ابقَ مع الشخص الذي ترعاه، وخفّض الضوضاء من حوله، وتحدث بصوت هادئ.",
        "fr": "Désolé, je n’ai pas généré cette réponse correctement. Veuillez réessayer. Si la situation est urgente, restez près de votre proche, réduisez le bruit autour de lui et parlez d’une voix calme.",
        "pt-br": "Desculpe, não gerei essa resposta corretamente. Tente novamente. Se a situação for urgente, fique perto do seu ente querido, reduza o barulho ao redor e fale com calma.",
        "ja": "申し訳ありません。適切な回答を生成できませんでした。もう一度お試しください。緊急の場合は、本人のそばにいて、周囲の音を減らし、落ち着いた声で話してください。",
        "de": "Entschuldigung, ich habe diese Antwort nicht korrekt erzeugt. Bitte versuche es noch einmal. Wenn es dringend ist, bleib bei deinem Angehörigen, reduziere Umgebungsgeräusche und sprich mit ruhiger Stimme.",
        "ko": "죄송합니다. 답변을 올바르게 생성하지 못했습니다. 다시 시도해 주세요. 상황이 급하면 가족 곁에 머물고, 주변 소음을 줄이며, 차분한 목소리로 말해 주세요.",
    },
    "checkin": {
        "en": "I’m sorry — I didn’t generate that correctly. Please try again and tell me how you’re feeling right now.",
        "es": "Lo siento, no generé esa respuesta correctamente. Inténtalo de nuevo y cuéntame cómo te sientes ahora mismo.",
        "zh": "抱歉，我刚才没有正确生成回复。请再试一次，告诉我你现在的感受。",
        "hi": "क्षमा करें, मैं सही उत्तर नहीं दे पाया। कृपया फिर से बताइए कि आप अभी कैसा महसूस कर रहे हैं।",
        "ta": "மன்னிக்கவும், சரியான பதிலை உருவாக்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சித்து, இப்போது நீங்கள் எப்படி உணர்கிறீர்கள் என்று சொல்லுங்கள்.",
        "ar": "عذرًا، لم أُنشئ الرد بشكل صحيح. حاول مرة أخرى وأخبرني كيف تشعر الآن.",
        "fr": "Désolé, je n’ai pas généré cette réponse correctement. Réessaie et dis-moi comment tu te sens en ce moment.",
        "pt-br": "Desculpe, não gerei essa resposta corretamente. Tente novamente e me diga como você está se sentindo agora.",
        "ja": "申し訳ありません。適切な回答を生成できませんでした。もう一度試して、今の気持ちを教えてください。",
        "de": "Entschuldigung, ich habe diese Antwort nicht korrekt erzeugt. Versuche es bitte noch einmal und sag mir, wie du dich gerade fühlst.",
        "ko": "죄송합니다. 답변을 올바르게 생성하지 못했습니다. 다시 시도하시고 지금 어떤 기분인지 말씀해 주세요.",
    },
    "learn": {
        "en": "I’m sorry — I didn’t generate that feedback correctly. Please try again with your response.",
        "es": "Lo siento, no generé esa retroalimentación correctamente. Vuelve a intentarlo con tu respuesta.",
        "zh": "抱歉，我刚才没有正确生成反馈。请用你的回答再试一次。",
        "hi": "क्षमा करें, मैं सही प्रतिक्रिया नहीं दे पाया। कृपया अपने उत्तर के साथ फिर से प्रयास करें।",
        "ta": "மன்னிக்கவும், சரியான பின்னூட்டத்தை உருவாக்க முடியவில்லை. உங்கள் பதிலுடன் மீண்டும் முயற்சிக்கவும்.",
        "ar": "عذرًا، لم أُنشئ هذه الملاحظات بشكل صحيح. يرجى المحاولة مرة أخرى مع ردك.",
        "fr": "Désolé, je n’ai pas généré ce retour correctement. Réessaie avec ta réponse.",
        "pt-br": "Desculpe, não gerei esse feedback corretamente. Tente novamente com a sua resposta.",
        "ja": "申し訳ありません。適切なフィードバックを生成できませんでした。あなたの回答でもう一度お試しください。",
        "de": "Entschuldigung, ich habe dieses Feedback nicht korrekt erzeugt. Versuche es bitte mit deiner Antwort noch einmal.",
        "ko": "죄송합니다. 피드백을 올바르게 생성하지 못했습니다. 답변과 함께 다시 시도해 주세요.",
    },
}


def get_localized_fallback(mode: str, locale_code: str) -> str:
    """Safe static fallback text for a mode + locale.

    Used when the LLM call fails entirely (no model output to repair), so a
    caregiver mid-crisis always receives a calm, actionable message instead of
    silence or a stack trace.
    """
    fallback_map = LOCALIZED_FALLBACKS.get(mode, LOCALIZED_FALLBACKS["coach"])
    lc = (locale_code or "en").lower()
    if lc in fallback_map:
        return fallback_map[lc]
    base = lc.split("-", 1)[0]
    if base == "pt":
        base = "pt-br"
    return fallback_map.get(base, fallback_map["en"])


def _strip_machine_markers(text: str) -> str:
    return re.sub(r"\[\[SECTION:[a-z-]+\]\]", "", text, flags=re.IGNORECASE)


def _meaningful_letters(text: str) -> str:
    cleaned = _strip_machine_markers(text)
    cleaned = re.sub(r"```.*?```", " ", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"https?://\S+", " ", cleaned)
    cleaned = re.sub(r"[#*_>\-\d\[\]\(\)\{\}:/\\|]", " ", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


def validate_response_language(text: str, locale_code: str) -> ValidationResult:
    base_locale = locale_code.lower().split("-", 1)[0]
    cleaned = _meaningful_letters(text)
    lowered = cleaned.lower()

    for phrase in KNOWN_BAD_PHRASES:
        if phrase.replace(" ", "") in lowered:
            return ValidationResult(False, "known_english_boilerplate")

    if base_locale in LATIN_SCRIPT_LOCALES:
        return ValidationResult(True)

    rule = SCRIPT_RULES.get(base_locale)
    if rule is None:
        return ValidationResult(True)

    letters = [char for char in cleaned if char.isalpha()]
    if len(letters) < rule.min_letters:
        return ValidationResult(False, "response_too_short")

    matching_letters = sum(1 for char in letters if rule.pattern.match(char))
    ratio = matching_letters / max(len(letters), 1)
    if ratio < rule.min_ratio:
        return ValidationResult(False, f"script_ratio:{ratio:.2f}")

    # Detect romanised output for non-Latin locales:
    # if >20% of word-like tokens are pure ASCII, the LLM is likely
    # transliterating instead of using the correct script
    ascii_word_pattern = re.compile(r"^[a-zA-Z]+$")
    words = re.findall(r"\S+", _strip_machine_markers(text))
    if len(words) >= 10:
        ascii_words = sum(1 for w in words if ascii_word_pattern.match(w))
        ascii_ratio = ascii_words / len(words)
        if ascii_ratio > 0.20:
            return ValidationResult(False, f"romanised_output:{ascii_ratio:.2f}")

    return ValidationResult(True)


def validate_response_respect(text: str, locale_code: str = "en") -> ValidationResult:
    cleaned = _strip_machine_markers(text)

    for pattern in _DISRESPECTFUL_WORD_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return ValidationResult(False, f"disrespectful_phrase:{match.group()}")

    for pattern in _DIRECTIVE_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            window = cleaned[max(0, match.start() - 60) : match.start()]
            last_sentence = re.split(r"[.!?]", window)[-1]
            if not _NEGATION_PREFIX.search(last_sentence):
                return ValidationResult(False, f"disrespectful_phrase:{match.group()}")

    lowered = cleaned.lower()
    normalized = re.sub(r"\s+", " ", lowered)

    # Check locale-specific phrases
    base_locale = locale_code.lower().split("-", 1)[0]
    localized_phrases = LOCALIZED_DISRESPECTFUL_PHRASES.get(base_locale, ())
    for phrase in localized_phrases:
        if phrase in normalized:
            return ValidationResult(False, f"disrespectful_phrase_localized:{phrase}")

    return ValidationResult(True)


def validate_response_quality(text: str, locale_code: str) -> ValidationResult:
    language_validation = validate_response_language(text, locale_code)
    if not language_validation.is_valid:
        return language_validation

    respect_validation = validate_response_respect(text, locale_code)
    if not respect_validation.is_valid:
        return respect_validation

    return ValidationResult(True)


def build_repair_prompt(language: str, locale_code: str, mode: str, original_text: str) -> str:
    from app.services.prompt import LOCALE_TO_LANGUAGE_CONSTRAINT

    constraint = LOCALE_TO_LANGUAGE_CONSTRAINT.get(locale_code.lower(), "")
    constraint_block = f"\n\nLanguage-specific rules:\n{constraint}\n" if constraint else ""

    return (
        f"You are repairing a CalmGuide {mode} response.\n"
        f"Rewrite the assistant response so it is entirely in {language} for locale {locale_code}.\n"
        "Keep the meaning, keep markdown structure, and keep any [[SECTION:...]] markers exactly.\n"
        "Remove every sentence or fragment written in the wrong language or script.\n"
        "Do NOT translate word-by-word from English. Write naturally as a native speaker would.\n"
        "Do NOT invent words. If unsure of a word, rephrase the sentence simply.\n"
        "Use respectful, dignity-preserving language for both the caregiver and the person receiving care.\n"
        "Do not use insulting, coercive, belittling, or blameful wording.\n"
        f"{constraint_block}\n"
        f"Original response:\n{original_text}"
    )


async def guard_response_text(
    llm: LLMProvider,
    *,
    mode: str,
    locale_code: str,
    language: str,
    text: str,
) -> str:
    validation = validate_response_quality(text, locale_code)
    if validation.is_valid:
        return text

    repaired_text = await llm.completion(
        "You fix multilingual output quality issues for CalmGuide.",
        [{"role": "user", "content": build_repair_prompt(language, locale_code, mode, text)}],
    )
    repaired_validation = validate_response_quality(repaired_text, locale_code)
    if repaired_validation.is_valid:
        return repaired_text

    base_locale = locale_code.lower().split("-", 1)[0]
    fallback_map = LOCALIZED_FALLBACKS.get(mode, LOCALIZED_FALLBACKS["coach"])
    return fallback_map.get(base_locale, fallback_map["en"])


def chunk_text_for_sse(text: str, chunk_size: int = 40) -> list[str]:
    words = re.findall(r"\S+\s*|\n", text)
    if not words:
        return [text] if text else []

    chunks: list[str] = []
    current = ""
    for token in words:
        if len(current) + len(token) > chunk_size and current:
            chunks.append(current)
            current = token
        else:
            current += token
    if current:
        chunks.append(current)
    return chunks
