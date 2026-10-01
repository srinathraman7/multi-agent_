"""Create ordered, evidence-linked incident timeline entries."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from pydantic import BaseModel, Field

from .contracts import TimelineActor, TimelineEntry


class TimelineSource(BaseModel):
    timestamp: datetime
    actor: TimelineActor
    action: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class TimelineScribeAgent:
    """Transforms source facts into an ordered, append-only timeline view."""

    def compose(
        self,
        sources: Iterable[TimelineSource],
        *,
        existing_entries: Iterable[TimelineEntry] = (),
    ) -> list[TimelineEntry]:
        """Return existing facts plus new facts, in chronological stable order.

        Existing entries are never mutated. New IDs begin after the highest
        existing numeric suffix when available.
        """
        retained = list(existing_entries)
        next_number = self._next_number(retained)
        additions = [
            TimelineEntry(
                id=f"tl_{next_number + index:04d}",
                timestamp=source.timestamp,
                actor=source.actor,
                action=source.action,
                evidence_ids=source.evidence_ids,
                metadata=source.metadata,
            )
            for index, source in enumerate(sources)
        ]
        return sorted(retained + additions, key=lambda entry: entry.timestamp)

    @staticmethod
    def _next_number(entries: list[TimelineEntry]) -> int:
        suffixes: list[int] = []
        for entry in entries:
            try:
                suffixes.append(int(entry.id.removeprefix("tl_")))
            except ValueError:
                continue
        return max(suffixes, default=0) + 1
