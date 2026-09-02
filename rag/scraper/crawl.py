"""
Scrapes publicly available caregiver content from trusted sources:
  - alz.org (Alzheimer's Association — nonprofit)
  - nia.nih.gov (National Institute on Aging — US government, public domain)
  - mayoclinic.org (Mayo Clinic — nonprofit)
  - helpguide.org (HelpGuide — nonprofit)
  - caregiver.org (Family Caregiver Alliance — nonprofit)
  - cdc.gov (CDC — US government, public domain)

Usage:
    python -m rag.scraper.crawl            # preview what would be scraped
    python -m rag.scraper.crawl --save     # save raw pages to ./scraped/

Use only for non-commercial, research, or caregiving-assistance purposes.
"""

import asyncio
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx

# html2text and beautifulsoup4 are imported lazily, inside the two functions
# that use them. They are scraping-only dependencies listed in
# rag/requirements.txt, and the backend deliberately does not install them — it
# only ever reaches into rag.retrieve / rag.vectorstores. Importing them at
# module scope made `rag.pipeline` unimportable in the backend environment,
# which broke an unrelated test that just wanted make_chunk_id().

# Last verified: 2026-03-27.
# All sources are government (public domain) or nonprofit (educational use).
SEED_URLS: list[str] = [
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  ALZ.ORG — Alzheimer's Association (nonprofit)                      ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    # Caregiving overview
    "https://www.alz.org/help-support/caregiving",
    # Daily care
    "https://www.alz.org/help-support/caregiving/daily-care",
    "https://www.alz.org/help-support/caregiving/daily-care/daily-care-plan",
    "https://www.alz.org/help-support/caregiving/daily-care/bathing",
    "https://www.alz.org/help-support/caregiving/daily-care/dressing-grooming",
    "https://www.alz.org/help-support/caregiving/daily-care/food-eating",
    "https://www.alz.org/help-support/caregiving/daily-care/incontinence",
    # Stages & behaviors
    "https://www.alz.org/help-support/caregiving/stages-behaviors",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/early-stage",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/middle-stage",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/late-stage",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/aggression-and-anger",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/anxiety-agitation",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/depression",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/hallucinations",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/repetition",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/sleep-issues-sundowning",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/suspicions-delusions",
    "https://www.alz.org/help-support/caregiving/stages-behaviors/wandering",
    # Safety
    "https://www.alz.org/help-support/caregiving/safety",
    "https://www.alz.org/help-support/caregiving/safety/home-safety",
    # Caregiver health
    "https://www.alz.org/help-support/caregiving/caregiver-health",
    "https://www.alz.org/help-support/caregiving/caregiver-health/caregiver-stress",
    "https://www.alz.org/help-support/caregiving/caregiver-health/caregiver-depression",
    "https://www.alz.org/help-support/caregiving/caregiver-health/be_a_healthy_caregiver",
    # Disease stages & treatments
    "https://www.alz.org/alzheimers-dementia/stages",
    "https://www.alz.org/alzheimers-dementia/treatments",
    "https://www.alz.org/alzheimers-dementia/treatments/medications-for-memory",
    "https://www.alz.org/alzheimers-dementia/treatments/treatments-for-behavior",
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  NIA.NIH.GOV — blocked (405 Not Allowed). Re-check periodically.   ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  MAYOCLINIC.ORG — Mayo Clinic (nonprofit)                           ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    "https://www.mayoclinic.org/diseases-conditions/alzheimers-disease/in-depth/alzheimers/art-20047832",
    "https://www.mayoclinic.org/diseases-conditions/alzheimers-disease/in-depth/alzheimers-stages/art-20048448",
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  HELPGUIDE.ORG — HelpGuide (nonprofit)                             ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    "https://www.helpguide.org/aging/dementia/alzheimers-behavior-management",
    "https://www.helpguide.org/aging/dementia/tips-for-alzheimers-caregivers",
    "https://www.helpguide.org/aging/dementia/stages-of-alzheimers-disease",
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  CAREGIVER.ORG — Family Caregiver Alliance (nonprofit)             ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    "https://www.caregiver.org/resource/caregivers-guide-understanding-dementia-behaviors/",
    "https://www.caregiver.org/resource/ten-real-life-strategies-dementia-caregiving/",
    "https://www.caregiver.org/resource/alzheimers-disease-caregiving/",
    "https://www.caregiver.org/resource/caregiver-health/",
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║  CDC.GOV — Centers for Disease Control (US gov, public domain)     ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    "https://www.cdc.gov/caregiving/resources/helping-alzheimers-caregivers.html",
    "https://www.cdc.gov/caregiving/guidelines/index.html",
    "https://www.cdc.gov/caregiving/about/index.html",
]

# Backward compat — old name referenced in pipeline.py and README
ALZ_SEED_URLS = SEED_URLS

_HEADERS = {
    "User-Agent": "CalmGuide-RAG/1.0 (dementia caregiver support app; research use)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

# Tags to strip before extracting text
_REMOVE_TAGS = [
    "nav",
    "footer",
    "header",
    "script",
    "style",
    "noscript",
    "aside",
    "form",
    "iframe",
    ".nav",
    ".footer",
    ".sidebar",
    ".cookie-banner",
    ".alert",
    ".breadcrumb",
]

_SOURCE_NAMES = {
    "www.alz.org": "Alzheimer's Association",
    "www.nia.nih.gov": "National Institute on Aging",
    "www.mayoclinic.org": "Mayo Clinic",
    "www.helpguide.org": "HelpGuide",
    "www.caregiver.org": "Family Caregiver Alliance",
    "www.cdc.gov": "Centers for Disease Control and Prevention",
}


@dataclass
class ScrapedPage:
    url: str
    title: str
    source_name: str
    source_domain: str
    content: str  # clean markdown text


_BOILERPLATE_PATTERNS = [
    "Share or print this page",
    "Join Now",
    "Sign up for our weekly e-newsletter",
    "Log in or register",
    "Donate Now",
    "Find a chapter near you",
    "24/7 Helpline",
    "Contact Us",
    "Follow Us",
    "Back to top",
]


def _html_to_markdown(html: str) -> str:
    import html2text  # noqa: PLC0415 — scraping-only dep, see module header

    converter = html2text.HTML2Text()
    converter.ignore_links = True
    converter.ignore_images = True
    converter.ignore_emphasis = False
    converter.body_width = 0  # don't wrap lines
    text = converter.handle(html).strip()

    # Remove boilerplate lines
    lines = text.split("\n")
    cleaned = [ln for ln in lines if not any(bp in ln for bp in _BOILERPLATE_PATTERNS)]

    # Remove duplicate consecutive headings (e.g. title appearing twice)
    deduped: list[str] = []
    for ln in cleaned:
        if deduped and ln.strip() == deduped[-1].strip() and ln.strip().startswith("#"):
            continue
        deduped.append(ln)

    return "\n".join(deduped).strip()


def get_source_metadata(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    source_name = _SOURCE_NAMES.get(domain)
    if source_name is None:
        raise ValueError(
            f"URL domain {domain!r} is not in the approved source allowlist. "
            "Review its robots.txt and usage terms before adding it."
        )
    return source_name, domain


async def _fetch_page(client: httpx.AsyncClient, url: str) -> ScrapedPage | None:
    source_name, source_domain = get_source_metadata(url)

    try:
        resp = await client.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  [skip] {url} — {exc}")
        return None

    from bs4 import BeautifulSoup  # noqa: PLC0415 — scraping-only dep, see module header

    soup = BeautifulSoup(resp.text, "html.parser")

    for selector in _REMOVE_TAGS:
        for tag in soup.select(selector):
            tag.decompose()

    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else url.split("/")[-1]

    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id="main-content")
        or soup.find("div", class_="content")
        or soup.body
    )
    if not main:
        return None

    content = _html_to_markdown(str(main))
    if not content or len(content) < 100:
        return None

    return ScrapedPage(
        url=url,
        title=title,
        source_name=source_name,
        source_domain=source_domain,
        content=content,
    )


async def scrape_pages(
    urls: list[str] | None = None,
    delay: float = 1.5,
) -> list[ScrapedPage]:
    """Scrape a list of URLs and return cleaned ScrapedPage objects."""
    urls = urls or ALZ_SEED_URLS
    for url in urls:
        get_source_metadata(url)

    pages: list[ScrapedPage] = []

    async with httpx.AsyncClient(headers=_HEADERS) as client:
        for url in urls:
            print(f"Fetching: {url}")
            page = await _fetch_page(client, url)
            if page:
                pages.append(page)
                print(f"  OK — {page.title} ({len(page.content)} chars)")
            await asyncio.sleep(delay)

    return pages


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="Save scraped pages to ./scraped/")
    parser.add_argument("--urls", nargs="*", help="Override default URLs")
    args = parser.parse_args()

    pages = asyncio.run(scrape_pages(urls=args.urls))
    print(f"\nScraped {len(pages)} pages.")

    if args.save:
        out = Path("scraped")
        out.mkdir(exist_ok=True)
        for p in pages:
            slug = p.url.rstrip("/").split("/")[-1] or "index"
            (out / f"{slug}.json").write_text(json.dumps(asdict(p), indent=2))
        print(f"Saved to {out}/")
