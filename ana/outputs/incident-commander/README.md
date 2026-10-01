# Sentinel — advisory-only incident commander

This is a polished, dependency-free MVP of the project described in the supplied guide. Open `index.html` in a browser to run it. It is intentionally a local demonstration: all data lives in the browser and no button connects to or changes any infrastructure.

## Included flow

- Incident list, war room, timeline, and audit/safety views
- Noise filtering, root-cause ranking, evidence inspection, and safe diagnostic proposals
- Approve/reject decisions recorded in an append-only, in-memory timeline
- A visible guardrail demonstration that blocks a state-changing chained command
- Role switching to demonstrate that a Viewer cannot approve a proposal
- Downloadable audit record

## Safety boundary

The guide’s core constraint is preserved: this UI has no execution integration, shell runner, webhook callback, or infrastructure credential. “Approve” records a human decision only.

## Moving from demo to production

Use the shared contracts in `docs/contracts` as the boundary between a FastAPI/Redis/PostgreSQL service, the agent pipeline, and a production frontend. Keep the guardrail service code-only, run it on every generated proposal, and use an append-only database table for timeline and audit records.
