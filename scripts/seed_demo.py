"""Seed demo accounts (admin / lecturer / student) for the MVP end-to-end flow.

Idempotent: existing users (by email) are updated in place.

Usage:
    python scripts/seed_demo.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db.seed import seed_demo_accounts


def main() -> int:
    results = asyncio.run(seed_demo_accounts())
    print("Demo accounts seeded (login bằng email):")
    for r in results:
        print(f"  - {r['email']} | role={r['role']} | {r['action']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
