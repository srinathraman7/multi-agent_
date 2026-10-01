"""Ingestion endpoints: receive raw data and normalise to the shared event format."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db

router = APIRouter()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


# ─── Pydantic input models ────────────────────────────────────────────────────

class LogEntry(BaseModel):
    project_id: str
    timestamp: datetime
    service: str
    severity: str
    message: str
    raw: str | None = None


class TicketEntry(BaseModel):
    project_id: str
    timestamp: datetime
    service: str
    title: str
    body: str


class DeployEntry(BaseModel):
    project_id: str
    timestamp: datetime
    service: str
    version: str
    change_summary: str


class ChatEntry(BaseModel):
    project_id: str
    timestamp: datetime
    service: str
    author: str
    message: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _resolve_project(project_id: str, db: AsyncSession) -> str:
    row = (await db.execute(
        text("SELECT id FROM projects WHERE name = :n OR id::text = :n"),
        {"n": project_id},
    )).fetchone()
    if row is None:
        raise HTTPException(404, f"Project '{project_id}' not found.")
    return str(row.id)


async def _save_event(event: dict[str, Any], db: AsyncSession, redis: aioredis.Redis) -> None:
    await db.execute(
        text("""
            INSERT INTO events (id, project_id, source, timestamp, service, severity, message, raw)
            VALUES (:id, :project_id::uuid, :source, :timestamp, :service, :severity, :message, :raw)
            ON CONFLICT (id) DO NOTHING
        """),
        event,
    )
    await db.commit()
    await redis.rpush("event_stream", json.dumps(event, default=str))


def _evt_id() -> str:
    return f"evt_{uuid.uuid4().hex[:8]}"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/logs", status_code=202)
async def ingest_log(body: LogEntry, db: AsyncSession = Depends(get_db)):
    pid = await _resolve_project(body.project_id, db)
    redis = await get_redis()
    event = {
        "id": _evt_id(),
        "project_id": pid,
        "source": "log",
        "timestamp": body.timestamp.isoformat(),
        "service": body.service,
        "severity": body.severity,
        "message": body.message,
        "raw": body.raw or body.message,
    }
    await _save_event(event, db, redis)
    return {"status": "accepted", "event_id": event["id"]}


@router.post("/tickets", status_code=202)
async def ingest_ticket(body: TicketEntry, db: AsyncSession = Depends(get_db)):
    pid = await _resolve_project(body.project_id, db)
    redis = await get_redis()
    event = {
        "id": _evt_id(),
        "project_id": pid,
        "source": "ticket",
        "timestamp": body.timestamp.isoformat(),
        "service": body.service,
        "severity": "error",
        "message": body.title,
        "raw": body.body,
    }
    await _save_event(event, db, redis)
    return {"status": "accepted", "event_id": event["id"]}


@router.post("/deploys", status_code=202)
async def ingest_deploy(body: DeployEntry, db: AsyncSession = Depends(get_db)):
    pid = await _resolve_project(body.project_id, db)
    redis = await get_redis()
    event = {
        "id": _evt_id(),
        "project_id": pid,
        "source": "deploy",
        "timestamp": body.timestamp.isoformat(),
        "service": body.service,
        "severity": "info",
        "message": f"Version {body.version} deployed to {body.service}",
        "raw": body.change_summary,
    }
    await _save_event(event, db, redis)
    return {"status": "accepted", "event_id": event["id"]}


@router.post("/chat", status_code=202)
async def ingest_chat(body: ChatEntry, db: AsyncSession = Depends(get_db)):
    pid = await _resolve_project(body.project_id, db)
    redis = await get_redis()
    event = {
        "id": _evt_id(),
        "project_id": pid,
        "source": "chat",
        "timestamp": body.timestamp.isoformat(),
        "service": body.service,
        "severity": "warning",
        "message": f"{body.author}: {body.message}",
        "raw": body.message,
    }
    await _save_event(event, db, redis)
    return {"status": "accepted", "event_id": event["id"]}


@router.post("/scenario/{scenario_id}", status_code=202)
async def ingest_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    """Bulk-ingest a scenario JSON file for demo/testing."""
    import pathlib
    scenario_path = pathlib.Path("/app/data/scenarios") / f"scenario_{scenario_id}.json"
    if not scenario_path.exists():
        # Try local path for dev outside Docker
        scenario_path = pathlib.Path(__file__).parents[3] / "data" / "scenarios" / f"scenario_{scenario_id}.json"
    if not scenario_path.exists():
        raise HTTPException(404, f"Scenario '{scenario_id}' not found.")
    data = json.loads(scenario_path.read_text())
    redis = await get_redis()

    # Ensure project exists
    pid = await _resolve_project(data["events"][0]["project_id"], db)

    # Create incident
    incident_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO incidents (id, project_id, title, severity, status)
        VALUES (:id, :pid::uuid, :title, 'critical', 'investigating')
    """), {"id": incident_id, "pid": pid, "title": data["title"]})

    for event in data["events"]:
        event_row = {**event, "project_id": pid, "incident_id": incident_id}
        await db.execute(text("""
            INSERT INTO events (id, project_id, incident_id, source, timestamp, service, severity, message, raw)
            VALUES (:id, :project_id::uuid, :incident_id::uuid, :source, :timestamp, :service, :severity, :message, :raw)
            ON CONFLICT (id) DO NOTHING
        """), {**event_row, "timestamp": event["timestamp"]})
        await redis.rpush("event_stream", json.dumps(event_row, default=str))

    await db.commit()
    return {"status": "accepted", "incident_id": incident_id, "events_count": len(data["events"])}
