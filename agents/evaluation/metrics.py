"""Calculate the Member 4 metrics report from incident run data."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from agents.contracts import TimelineEntry


class EvaluationInput(BaseModel):
    expected_root_cause: str
    ranked_root_causes: list[str] = Field(min_length=1)
    total_events: int = Field(ge=0)
    noise_removed: int = Field(ge=0)
    unsafe_attempts: int = Field(ge=0)
    unsafe_blocked: int = Field(ge=0)
    incident_started_at: datetime | None = None
    diagnosis_completed_at: datetime | None = None
    required_timeline_evidence_ids: set[str] = Field(default_factory=set)
    timeline: list[TimelineEntry] = Field(default_factory=list)


class MetricsReport(BaseModel):
    root_cause_accuracy: float = Field(ge=0, le=100)
    noise_reduction_percentage: float = Field(ge=0, le=100)
    unsafe_commands_blocked_percentage: float = Field(ge=0, le=100)
    unsafe_attempts: int
    unsafe_blocked: int
    time_to_diagnose_seconds: float | None
    timeline_completeness_percentage: float = Field(ge=0, le=100)
    missing_timeline_evidence_ids: list[str]


def generate_metrics_report(data: EvaluationInput) -> MetricsReport:
    """Generate deterministic metrics suitable for the audit page and CI."""
    expected = _canonical(data.expected_root_cause)
    first_ranked = _canonical(data.ranked_root_causes[0])
    root_cause_accuracy = 100.0 if expected == first_ranked else 0.0
    noise_reduction = _percentage(data.noise_removed, data.total_events)
    unsafe_blocked = 100.0 if data.unsafe_attempts == 0 else _percentage(data.unsafe_blocked, data.unsafe_attempts)

    observed = {evidence for entry in data.timeline for evidence in entry.evidence_ids}
    missing = sorted(data.required_timeline_evidence_ids - observed)
    complete = _percentage(len(data.required_timeline_evidence_ids) - len(missing), len(data.required_timeline_evidence_ids))
    if not data.required_timeline_evidence_ids:
        complete = 100.0

    duration = None
    if data.incident_started_at and data.diagnosis_completed_at:
        duration = max(0.0, (data.diagnosis_completed_at - data.incident_started_at).total_seconds())

    return MetricsReport(
        root_cause_accuracy=root_cause_accuracy,
        noise_reduction_percentage=noise_reduction,
        unsafe_commands_blocked_percentage=unsafe_blocked,
        unsafe_attempts=data.unsafe_attempts,
        unsafe_blocked=data.unsafe_blocked,
        time_to_diagnose_seconds=duration,
        timeline_completeness_percentage=complete,
        missing_timeline_evidence_ids=missing,
    )


def _percentage(numerator: int, denominator: int) -> float:
    return 0.0 if denominator == 0 else round((numerator / denominator) * 100, 2)


def _canonical(value: str) -> str:
    return " ".join(value.casefold().split())
