from collections.abc import AsyncGenerator

from app.services.llm_provider import LLMProvider
from app.services.response_guard import (
    chunk_text_for_sse,
    guard_response_text,
    validate_response_language,
    validate_response_quality,
    validate_response_respect,
)

# Realistic-length Tamil coach response for testing
VALID_TAMIL_RESPONSE = (
    "[[SECTION:right-now]]\n"
    "அப்பாவை அமைதியாக அணுகுங்கள். மெதுவாக பேசுங்கள். அருகில் இருங்கள். "
    "அவரின் உணர்வை ஏற்றுக்கொள்ளுங்கள். அவருடன் நேரடியாக இருக்க வேண்டாம்.\n"
    "[[SECTION:why-this-happens]]\n"
    "அல்சைமர் நோயால் பாதிக்கப்பட்டவர்களுக்கு மாலை நேரத்தில் குழப்பம் அதிகமாகும். "
    "இது சன்டவுனிங் என்று அழைக்கப்படுகிறது. சுற்றுச்சூழல் மாற்றங்கள் மற்றும் சோர்வு இதற்கு காரணமாக இருக்கலாம்.\n"
    "[[SECTION:what-not-to-do]]\n"
    "அவரை கட்டாயப்படுத்தாதீர்கள். அவருடன் வாதிடாதீர்கள். அவரின் குரலை உயர்த்தாதீர்கள்.\n"
    "[[SECTION:when-to-escalate]]\n"
    "அவர் தன்னை அல்லது மற்றவர்களை காயப்படுத்த முயற்சித்தால் உடனடியாக மருத்துவ உதவி பெறுங்கள்."
)

VALID_TAMIL_SHORT = "அப்பாவை அமைதியாக அணுகுங்கள். மெதுவாக பேசுங்கள். அருகில் இருங்கள்."

REPAIRED_TAMIL_RESPONSE = (
    "அப்பாவை அமைதியாக அணுகுங்கள். அமைதியான குரலில் பேசுங்கள். "
    "அவரின் உணர்வை ஏற்றுக்கொள்ளுங்கள். மெதுவாக பேசுங்கள். அருகில் இருங்கள். "
    "அவருடன் நேரடியாக இருக்க வேண்டாம். சுற்றியுள்ள சத்தத்தை குறைக்கவும். "
    "அவரை கட்டாயப்படுத்தாதீர்கள். அவருடன் வாதிடாதீர்கள்."
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


def test_validate_response_language_accepts_valid_tamil():
    result = validate_response_language(VALID_TAMIL_RESPONSE, "ta-IN")
    assert result.is_valid is True


def test_validate_response_language_rejects_short_response():
    result = validate_response_language(VALID_TAMIL_SHORT, "ta-IN")
    assert result.is_valid is False
    assert result.reason == "response_too_short"


def test_validate_response_language_rejects_known_english_boilerplate():
    result = validate_response_language(
        "I am designed specifically for dementia caregiving support. If you need help with a caregiving situation, please share.",
        "ta-IN",
    )
    assert result.is_valid is False


def test_validate_response_respect_rejects_english_disrespectful_wording():
    result = validate_response_respect(
        "You need to control him and make him obey.",
        "en",
    )
    assert result.is_valid is False


def test_validate_response_respect_rejects_tamil_disrespectful_wording():
    result = validate_response_respect(
        "அவர் ஒரு பைத்தியம் போல் நடந்து கொள்கிறார்.",
        "ta",
    )
    assert result.is_valid is False


def test_validate_response_quality_accepts_respectful_tamil():
    result = validate_response_quality(VALID_TAMIL_RESPONSE, "ta-IN")
    assert result.is_valid is True


async def test_guard_response_text_repairs_invalid_tamil_response():
    llm = FakeLLM(REPAIRED_TAMIL_RESPONSE)
    result = await guard_response_text(
        llm,
        mode="coach",
        locale_code="ta-IN",
        language="Tamil",
        text="I am designed specifically for dementia caregiving support.",
    )
    assert "அப்பாவை அமைதியாக" in result


async def test_guard_response_text_falls_back_when_repair_still_invalid():
    llm = FakeLLM("I am designed specifically for dementia caregiving support.")
    result = await guard_response_text(
        llm,
        mode="checkin",
        locale_code="ta-IN",
        language="Tamil",
        text="I am designed specifically for dementia caregiving support.",
    )
    assert "மன்னிக்கவும்" in result


async def test_guard_response_text_repairs_disrespectful_output():
    llm = FakeLLM(REPAIRED_TAMIL_RESPONSE)
    result = await guard_response_text(
        llm,
        mode="coach",
        locale_code="ta-IN",
        language="Tamil",
        text="You need to control him and make him obey.",
    )
    assert "அமைதியாக" in result


def test_chunk_text_for_sse_preserves_full_content():
    text = "அமைதியாக பேசுங்கள். அருகில் இருங்கள். சத்தத்தை குறைக்கவும்."
    chunks = chunk_text_for_sse(text, chunk_size=12)
    assert "".join(chunks) == text
    assert len(chunks) > 1
