# Safety policy

Sentinel is advisory-only. It must never run or dispatch commands, API writes, deployment actions, or callbacks against a connected project.

The proposal guardrail is allowlist-first. Read-only categories—viewing logs, metrics, service status, and process lists—may be proposed. It blocks delete, drop, restart, kill, rollback, scale, write, chmod, deploy and configuration changes. It also blocks command chaining and indirection (`;`, `&&`, `|`, `$()`, backticks, and encoded payloads).

An approval is an append-only decision record, not authorization for Sentinel to act. Human operators execute any independently validated change through their own incident process.
