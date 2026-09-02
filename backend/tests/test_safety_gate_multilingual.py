"""Tests for the multilingual safety gate.

Covers:
- Life-threat patterns in all 10 non-English languages
- Self-harm patterns in all 10 non-English languages
- False-positive prevention for common caregiver exhaustion phrases
- Locale-aware emergency number routing
- Mixed-language messages
- Priority ordering (life-threat beats self-harm)
"""

import pytest

from app.services.safety_gate import (
    LOCALE_EMERGENCY_NUMBERS,
    SafetyGateType,
    check_safety_gate,
)

# ---------------------------------------------------------------------------
# Life-threat patterns — English baseline
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "She is not breathing",
        "He can't breathe",
        "She stopped breathing",
        "no pulse detected",
        "He is having a seizure",
        "She is convulsing on the floor",
        "He is unconscious",
        "She is unresponsive",
        "He passed out on the kitchen floor",
        "He collapsed and hit his head",
        "I think she's having a heart attack",
        "He has chest pain",
        "She is having a stroke",
        "Her face is drooping on one side",
        "His speech is suddenly slurred",
        "She is bleeding badly and won't stop bleeding",
        "He fell down the stairs",
        "She fell and can't get up",
        "He swallowed pills",
        "She drank bleach",
        "He swallowed poison",
        "She is overdosing",
        "He is choking",
        "He got an electric shock",
        "The house is on fire",
        "She is in the pool and drowning",
    ],
)
def test_life_threat_english_triggers(message):
    result = check_safety_gate(message, locale_code="en")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Spanish (es)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "mamá no respira",
        "no puede respirar",
        "dejó de respirar",
        "sin pulso ahora",
        "ataque al corazón",
        "infarto",
        "Está convulsionando",
        "Está inconsciente",
        "se desmayó aquí",
        "derrame cerebral",
        "sobredosis",
        "se ahoga",
        "no reacciona",
        "sangra mucho",
    ],
)
def test_life_threat_spanish_triggers(message):
    result = check_safety_gate(message, locale_code="es")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — French (fr)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Il ne respire plus",
        "arrêt cardiaque",
        "crise cardiaque",
        "Elle est inconsciente",
        "Il s'est évanoui",
        "AVC soudain",
        "accident vasculaire",
        "hémorragie grave",
        "surdose",
        "ne réagit plus",
        "Il s'étouffe",
    ],
)
def test_life_threat_french_triggers(message):
    result = check_safety_gate(message, locale_code="fr")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — German (de)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Er atmet nicht",
        "Sie kann nicht atmen",
        "Herzinfarkt",
        "Herzanfall",
        "Schlaganfall",
        "Er ist bewusstlos",
        "Sie ist ohnmächtig",
        "Krampfanfall",
        "Überdosis",
        "Er erstickt",
        "starke Blutung heute",
        "Sie reagiert nicht",
    ],
)
def test_life_threat_german_triggers(message):
    result = check_safety_gate(message, locale_code="de")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Portuguese BR (pt-br)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "não respira agora",
        "ela não consegue respirar",
        "parou de respirar",
        "ataque cardíaco",
        "infarto",
        "convulsão",
        "Está inconsciente",
        "desmaiou aqui",
        "derrame",
        "overdose",
        "ela engasgou",
        "sangramento grave",
        "não reage",
    ],
)
def test_life_threat_portuguese_triggers(message):
    result = check_safety_gate(message, locale_code="pt-br")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Japanese (ja)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "息ができない",
        "呼吸してない",
        "呼吸停止",
        "心臓発作",
        "心停止",
        "けいれんしている",
        "痙攣",
        "意識不明",
        "意識がない",
        "意識を失った",
        "脳卒中",
        "大量出血",
        "溺れている",
        "窒息",
        "過量摂取",
    ],
)
def test_life_threat_japanese_triggers(message):
    result = check_safety_gate(message, locale_code="ja")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Korean (ko)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "숨을 못 쉬어요",
        "호흡이 없어요",
        "호흡정지",
        "심장마비",
        "심정지",
        "경련이 일어나고 있어요",
        "의식불명",
        "의식이 없어요",
        "뇌졸중",
        "과다 출혈",
        "익사",
        "질식",
        "과다 복용",
    ],
)
def test_life_threat_korean_triggers(message):
    result = check_safety_gate(message, locale_code="ko")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Chinese (zh)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "不能呼吸",
        "呼吸停止",
        "呼吸困难",
        "心脏病发",
        "心脏骤停",
        "心梗",
        "抽搐",
        "失去意识",
        "昏迷",
        "不省人事",
        "中风",
        "脑卒中",
        "大出血",
        "溺水",
        "窒息",
        "过量服药",
    ],
)
def test_life_threat_chinese_triggers(message):
    result = check_safety_gate(message, locale_code="zh")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Hindi (hi)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "सांस नहीं ले रहे",
        "सांस रुक गई",
        "दिल का दौरा पड़ा",
        "हार्ट अटैक",
        "बेहोश हो गए",
        "होश नहीं है",
        "दौरा पड़ा",
        "मिर्गी",
        "लकवा",
        "ब्रेन स्ट्रोक",
        "खून बह रहा है",
        "ज़हर खा लिया",
        "ओवरडोज़",
    ],
)
def test_life_threat_hindi_triggers(message):
    result = check_safety_gate(message, locale_code="hi")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Tamil (ta)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "மூச்சு விடவில்லை",
        "மூச்சு நின்று விட்டது",
        "மாரடைப்பு",
        "இதய செயலிழப்பு",
        "வலிப்பு வருகிறது",
        "நினைவிழந்தார்",
        "மயக்கம் வந்துவிட்டது",
        "பக்கவாதம்",
        "அதிக இரத்தப்போக்கு",
        "மூழ்குகிறார்",
        "விஷம் குடித்தார்",
        "அதிகப்படியான மருந்து",
    ],
)
def test_life_threat_tamil_triggers(message):
    result = check_safety_gate(message, locale_code="ta")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Life-threat patterns — Arabic (ar)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "لا يتنفس",
        "توقف عن التنفس",
        "نوبة قلبية",
        "سكتة قلبية",
        "سكتة دماغية",
        "تشنج",
        "فاقد الوعي",
        "إغماء",
        "نزيف حاد",
        "اختناق",
        "غرق",
        "تسمم",
        "جرعة زائدة",
    ],
)
def test_life_threat_arabic_triggers(message):
    result = check_safety_gate(message, locale_code="ar")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Self-harm patterns — English baseline
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "I want to kill myself",
        "I want to die",
        "I'm thinking about ending it all",
        "I'm suicidal",
        "I have suicidal thoughts",
        "I've been hurting myself",
        "I keep cutting myself",
        "I don't want to live anymore",
        "I'd rather be dead",
        "I'm planning to end my life",
        "There's no point in going on",
        "I've been having thoughts of suicide",
        "Thoughts about killing myself",
    ],
)
def test_self_harm_english_triggers(message):
    result = check_safety_gate(message, locale_code="en")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Spanish
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "quiero morir",
        "quiero matarme",
        "Pienso en el suicidio",
        "no quiero vivir más",
        "quiero acabar con todo",
        "quiero hacerme daño",
    ],
)
def test_self_harm_spanish_triggers(message):
    result = check_safety_gate(message, locale_code="es")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — French
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Je veux me tuer",
        "Je veux me suicider",
        "envie de mourir",
        "Je ne veux plus vivre",
        "suicide",
        "Je veux me faire du mal",
    ],
)
def test_self_harm_french_triggers(message):
    result = check_safety_gate(message, locale_code="fr")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — German
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Ich möchte mich umbringen",
        "Selbstmord",
        "Suizid",
        "Ich will nicht mehr leben",
        "Ich will sterben",
        "Ich will mir etwas antun",
    ],
)
def test_self_harm_german_triggers(message):
    result = check_safety_gate(message, locale_code="de")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Portuguese BR
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Quero me matar",
        "suicídio",
        "quero morrer",
        "não quero mais viver",
        "quero acabar com tudo",
        "quero me machucar",
    ],
)
def test_self_harm_portuguese_triggers(message):
    result = check_safety_gate(message, locale_code="pt-br")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Japanese
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "死にたい",
        "自殺したい",
        "死のう",
        "生きたくない",
        "自害したい",
        "命を絶ちたい",
    ],
)
def test_self_harm_japanese_triggers(message):
    result = check_safety_gate(message, locale_code="ja")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Korean
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "죽고 싶어요",
        "자살하고 싶어",
        "살고 싶지 않아요",
        "자해를 했어요",
    ],
)
def test_self_harm_korean_triggers(message):
    result = check_safety_gate(message, locale_code="ko")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Chinese
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "我想死",
        "我要自杀",
        "不想活了",
        "想自残",
        "结束生命",
        "结束一切",
    ],
)
def test_self_harm_chinese_triggers(message):
    result = check_safety_gate(message, locale_code="zh")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Hindi
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "मरना चाहता हूं",
        "आत्महत्या करना चाहता हूं",
        "जीना नहीं चाहता",
        "ख़ुद को मारना चाहता हूं",
        "जिंदगी ख़त्म करना चाहता हूं",
        "अपने आप को नुकसान करना चाहता हूं",
    ],
)
def test_self_harm_hindi_triggers(message):
    result = check_safety_gate(message, locale_code="hi")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Tamil
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "சாக விரும்புகிறேன்",
        "தற்கொலை செய்துகொள்ள விரும்புகிறேன்",
        "வாழ விரும்பவில்லை",
        "உயிரை மாய்க்க நினைக்கிறேன்",
        "என்னையே கொல்ல நினைக்கிறேன்",
    ],
)
def test_self_harm_tamil_triggers(message):
    result = check_safety_gate(message, locale_code="ta")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# Self-harm patterns — Arabic
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "أريد أن أموت",
        "انتحار",
        "أريد أقتل نفسي",
        "لا أريد أن أعيش",
        "أنهي حياتي",
        "إيذاء نفسي",
    ],
)
def test_self_harm_arabic_triggers(message):
    result = check_safety_gate(message, locale_code="ar")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


# ---------------------------------------------------------------------------
# FALSE POSITIVE prevention — Japanese exhaustion phrases
# These are common expressions of frustration, NOT suicidal intent.
# もう嫌だ = "I hate this / I'm fed up"
# もう無理 = "I can't take it anymore / I'm at my limit"
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "もう嫌だ、こんな生活",  # I hate this life (exhaustion)
        "もう無理かもしれない",  # I might be at my limit
        "もう嫌だと思うこともある",  # Sometimes I think I hate this
        "もう無理、疲れた",  # I can't take it, I'm tired
        "介護がもう嫌だと感じています",  # I feel like I hate caregiving
    ],
)
def test_false_positive_japanese_exhaustion_not_suicidal(message):
    """もう嫌だ and もう無理 are caregiver exhaustion phrases — must not trigger self-harm gate."""
    result = check_safety_gate(message, locale_code="ja")
    # These should not trigger the self-harm gate
    if result.triggered:
        assert result.gate_type != SafetyGateType.SELF_HARM, (
            f"False positive: '{message}' triggered self-harm gate but is a common exhaustion phrase"
        )


# ---------------------------------------------------------------------------
# FALSE POSITIVE prevention — Chinese ambiguous phrases
# 了断 commonly means "settle a debt/grudge", NOT suicide
# 活不下去 is often hyperbolic exhaustion: "can't go on like this"
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "活不下去了，太累了",  # Unbearable, too tired (common hyperbole)
        "这件事需要了断",  # This matter needs to be settled
        "和他了断这段关系",  # Settle/end this relationship with him
        "活不下去，需要帮助",  # Can't cope, need help
    ],
)
def test_false_positive_chinese_ambiguous_phrases(message):
    """活不下去 and 了断 in non-suicidal contexts must not trigger the self-harm gate."""
    result = check_safety_gate(message, locale_code="zh")
    if result.triggered:
        assert result.gate_type != SafetyGateType.SELF_HARM, (
            f"False positive: '{message}' triggered self-harm gate but is not suicidal intent"
        )


# ---------------------------------------------------------------------------
# FALSE POSITIVE prevention — Korean exhaustion phrases
# 더 이상 못 살 = "can't go on like this" (common exhaustion idiom, not suicidal)
# 살기 싫 = "don't feel like living" (common exhaustion idiom)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "더 이상 못 살겠어요, 너무 힘들어요",  # Can't go on like this, it's too hard
        "살기 싫다는 생각이 들어요",  # I feel like I don't want to live (exhaustion)
        "이런 삶이 더 이상 못 살겠어",  # Can't take this life anymore (exhaustion)
    ],
)
def test_false_positive_korean_exhaustion_phrases(message):
    """Korean exhaustion idioms must not be mistaken for suicidal intent."""
    result = check_safety_gate(message, locale_code="ko")
    if result.triggered:
        assert result.gate_type != SafetyGateType.SELF_HARM, (
            f"False positive: '{message}' triggered self-harm gate but is a common exhaustion idiom"
        )


# ---------------------------------------------------------------------------
# FALSE POSITIVE prevention — English safe phrases
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "She is choking up trying to explain",  # "choking up" != choking
        "She passed out the medication to residents",  # "passed out" the medication != fainted
        "I'm going on a trip next week",  # "going on" != suicidal
        "There's no point in going on that diet",  # not self-harm
        "I feel burned out today",  # burnout, not on fire
    ],
)
def test_false_positive_english_idioms(message):
    result = check_safety_gate(message, locale_code="en")
    assert result.triggered is False, (
        f"False positive: '{message}' incorrectly triggered the safety gate"
    )


# ---------------------------------------------------------------------------
# Priority: life-threat takes precedence over self-harm if both match
# ---------------------------------------------------------------------------


def test_life_threat_takes_priority_over_self_harm():
    """A message with both life-threat and self-harm signals should return LIFE_THREAT."""
    message = "She is not breathing and I want to die too"
    result = check_safety_gate(message, locale_code="en")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# No trigger — ordinary caregiver messages
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "She is wandering around the house at night",
        "He refuses to take a shower",
        "Mom keeps asking where Dad is",
        "He is confused about the date",
        "She hit me when I tried to dress her",
        "I'm exhausted and haven't slept in days",
        "He keeps repeating the same story",
        "She doesn't recognize me today",
    ],
)
def test_no_trigger_for_normal_caregiving_messages(message):
    result = check_safety_gate(message, locale_code="en")
    assert result.triggered is False


# ---------------------------------------------------------------------------
# Locale-aware emergency numbers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "locale,expected_emergency",
    [
        ("en", "911"),
        ("es", "112 or 911"),
        ("fr", "15 or 112"),
        ("de", "112"),
        ("pt-br", "192 (SAMU)"),
        ("ja", "119"),
        ("ko", "119"),
        ("zh", "120"),
        ("hi", "112"),
        ("ta", "112"),
        ("ar", "911 (Saudi) / 999 (UAE) / 123 (Egypt) / 112"),
    ],
)
def test_life_threat_response_contains_correct_emergency_number(locale, expected_emergency):
    result = check_safety_gate("She is not breathing", locale_code=locale)
    assert result.triggered is True
    assert expected_emergency in result.response_text, (
        f"Locale '{locale}': expected '{expected_emergency}' in response, got: {result.response_text[:200]}"
    )


@pytest.mark.parametrize(
    "locale,expected_crisis",
    [
        ("en", "988"),
        ("es", "024"),
        ("fr", "3114"),
        ("de", "0800-111-0-111"),
        ("pt-br", "188"),
        ("ja", "0120-279-338"),
        ("ko", "1393"),
        ("zh", "12320-5"),
        ("hi", "9152987821"),
        ("ta", "9152987821"),
    ],
)
def test_self_harm_response_contains_correct_crisis_number(locale, expected_crisis):
    result = check_safety_gate("I want to die", locale_code=locale)
    assert result.triggered is True
    assert expected_crisis in result.response_text, (
        f"Locale '{locale}': expected '{expected_crisis}' in response"
    )


def test_english_self_harm_response_references_988_lifeline():
    result = check_safety_gate("I want to kill myself", locale_code="en")
    assert "988 Suicide & Crisis Lifeline" in result.response_text


def test_english_life_threat_response_references_alzheimers_helpline():
    result = check_safety_gate("She is not breathing", locale_code="en")
    assert "1-800-272-3900" in result.response_text


# ---------------------------------------------------------------------------
# Mixed-language messages
# ---------------------------------------------------------------------------


def test_mixed_english_spanish_life_threat():
    """A message mixing English and Spanish life-threat terms triggers the gate."""
    result = check_safety_gate("She had an infarto — ataque al corazón!", locale_code="en")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


def test_mixed_english_japanese_self_harm():
    """Japanese self-harm phrase embedded in English context triggers the gate."""
    result = check_safety_gate("I'm so tired. 死にたい気持ちがあります。", locale_code="ja")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.SELF_HARM


def test_locale_code_does_not_restrict_pattern_matching():
    """Patterns for all languages are checked regardless of locale_code."""
    # Send a Spanish life-threat phrase but set locale to English
    result = check_safety_gate("No respira y está inconsciente", locale_code="en")
    assert result.triggered is True
    assert result.gate_type == SafetyGateType.LIFE_THREAT


# ---------------------------------------------------------------------------
# Response structure sanity checks
# ---------------------------------------------------------------------------


def test_life_threat_response_structure():
    result = check_safety_gate("He is having a seizure", locale_code="en")
    assert "medical emergency" in result.response_text.lower()
    assert "911" in result.response_text


def test_self_harm_response_structure():
    result = check_safety_gate("I want to end my life", locale_code="en")
    assert "988" in result.response_text
    assert "24/7" in result.response_text.lower() or "free" in result.response_text.lower()


def test_no_trigger_returns_empty_response():
    result = check_safety_gate("She keeps wandering at night", locale_code="en")
    assert result.triggered is False
    assert result.gate_type is None
    assert result.response_text == ""


# ---------------------------------------------------------------------------
# Empty and edge case inputs
# ---------------------------------------------------------------------------


def test_empty_message_does_not_trigger():
    result = check_safety_gate("", locale_code="en")
    assert result.triggered is False


def test_whitespace_only_message_does_not_trigger():
    result = check_safety_gate("   \n\t  ", locale_code="en")
    assert result.triggered is False


def test_unknown_locale_falls_back_to_english_numbers():
    """Unsupported locale should fall back to English emergency numbers."""
    result = check_safety_gate("She is not breathing", locale_code="sw")  # Swahili, not supported
    assert result.triggered is True
    assert "911" in result.response_text


# ---------------------------------------------------------------------------
# Language scope vs emergency geography
# ---------------------------------------------------------------------------


def test_emergency_locale_resolves_beyond_the_three_supported_languages():
    """Narrowing to three languages must not narrow emergency numbers.

    CalmGuide answers in English, Spanish and Hindi only. Emergency numbers are
    a matter of where the caregiver is, not what language we speak to them in —
    someone in Paris reading the English UI still needs 15/112, not 911. These
    two resolvers are deliberately separate, and this pins that they are.
    """
    from app.services.prompt import resolve_locale_code
    from app.services.safety_gate import resolve_emergency_locale

    for header, expected_emergency in [
        ("fr-FR", "fr"),
        ("de-DE", "de"),
        ("ja-JP", "ja"),
        ("pt-BR", "pt-br"),
    ]:
        # Language falls back to English — the locale is out of scope.
        assert resolve_locale_code(header) == "en"
        # Emergency geography does not.
        assert resolve_emergency_locale(header) == expected_emergency


def test_emergency_response_uses_local_number_for_out_of_scope_locale():
    """A French caregiver gets English prose containing French numbers."""
    from app.services.safety_gate import build_gate_response_text, resolve_emergency_locale

    text = build_gate_response_text(SafetyGateType.LIFE_THREAT, resolve_emergency_locale("fr-FR"))
    assert "15 or 112" in text
    assert "911" not in text


def test_emergency_locale_falls_back_to_english_for_unknown():
    from app.services.safety_gate import resolve_emergency_locale

    assert resolve_emergency_locale("xx-XX") == "en"
    assert resolve_emergency_locale(None) == "en"
