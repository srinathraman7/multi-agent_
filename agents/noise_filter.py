"""Noise Filter Agent: removes duplicate and irrelevant alerts."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any


@dataclass
class FilterResult:
    cleaned: list[dict[str, Any]]
    removed_count: int
    removed_ids: list[str]


# Patterns considered routine noise
_HEALTH_CHECK_RE = re.compile(r"health\s*check\s*(ok|pass|up|200)", re.I)
_PING_RE = re.compile(r"^ping\s+", re.I)


def _fingerprint(event: dict[str, Any]) -> str:
    """Deterministic fingerprint for dedup: service + normalised message."""
    msg = re.sub(r"\b\d+\b", "N", event.get("message", "")).strip().lower()
    return hashlib.md5(f"{event.get('service', '')}::{msg}".encode()).hexdigest()


def run(events: list[dict[str, Any]]) -> FilterResult:
    """Apply rules-first noise filtering.

    Strategy:
    1. Remove exact duplicate message+service combos (keep first occurrence).
    2. Drop routine health checks and ping responses.
    3. Group repeated identical-fingerprint events (keep first; count rest).
    """
    seen_fingerprints: set[str] = set()
    cleaned: list[dict[str, Any]] = []
    removed_ids: list[str] = []

    for event in events:
        msg = event.get("message", "")
        evt_id = event.get("id", "")

        # Drop health-check noise
        if _HEALTH_CHECK_RE.search(msg) or _PING_RE.match(msg):
            removed_ids.append(evt_id)
            continue

        # Deduplicate by fingerprint
        fp = _fingerprint(event)
        if fp in seen_fingerprints:
            removed_ids.append(evt_id)
            continue

        seen_fingerprints.add(fp)
        cleaned.append(event)

    return FilterResult(
        cleaned=cleaned,
        removed_count=len(removed_ids),
        removed_ids=removed_ids,
    )
