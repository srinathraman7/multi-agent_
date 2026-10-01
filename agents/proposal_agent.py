"""Generate safe diagnostic proposals from evidence-backed root causes."""

from __future__ import annotations

from dataclasses import dataclass

from guardrails.policy import Decision, GuardrailAuditLog, evaluate_check

from .contracts import DiagnosticProposal, ProposalStatus, Risk, RootCause


@dataclass(frozen=True)
class ProposalTemplate:
    title: str
    check: str
    why: str
    expected_result: str


class DiagnosticProposalAgent:
    """Rules-first proposal agent.

    The production pipeline may obtain candidate wording from an LLM, but this
    boundary accepts only evidence-backed causes and always routes each result
    through ``evaluate_check`` before returning it.
    """

    def propose(
        self,
        root_cause: RootCause,
        *,
        proposal_id: str = "prop_001",
        audit_log: GuardrailAuditLog | None = None,
    ) -> DiagnosticProposal:
        candidate = self._template_for(root_cause.cause)
        decision = evaluate_check(candidate.check)
        if audit_log:
            audit_log.append(decision, proposal_id=proposal_id)

        status = ProposalStatus.PENDING if decision.decision == Decision.ALLOWED else ProposalStatus.BLOCKED
        return DiagnosticProposal(
            id=proposal_id,
            title=candidate.title,
            check=candidate.check,
            why=candidate.why,
            expected_result=candidate.expected_result,
            risk=Risk(decision.risk),
            status=status,
            evidence_ids=root_cause.evidence_ids,
            guardrail_decision=decision.decision,
            guardrail_reason=decision.reason,
        )

    def assess_candidate(
        self,
        candidate: ProposalTemplate,
        root_cause: RootCause,
        *,
        proposal_id: str,
        audit_log: GuardrailAuditLog | None = None,
    ) -> DiagnosticProposal:
        """Guard an externally generated candidate before it can reach the UI."""
        decision = evaluate_check(candidate.check)
        if audit_log:
            audit_log.append(decision, proposal_id=proposal_id)
        return DiagnosticProposal(
            id=proposal_id,
            title=candidate.title,
            check=candidate.check,
            why=candidate.why,
            expected_result=candidate.expected_result,
            risk=Risk(decision.risk),
            status=ProposalStatus.PENDING if decision.decision == Decision.ALLOWED else ProposalStatus.BLOCKED,
            evidence_ids=root_cause.evidence_ids,
            guardrail_decision=decision.decision,
            guardrail_reason=decision.reason,
        )

    @staticmethod
    def _template_for(cause: str) -> ProposalTemplate:
        normalized = cause.lower()
        if any(word in normalized for word in ("database", "db", "connection pool")):
            return ProposalTemplate(
                title="Check database connection-pool metrics",
                check="check metrics for database connection-pool utilization",
                why="Confirms whether database connections are exhausted.",
                expected_result="Connection-pool utilization is near 100 percent.",
            )
        if any(word in normalized for word in ("memory", "heap", "oom")):
            return ProposalTemplate(
                title="Check service memory metrics",
                check="check metrics for service memory utilization",
                why="Confirms whether memory pressure matches the incident symptoms.",
                expected_result="Memory utilization rises steadily or approaches its limit.",
            )
        if any(word in normalized for word in ("deploy", "release", "version")):
            return ProposalTemplate(
                title="View deployment service logs",
                check="view logs for deployment service",
                why="Confirms the error pattern immediately after the reported deployment.",
                expected_result="Logs show configuration or startup errors after the deployment.",
            )
        return ProposalTemplate(
            title="Check affected service health",
            check="check service health for affected service",
            why="Confirms whether the affected service is currently healthy.",
            expected_result="The health status reflects the incident symptoms.",
        )
