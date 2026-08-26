"""
Splits scraped pages into overlapping token-based chunks for embedding.
"""

from dataclasses import dataclass

import tiktoken

from .crawl import ScrapedPage

_ENCODING = tiktoken.get_encoding("o200k_base")  # correct tokenizer for text-embedding-3-small


@dataclass
class Chunk:
    content: str
    source_url: str
    source_title: str
    source_name: str
    source_domain: str
    chunk_index: int


def _split_tokens(text: str, max_tokens: int, overlap: int) -> list[str]:
    tokens = _ENCODING.encode(text)
    chunks: list[str] = []
    start = 0

    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunks.append(_ENCODING.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += max_tokens - overlap

    return chunks


def chunk_page(
    page: ScrapedPage,
    max_tokens: int = 400,
    overlap_tokens: int = 50,
) -> list[Chunk]:
    """Split a ScrapedPage into overlapping Chunk objects."""
    texts = _split_tokens(page.content, max_tokens, overlap_tokens)
    # Prepend page title to each chunk — anchors the embedding semantically
    # so short conversational queries match better against article content
    prefix = f"{page.title}: "
    return [
        Chunk(
            content=f"{prefix}{text.strip()}",
            source_url=page.url,
            source_title=page.title,
            source_name=page.source_name,
            source_domain=page.source_domain,
            chunk_index=i,
        )
        for i, text in enumerate(texts)
        if text.strip()
    ]


def chunk_pages(
    pages: list[ScrapedPage],
    max_tokens: int = 400,
    overlap_tokens: int = 50,
) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page in pages:
        chunks.extend(chunk_page(page, max_tokens, overlap_tokens))
    return chunks
