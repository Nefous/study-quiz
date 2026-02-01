import os
import sys

import httpx


API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN")
ATTEMPT_ID = os.getenv("ATTEMPT_ID")

if not ACCESS_TOKEN or not ATTEMPT_ID:
    print("Set ACCESS_TOKEN and ATTEMPT_ID env vars.")
    sys.exit(1)

headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}


def get_counts(client: httpx.Client) -> tuple[int, int]:
    attempts = client.get(f"{API_BASE}/attempts?limit=200&offset=0", headers=headers)
    attempts.raise_for_status()
    stats = client.get(f"{API_BASE}/attempts/stats", headers=headers)
    stats.raise_for_status()
    return len(attempts.json()), stats.json().get("total_attempts", 0)


with httpx.Client(timeout=60) as client:
    before_list_count, before_stats_total = get_counts(client)

    for _ in range(2):
        resp = client.get(f"{API_BASE}/attempts/{ATTEMPT_ID}/ai-review", headers=headers)
        resp.raise_for_status()

    after_list_count, after_stats_total = get_counts(client)

    print("Attempts list count:", before_list_count, "->", after_list_count)
    print("Stats total_attempts:", before_stats_total, "->", after_stats_total)

    if before_list_count != after_list_count or before_stats_total != after_stats_total:
        raise SystemExit("FAIL: ai-review changed attempts counts")

    print("PASS: ai-review is read-only")
