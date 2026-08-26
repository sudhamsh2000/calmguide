"""Helpers for querying an English-only RAG corpus from multilingual requests."""

from __future__ import annotations

import re

from app.services.llm_provider import LLMProvider


def _is_rag_configured() -> bool:
    """Check if the RAG pipeline is available without importing it."""
    try:
        from rag.retrieve import get_rag_context  # noqa: PLC0415, F401
        return True
    except Exception:
        return False


def _base_locale(locale_code: str) -> str:
    return locale_code.lower().split("-", 1)[0]


def should_rewrite_for_english_corpus(locale_code: str) -> bool:
    return _base_locale(locale_code) != "en"


def _sanitize_query(text: str) -> str:
    sanitized = text.strip().strip('"').strip("'")
    sanitized = sanitized.replace("\n", " ")
    sanitized = re.sub(r"\s+", " ", sanitized)
    return sanitized[:280].strip()


def build_rewrite_prompt(
    *,
    locale_code: str,
    user_text: str,
    context: str = "",
) -> str:
    context_block = f"Context: {context}\n" if context else ""
    return (
        "Rewrite the caregiver request into a concise English retrieval query for an English dementia-care knowledge base.\n"
        "Return only the English search query.\n"
        "Do not explain anything.\n"
        "Do not answer the caregiver.\n"
        "Keep it short and retrieval-friendly.\n"
        f"Original locale: {locale_code}\n"
        f"{context_block}"
        f"User text: {user_text}"
    )


async def build_english_rag_query(
    llm: LLMProvider,
    *,
    locale_code: str,
    user_text: str,
    context: str = "",
) -> str:
    if not user_text.strip():
        return user_text

    # Skip the LLM rewrite call entirely if RAG is not configured
    if not _is_rag_configured():
        return _sanitize_query(user_text)

    if not should_rewrite_for_english_corpus(locale_code):
        return _sanitize_query(user_text)

    rewritten = await llm.completion(
        "You convert multilingual caregiver requests into short English retrieval queries.",
        [{"role": "user", "content": build_rewrite_prompt(locale_code=locale_code, user_text=user_text, context=context)}],
    )
    sanitized = _sanitize_query(rewritten)
    return sanitized or _sanitize_query(user_text)
