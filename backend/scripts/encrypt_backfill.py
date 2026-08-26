"""One-time script to encrypt existing plaintext rows and backfill insights.

Usage:
    cd backend && python -m scripts.encrypt_backfill

This script:
1. Encrypts any conversations.content not starting with ENC:
2. Encrypts any profiles.behavioral_patterns/calming_strategies/safety_concerns not starting with ENC:
3. Encrypts any conversations.suggested_tags not starting with ENC: (if non-null)
4. Computes and upserts insights for all profiles with ≥3 sessions
"""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main():
    from sqlalchemy import select, distinct
    from app.db import get_engine, get_session_factory
    from app.models.conversation import Conversation
    from app.models.profile import Profile
    from app.services.crypto import encrypt, decrypt, validate_encryption_key

    # Validate key first
    validate_encryption_key()
    logger.info("Encryption key validated")

    get_engine()
    factory = get_session_factory()

    # 1. Encrypt plaintext conversation content
    encrypted_convs = 0
    async with factory() as session:
        result = await session.execute(select(Conversation))
        for conv in result.scalars().all():
            changed = False
            if conv.content and not conv.content.startswith("ENC:"):
                conv.content = encrypt(conv.content)
                changed = True
            if conv.suggested_tags and not conv.suggested_tags.startswith("ENC:"):
                conv.suggested_tags = encrypt(conv.suggested_tags)
                changed = True
            if changed:
                encrypted_convs += 1
        await session.commit()
    logger.info("Encrypted %d conversation rows", encrypted_convs)

    # 2. Encrypt plaintext profile fields
    encrypted_profiles = 0
    async with factory() as session:
        result = await session.execute(select(Profile))
        for profile in result.scalars().all():
            changed = False
            for field in ("behavioral_patterns", "calming_strategies", "safety_concerns"):
                val = getattr(profile, field)
                if val and not val.startswith("ENC:"):
                    setattr(profile, field, encrypt(val))
                    changed = True
            if changed:
                encrypted_profiles += 1
        await session.commit()
    logger.info("Encrypted %d profile rows", encrypted_profiles)

    # 3. Backfill insights
    from app.services.insights import compute_profile_insights, upsert_profile_insights

    async with factory() as session:
        result = await session.execute(select(distinct(Conversation.profile_id)))
        profile_ids = [row[0] for row in result.all()]

    processed = 0
    skipped = 0
    for pid in profile_ids:
        try:
            async with factory() as session:
                payload = await compute_profile_insights(pid, session)
                if payload["crisis_frequency"]["total_sessions"] >= 3:
                    await upsert_profile_insights(pid, payload, session)
                    processed += 1
                else:
                    skipped += 1
        except Exception as exc:
            logger.warning("Insights failed for %s: %s", pid, exc)

    logger.info("Insights: %d processed, %d skipped, %d total", processed, skipped, len(profile_ids))
    logger.info("Done!")


if __name__ == "__main__":
    asyncio.run(main())
