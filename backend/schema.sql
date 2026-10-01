-- Sentinel Incident Commander — PostgreSQL Schema
-- audit_log and timeline_entries are append-only (no UPDATE/DELETE permitted).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- Users & Projects
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('incident_lead', 'viewer')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    ingest_api_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default project
INSERT INTO projects (name) VALUES ('shop-demo') ON CONFLICT DO NOTHING;

-- Insert default users
INSERT INTO users (username, email, password_hash, role) VALUES
    ('incident_lead', 'lead@example.com',
     crypt('changeme', gen_salt('bf')), 'incident_lead'),
    ('viewer', 'viewer@example.com',
     crypt('viewonly', gen_salt('bf')), 'viewer')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- Incidents
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id),
    title       TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    status      TEXT NOT NULL DEFAULT 'investigating'
                CHECK (status IN ('investigating', 'monitoring', 'resolved')),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Events (raw + cleaned ingested data)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    project_id  UUID NOT NULL REFERENCES projects(id),
    incident_id UUID REFERENCES incidents(id),
    source      TEXT NOT NULL CHECK (source IN ('log', 'ticket', 'deploy', 'chat')),
    timestamp   TIMESTAMPTZ NOT NULL,
    service     TEXT NOT NULL,
    severity    TEXT NOT NULL,
    message     TEXT NOT NULL,
    raw         TEXT NOT NULL,
    is_noise    BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_incident_id ON events(incident_id);
CREATE INDEX IF NOT EXISTS events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS events_service ON events(service);

-- ─────────────────────────────────────────────
-- Proposals (diagnostic suggestions)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
    id              TEXT PRIMARY KEY,
    incident_id     UUID NOT NULL REFERENCES incidents(id),
    title           TEXT NOT NULL,
    check_text      TEXT NOT NULL,
    why             TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    risk            TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
    guardrail_decision TEXT NOT NULL,
    guardrail_reason   TEXT NOT NULL,
    evidence_ids    TEXT[] NOT NULL DEFAULT '{}',
    decided_by      UUID REFERENCES users(id),
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Timeline entries (append-only)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timeline_entries (
    id          TEXT PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id),
    timestamp   TIMESTAMPTZ NOT NULL,
    actor       TEXT NOT NULL CHECK (actor IN ('system', 'ai', 'human')),
    action      TEXT NOT NULL,
    evidence_ids TEXT[] NOT NULL DEFAULT '{}',
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_incident_id ON timeline_entries(incident_id);
CREATE INDEX IF NOT EXISTS timeline_timestamp ON timeline_entries(timestamp);

-- Block UPDATE/DELETE on timeline_entries
CREATE OR REPLACE RULE no_update_timeline AS
    ON UPDATE TO timeline_entries DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_timeline AS
    ON DELETE TO timeline_entries DO INSTEAD NOTHING;

-- ─────────────────────────────────────────────
-- Audit log (append-only)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id),
    proposal_id TEXT REFERENCES proposals(id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor       TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    decision    TEXT,
    reason      TEXT,
    original_check TEXT,
    normalized_check TEXT,
    risk        TEXT,
    performed_by UUID REFERENCES users(id)
);

-- Block UPDATE/DELETE on audit_log
CREATE OR REPLACE RULE no_update_audit AS
    ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS
    ON DELETE TO audit_log DO INSTEAD NOTHING;
