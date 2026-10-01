# Architecture & Data Flow

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                               │
│  Server logs · Support tickets · Deploy history · Engineer chat     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP POST /ingest/*
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND  (FastAPI + PostgreSQL + Redis)          │
│                                                                     │
│  Parsers → shared Event format → PostgreSQL.events                  │
│  PostgreSQL.events → Redis queue (event_stream)                     │
│  JWT auth · Role-based access control · WebSocket broadcaster       │
└─────────────┬──────────────────────────────────┬───────────────────┘
              │ reads queue                       │ writes results
              ▼                                   ▼
┌─────────────────────────────┐     ┌─────────────────────────────────┐
│   COMMANDER (LangGraph)     │     │   PostgreSQL (audit tables)     │
│                             │     │                                 │
│  1. Noise Filter Agent      │     │  timeline_entries  (append-only)│
│  2. Correlation Agent       │     │  proposals                      │
│  3. Root Cause Agent        │     │  audit_log         (append-only)│
│  4. Proposal Agent  ─────── ├────►│                                 │
│  5. Timeline Scribe ─────── ├────►│                                 │
└────────────┬────────────────┘     └─────────────────────────────────┘
             │ every suggestion
             ▼
┌───────────────────────────────┐
│  GUARDRAIL LAYER (plain code) │  ← no LLM, no network, no subproc  │
│  evaluate_check(text)         │                                     │
│  → allowed / blocked / review │                                     │
└───────────────────────────────┘
             │ only allowed proposals reach the UI
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│           NEXT.JS DASHBOARD  (port 3000)                           │
│                                                                     │
│  /login          JWT login                                          │
│  /incidents      Incident list with severity & status               │
│  /war-room/[id]  Left: cleaned alerts | Center: root causes |       │
│                  Right: safe diagnostics + chat                     │
│  /timeline/[id]  Vertical timeline by actor (human/AI/system)       │
│  /audit          Blocked commands · metrics · policy allowlist      │
│                                                                     │
│  WebSocket → live push of new events and agent results              │
│  Approve button → POST /proposals/{id}/decide → audit row only      │
└─────────────────────────────────────────────────────────────────────┘
```

## Shared Event Format

All ingested data is normalised to:

```json
{
  "id": "evt_0001",
  "project_id": "shop-demo",
  "source": "log|ticket|deploy|chat",
  "timestamp": "2026-09-30T10:42:11Z",
  "service": "checkout",
  "severity": "error|warning|info",
  "message": "human-readable summary",
  "raw": "original line as received"
}
```

## Agent Pipeline

```
Events (cleaned) ──► NoiseFilterAgent
                          │ cleaned_events, removed_count
                          ▼
                   CorrelationAgent
                          │ event_clusters
                          ▼
                   RootCauseAgent  ──► LLM (Gemini → Groq fallback)
                          │ RootCauseOutput (must have evidence_ids)
                          ▼
                   DiagnosticProposalAgent
                          │ candidates ──► evaluate_check() ──► GUARDRAIL
                          │ DiagnosticProposal (allowed | blocked)
                          ▼
                   TimelineScribeAgent
                          │ TimelineEntry[]  (chronological, append-only)
                          ▼
                   Write to PostgreSQL → push via WebSocket
```

## Technology Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy (async), asyncpg |
| Database | PostgreSQL 16 |
| Queue | Redis 7 |
| AI agents | LangGraph, Pydantic |
| LLM | Gemini (primary), Groq (fallback) |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + Grafana (Phase 4) |
