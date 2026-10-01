"""Commander: orchestrates the full agent pipeline in order.

Pipeline: Noise Filter → Correlation → Root Cause → Proposal Agent → Timeline Scribe
Each step logs its input/output so the Timeline Scribe has a full record.
"""
from __future__ import annotations

import sys
import os
import pathlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

# Allow importing guardrails and agents from parent dir when running directly
_ROOT = pathlib.Path(__file__).parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from . import noise_filter, correlation, root_cause
from .proposal_agent import DiagnosticProposalAgent, ProposalTemplate
from .timeline_scribe import TimelineScribeAgent, TimelineSource
from .contracts import RootCause, TimelineActor
from guardrails.policy import GuardrailAuditLog


def run_pipeline(
    events: list[dict[str, Any]],
    *,
    incident_id: str = "unknown",
    audit_log_path: str | None = None,
) -> dict[str, Any]:
    """Run all agents in order and return a structured result for the backend/UI."""

    start = datetime.now(UTC)
    log_entries: list[dict] = []

    def _log(step: str, data: dict) -> None:
        log_entries.append({"step": step, "ts": datetime.now(UTC).isoformat(), **data})

    # ── Step 1: Noise Filter ───────────────────────────────────────────────────
    filter_result = noise_filter.run(events)
    _log("noise_filter", {
        "removed_count": filter_result.removed_count,
        "cleaned_count": len(filter_result.cleaned),
    })

    # ── Step 2: Correlation ────────────────────────────────────────────────────
    clusters = correlation.run(filter_result.cleaned)
    _log("correlation", {"cluster_count": len(clusters)})

    # ── Step 3: Root Cause ────────────────────────────────────────────────────
    rc_output = root_cause.run(clusters)
    _log("root_cause", {"cause_count": len(rc_output.get("root_causes", []))})

    # ── Step 4: Proposal Agent (with guardrail) ───────────────────────────────
    proposal_agent = DiagnosticProposalAgent()
    audit_log = GuardrailAuditLog(audit_log_path or f"/tmp/audit_{incident_id}.jsonl")
    proposals_out: list[dict] = []

    for idx, rc_dict in enumerate(rc_output.get("root_causes", [])[:3]):  # top 3 causes
        rc_obj = RootCause(
            cause=rc_dict["cause"],
            confidence=rc_dict["confidence"],
            evidence_ids=rc_dict["evidence_ids"],
            reasoning=rc_dict["reasoning"],
        )
        proposal = proposal_agent.propose(
            rc_obj,
            proposal_id=f"prop_{uuid.uuid4().hex[:6]}",
            audit_log=audit_log,
        )
        proposals_out.append(proposal.model_dump(mode="json"))

    _log("proposal_agent", {"proposals_generated": len(proposals_out)})

    # ── Step 5: Timeline Scribe ────────────────────────────────────────────────
    scribe = TimelineScribeAgent()
    sources = [
        TimelineSource(
            timestamp=start,
            actor=TimelineActor.SYSTEM,
            action=f"Commander started. {len(events)} events received.",
            evidence_ids=[],
        ),
        TimelineSource(
            timestamp=datetime.now(UTC),
            actor=TimelineActor.AI,
            action=f"Noise Filter removed {filter_result.removed_count} duplicate or irrelevant alerts.",
            evidence_ids=filter_result.removed_ids[:10],
        ),
        TimelineSource(
            timestamp=datetime.now(UTC),
            actor=TimelineActor.AI,
            action=f"Correlation Agent found {len(clusters)} event cluster(s).",
            evidence_ids=[e for c in clusters for e in c.all_event_ids[:3]],
        ),
    ]
    if rc_output.get("root_causes"):
        top = rc_output["root_causes"][0]
        sources.append(TimelineSource(
            timestamp=datetime.now(UTC),
            actor=TimelineActor.AI,
            action=f"Root Cause ranked: {top['cause']} (confidence {int(top['confidence']*100)}%)",
            evidence_ids=top["evidence_ids"],
        ))

    timeline = scribe.compose(sources)
    _log("timeline_scribe", {"entry_count": len(timeline)})

    return {
        "incident_id": incident_id,
        "filter": {
            "removed_count": filter_result.removed_count,
            "cleaned_count": len(filter_result.cleaned),
        },
        "root_causes": rc_output.get("root_causes", []),
        "proposals": proposals_out,
        "timeline": [e.model_dump(mode="json") for e in timeline],
        "agent_log": log_entries,
    }
