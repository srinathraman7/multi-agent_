# Sentinel — Multi-Agent Incident Commander

**Statement PNG2 | Theme: Generative AI & LLM Applications**

A safe, advisory-only AI incident war room. A team of five specialist agents reads noisy outage data, finds the probable root cause with evidence, proposes safe read-only diagnostics, and records everything in an auditable timeline. The AI **only advises** — it never executes commands on live systems.

---

## Quick Start (one command)

```bash
# 1. Clone and configure
git clone <repo-url> && cd incident-commander
cp .env.example .env
# edit .env: add GEMINI_API_KEY and/or GROQ_API_KEY

# 2. Start everything
docker compose up --build

# 3. Open the dashboard
http://localhost:3000
```

Default login — `incident_lead / changeme` (created by DB seed).

---

## Project Structure

```
/frontend     Next.js 14 dashboard (5 pages)
/backend      FastAPI + PostgreSQL + Redis
/agents       AI agents + LLM wrapper
/guardrails   Deterministic safety layer
/data         Scenario JSON files + answer keys
/docs         Architecture, SRS, API contracts
/tests        Member 4 guardrail + evaluation tests
/.github      CI/CD workflows
```

---

## Demo Scenario

The "bad deploy" scenario (`data/scenarios/scenario_bad_deploy.json`) ships with the repo:

1. Open the dashboard → click **Checkout failures after v2.3 deploy**.
2. Watch noise filter remove 184 duplicate alerts.
3. Root cause appears: *Deploy v2.3 reduced DB connection pool from 50 → 10*.
4. Click **Try unsafe suggestion** to see the guardrail block a restart command.
5. Approve a safe read-only diagnostic — the timeline updates instantly.
6. Open **Audit & Safety** → metrics show 100% unsafe blocked.

---

## Architecture

```
DATA SOURCES          INGESTION           AGENTS (advisory only)
------------          ---------           ----------------------
Server logs    ──┐
Support tickets──┤   FastAPI        ───►  1. Noise Filter Agent
Deploy history ──┼──► /ingest/*     ───►  2. Correlation Agent
Chat messages  ──┘   + Redis queue  ───►  3. Root Cause Agent
                                          4. Diagnostic Proposal Agent
                                          5. Timeline Scribe Agent
                                             (Commander orchestrates)
                                                    │
                                          GUARDRAIL LAYER (plain code)
                                                    │
                         PostgreSQL ◄──── Next.js Dashboard
                      (append-only                Human: Approve / Reject
                       audit log)                 (records decision only)
```

---

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Primary LLM (Google Gemini free tier) |
| `GROQ_API_KEY` | Fallback LLM (Groq free tier) |
| `JWT_SECRET` | Random 32+ char secret for token signing |
| `DATABASE_URL` | PostgreSQL asyncpg URL |
| `REDIS_URL` | Redis connection URL |

---

## Running Tests

```bash
# Member 4 guardrail + evaluation tests (37 cases, no LLM needed)
python -m pytest tests/ -v

# Backend API tests
python -m pytest backend/tests/ -v

# Agent scenario tests (requires LLM key)
python -m pytest agents/tests/ -v
```

---

## Team

| # | Role | Owns |
|---|---|---|
| 1 | Frontend Lead | `/frontend` |
| 2 | Backend & DB Lead | `/backend` |
| 3 | AI Agents Lead | `/agents` |
| 4 | Safety & Evaluation Lead | `/guardrails`, `/tests` |
| 5 | DevOps, Data & Docs Lead | `/data`, `/infra`, `/docs`, CI/CD |

---

## Safety Guarantee

No code path in this system executes a command on live infrastructure.  
The Approve button **records a human decision** — nothing is run.  
Guardrails are a second layer on top, not the only protection.  
See [`docs/SAFETY_POLICY.md`](docs/SAFETY_POLICY.md).
