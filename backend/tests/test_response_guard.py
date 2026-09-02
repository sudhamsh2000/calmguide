from collections.abc import AsyncGenerator

from app.services.llm_provider import LLMProvider
from app.services.response_guard import (
    chunk_text_for_sse,
    guard_response_text,
    validate_response_language,
    validate_response_quality,
    validate_response_respect,
)

# Realistic-length Hindi coach response for testing
VALID_HINDI_RESPONSE = (
    "[[SECTION:right-now]]\n"
    "उनके पास शांति से जाइए। धीरे और नरम आवाज़ में बात कीजिए। पास बैठिए। "
    "उनकी भावना को स्वीकार कीजिए। उनके सामने सीधे मत खड़े होइए।\n"
    "[[SECTION:why-this-happens]]\n"
    "अल्ज़ाइमर से पीड़ित लोगों में शाम के समय उलझन बढ़ जाती है। "
    "इसे सनडाउनिंग कहते हैं। थकान और आसपास के बदलाव इसका कारण हो सकते हैं।\n"
    "[[SECTION:what-not-to-do]]\n"
    "उन्हें मजबूर मत कीजिए। उनसे बहस मत कीजिए। अपनी आवाज़ ऊँची मत कीजिए।\n"
    "[[SECTION:escalation]]\n"
    "अगर उलझन तीस मिनट से ज़्यादा बनी रहे, तो उनके डॉक्टर से संपर्क कीजिए।\n"
)

VALID_HINDI_SHORT = "उनके पास शांति से जाइए। धीरे बोलिए। पास रहिए।"

REPAIRED_HINDI_RESPONSE = (
    "उनके पास शांति से जाइए और शांत आवाज़ में बात कीजिए। "
    "उनकी भावना को स्वीकार कीजिए और धीरे धीरे बोलिए। पास बैठिए और उनका हाथ पकड़िए। "
    "उनके सामने सीधे मत खड़े होइए, बल्कि थोड़ा बगल से जाइए। आसपास का शोर कम कीजिए। "
    "टेलीविज़न बंद कर दीजिए और रोशनी थोड़ी कम कीजिए। उन्हें किसी काम के लिए मजबूर मत कीजिए। "
    "उनसे बहस मत कीजिए और उनकी बात को गलत मत ठहराइए। थोड़ा समय दीजिए ताकि वे शांत हो सकें।"
)


class FakeLLM(LLMProvider):
    def __init__(self, completion_text: str):
        self._completion_text = completion_text

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        yield self._completion_text

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        return self._completion_text


def test_validate_response_language_accepts_valid_hindi():
    result = validate_response_language(VALID_HINDI_RESPONSE, "hi-IN")
    assert result.is_valid is True


def test_validate_response_language_rejects_short_response():
    result = validate_response_language(VALID_HINDI_SHORT, "hi-IN")
    assert result.is_valid is False
    assert result.reason == "response_too_short"


def test_validate_response_language_rejects_known_english_boilerplate():
    result = validate_response_language(
        "I am designed specifically for dementia caregiving support. If you need help with a caregiving situation, please share.",
        "hi-IN",
    )
    assert result.is_valid is False


def test_validate_response_respect_rejects_english_disrespectful_wording():
    result = validate_response_respect(
        "You need to control him and make him obey.",
        "en",
    )
    assert result.is_valid is False


def test_validate_response_respect_rejects_hindi_disrespectful_wording():
    result = validate_response_respect(
        "वह पागल की तरह व्यवहार कर रहे हैं।",
        "hi",
    )
    assert result.is_valid is False


def test_validate_response_quality_accepts_respectful_hindi():
    result = validate_response_quality(VALID_HINDI_RESPONSE, "hi-IN")
    assert result.is_valid is True


async def test_guard_response_text_repairs_invalid_hindi_response():
    llm = FakeLLM(REPAIRED_HINDI_RESPONSE)
    result = await guard_response_text(
        llm,
        mode="coach",
        locale_code="hi-IN",
        language="Hindi",
        text="I am designed specifically for dementia caregiving support.",
    )
    assert "उनके पास शांति से" in result


async def test_guard_response_text_falls_back_when_repair_still_invalid():
    llm = FakeLLM("I am designed specifically for dementia caregiving support.")
    result = await guard_response_text(
        llm,
        mode="checkin",
        locale_code="hi-IN",
        language="Hindi",
        text="I am designed specifically for dementia caregiving support.",
    )
    assert "क्षमा करें" in result


async def test_guard_response_text_repairs_disrespectful_output():
    llm = FakeLLM(REPAIRED_HINDI_RESPONSE)
    result = await guard_response_text(
        llm,
        mode="coach",
        locale_code="hi-IN",
        language="Hindi",
        text="You need to control him and make him obey.",
    )
    assert "शांत" in result


def test_chunk_text_for_sse_preserves_full_content():
    text = "அமைதியாக பேசுங்கள். அருகில் இருங்கள். சத்தத்தை குறைக்கவும்."
    chunks = chunk_text_for_sse(text, chunk_size=12)
    assert "".join(chunks) == text
    assert len(chunks) > 1
