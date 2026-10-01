"""Pydantic contracts shared by proposal and timeline functionality."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Risk(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProposalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class DiagnosticProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^prop_[A-Za-z0-9_-]+$")
    title: str = Field(min_length=1)
    check: str = Field(min_length=1)
    why: str = Field(min_length=1)
    expected_result: str = Field(min_length=1)
    risk: Risk
    status: ProposalStatus
    evidence_ids: list[str] = Field(default_factory=list)
    guardrail_decision: str
    guardrail_reason: str


class RootCause(BaseModel):
    cause: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[str] = Field(min_length=1)
    reasoning: str = Field(min_length=1)


class RootCauseOutput(BaseModel):
    root_causes: list[RootCause] = Field(min_length=1)


class TimelineActor(StrEnum):
    SYSTEM = "system"
    AI = "ai"
    HUMAN = "human"


class TimelineEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^tl_[A-Za-z0-9_-]+$")
    timestamp: datetime
    actor: TimelineActor
    action: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("evidence_ids")
    @classmethod
    def no_blank_evidence_ids(cls, values: list[str]) -> list[str]:
        if any(not value.strip() for value in values):
            raise ValueError("Evidence IDs cannot be blank.")
        return values
