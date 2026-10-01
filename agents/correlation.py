"""Correlation Agent: groups related events into clusters."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any


@dataclass
class EventCluster:
    cluster_id: str
    service: str
    events: list[dict[str, Any]] = field(default_factory=list)
    deploy_events: list[dict[str, Any]] = field(default_factory=list)
    ticket_events: list[dict[str, Any]] = field(default_factory=list)
    chat_events: list[dict[str, Any]] = field(default_factory=list)

    @property
    def all_event_ids(self) -> list[str]:
        all_evts = self.events + self.deploy_events + self.ticket_events + self.chat_events
        return [e["id"] for e in all_evts if e.get("id")]


def run(events: list[dict[str, Any]], window_minutes: int = 20) -> list[EventCluster]:
    """Group events into clusters by service and time window.

    Strategy:
    1. Group error/warning events by service.
    2. For each service group, find deploy events within `window_minutes` before the first error.
    3. Attach tickets and chat mentioning the same service.
    """
    window = timedelta(minutes=window_minutes)

    # Sort everything by timestamp
    def ts(evt: dict) -> datetime:
        raw = evt.get("timestamp", "")
        if isinstance(raw, datetime):
            return raw
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return datetime.min

    sorted_events = sorted(events, key=ts)

    # Separate by source
    log_events = [e for e in sorted_events if e.get("source") == "log"]
    deploy_events = [e for e in sorted_events if e.get("source") == "deploy"]
    ticket_events = [e for e in sorted_events if e.get("source") == "ticket"]
    chat_events = [e for e in sorted_events if e.get("source") == "chat"]

    # Group error/warning logs by service
    service_errors: dict[str, list[dict]] = {}
    for evt in log_events:
        if evt.get("severity") in ("error", "warning"):
            service_errors.setdefault(evt["service"], []).append(evt)

    clusters: list[EventCluster] = []
    for idx, (service, errs) in enumerate(service_errors.items()):
        cluster = EventCluster(cluster_id=f"cluster_{idx + 1:03d}", service=service, events=errs)

        # Find the first error timestamp for this service
        first_err_ts = min(ts(e) for e in errs)

        # Attach deploys within window before first error
        cluster.deploy_events = [
            d for d in deploy_events
            if d.get("service") == service and first_err_ts - window <= ts(d) <= first_err_ts
        ]
        # Also attach cross-service deploys that line up (e.g. a global config push)
        for d in deploy_events:
            if d not in cluster.deploy_events and first_err_ts - window <= ts(d) <= first_err_ts:
                cluster.deploy_events.append(d)

        # Attach tickets mentioning the service
        cluster.ticket_events = [
            t for t in ticket_events
            if service.lower() in (t.get("service", "") + t.get("message", "")).lower()
        ]

        # Attach chat mentioning the service
        cluster.chat_events = [
            c for c in chat_events
            if service.lower() in (c.get("service", "") + c.get("message", "")).lower()
        ]

        clusters.append(cluster)

    return clusters
