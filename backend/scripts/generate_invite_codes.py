"""
Generate shared invite codes that gate B2C signup during private testing.

Usage:
    cd backend
    python scripts/generate_invite_codes.py --count 5 --label "beta-wave-1"

Requires:
    - Database running and migrated (alembic upgrade head)
    - ACCESS_CODE_HMAC_SECRET (or CONVERSATION_ENCRYPTION_KEY) set in .env,
      matching whatever the running API server uses — codes are looked up
      by keyed hash, so a mismatched secret makes every code "invalid".

Prints the plaintext codes once. Only a keyed hash is stored in the
database (same as B2C access codes / facility codes) — there is no way to
recover a code after this script exits, so save the output now.

Codes are shared/reusable: hand the same code to as many testers as you
like, it never expires or gets consumed. To revoke a batch later, find its
rows by `label` and set `is_active = false` (no script for that yet — do
it directly in the DB, or ask an engineer to add one if this becomes
routine).

To stop requiring invite codes altogether (e.g. once testing ends and the
app goes to open signup), set INVITE_CODE_REQUIRED=false in the backend's
environment — no code change or migration needed.
"""

import argparse
import asyncio
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_session_factory
from app.models.invite_code import InviteCode
from app.services.auth import hash_access_code

# Same alphabet as B2C access codes — exclude visually ambiguous characters.
ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1IL")
CODE_LENGTH = 8


def _generate_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


async def main(count: int, label: str | None) -> None:
    session_factory = get_session_factory()
    codes: list[str] = []

    async with session_factory() as session:
        for _ in range(count):
            code = _generate_code()
            session.add(InviteCode(code_hash=hash_access_code(code), label=label))
            codes.append(code)
        await session.commit()

    label_suffix = f" (label: {label})" if label else ""
    print(f"\nGenerated {count} invite code(s){label_suffix}:\n")
    for code in codes:
        print(f"  {code}")
    print(
        "\nShare these with testers out-of-band (email, Slack, etc.). "
        "They are not recoverable from the database — this is the only "
        "time they're shown in plaintext.\n"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--count", type=int, default=1, help="Number of codes to generate (default: 1)"
    )
    parser.add_argument(
        "--label",
        type=str,
        default=None,
        help="Optional label to group this batch (e.g. 'beta-wave-1'), useful for revoking later",
    )
    args = parser.parse_args()
    if args.count < 1:
        parser.error("--count must be at least 1")
    asyncio.run(main(args.count, args.label))
