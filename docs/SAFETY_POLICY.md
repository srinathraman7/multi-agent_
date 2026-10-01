# Safety policy: advisory-only diagnostics

## Non-negotiable boundary

This application **never executes a command, API call, script, or remediation on
connected infrastructure**.  It may describe a diagnostic for a human to run.
Approving a proposal records only that human decision; it cannot trigger work.

## Permitted diagnostic categories

The guardrail permits only a narrowly defined set of read-only checks:

| Category | Examples |
| --- | --- |
| Logs | View or search existing logs |
| Metrics | Read a metric or dashboard value |
| Service health | Read service status or health |
| Network reachability | Ping a named host |
| Process inventory | List processes |

Permitted checks must use one of the allowlisted natural-language forms defined
in `guardrails/policy.py`. A check outside that vocabulary is not silently
accepted: it is marked `needs_review` for a human safety review.

## Blocked actions

Any state-changing, destructive, privilege-changing, or code-execution action
is blocked. This includes delete/remove, drop, restart, stop, kill, rollback,
scale, deploy, write/update, chmod/chown, package installation, shell/script
execution, and database mutations. The blocklist is a second line of defence;
the allowlist is authoritative.

The guardrail also blocks shell composition and concealment: `;`, pipes,
`&&`, `||`, substitutions, backticks, redirects, control characters, encoded
payloads, and suspicious base64 or hexadecimal escape sequences. Untrusted log
and chat text is always data, never an instruction.

## Risk and records

Allowed checks are `low` risk. Blocked checks are `high` risk. Ambiguous checks
are `medium` risk and require review. Each decision can be appended to an
append-only JSON Lines audit sink with the original text, normalized text,
decision, reason and timestamp. Audit records are never altered or deleted.

## Review process

1. The Proposal Agent produces advisory-only text.
2. Every proposal passes through the guardrail before it is displayed.
3. `allowed` proposals may be displayed as `pending`; `blocked` proposals are
   recorded but not presented as executable work; `needs_review` proposals
   require a human safety review.
4. A human approval/rejection is a timeline and audit event only.

