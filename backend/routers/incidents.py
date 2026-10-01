"""Incidents and related read endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from ..db import get_db
from ..routers.auth import get_current_user, UserOut

router = APIRouter()


@router.get("/")
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT id, title, severity, status, started_at FROM incidents ORDER BY started_at DESC LIMIT 50"
    ))).mappings().all()
    return [dict(r) for r in rows]


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> dict:
    row = (await db.execute(text(
        "SELECT id, title, severity, status, started_at, resolved_at FROM incidents WHERE id = :id"
    ), {"id": incident_id})).mappings().fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Incident not found.")
    return dict(row)


@router.get("/{incident_id}/events")
async def list_events(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT id, source, timestamp, service, severity, message, raw, is_noise "
        "FROM events WHERE incident_id = :id ORDER BY timestamp ASC"
    ), {"id": incident_id})).mappings().all()
    return [dict(r) for r in rows]


@router.get("/{incident_id}/timeline")
async def get_timeline(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT id, timestamp, actor, action, evidence_ids, metadata "
        "FROM timeline_entries WHERE incident_id = :id ORDER BY timestamp ASC"
    ), {"id": incident_id})).mappings().all()
    return [dict(r) for r in rows]


@router.get("/{incident_id}/proposals")
async def list_proposals(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT id, title, check_text, why, expected_result, risk, status, "
        "guardrail_decision, guardrail_reason, evidence_ids "
        "FROM proposals WHERE incident_id = :id ORDER BY created_at ASC"
    ), {"id": incident_id})).mappings().all()
    return [dict(r) for r in rows]


@router.get("/audit/log")
async def get_audit_log(
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT id, incident_id, proposal_id, timestamp, actor, event_type, decision, reason "
        "FROM audit_log ORDER BY timestamp DESC LIMIT 200"
    ))).mappings().all()
    return [dict(r) for r in rows]


@router.get("/audit/metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(get_current_user),
) -> dict[str, Any]:
    total_events = (await db.execute(text("SELECT COUNT(*) FROM events"))).scalar() or 0
    noise = (await db.execute(text("SELECT COUNT(*) FROM events WHERE is_noise = TRUE"))).scalar() or 0
    unsafe_blocked = (await db.execute(text(
        "SELECT COUNT(*) FROM audit_log WHERE event_type='guardrail_decision' AND decision='blocked'"
    ))).scalar() or 0
    unsafe_total = (await db.execute(text(
        "SELECT COUNT(*) FROM audit_log WHERE event_type='guardrail_decision'"
    ))).scalar() or 0
    return {
        "total_events": total_events,
        "noise_removed": noise,
        "noise_reduction_percentage": round(noise / total_events * 100, 1) if total_events else 0,
        "unsafe_blocked": unsafe_blocked,
        "unsafe_total": unsafe_total,
        "unsafe_blocked_percentage": round(unsafe_blocked / unsafe_total * 100, 1) if unsafe_total else 100.0,
    }
