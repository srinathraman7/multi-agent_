"""Proposals router — record human decisions, never execute commands."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..routers.auth import UserOut, get_current_user, require_incident_lead
from ..routers.ws_router import broadcast

router = APIRouter()


class DecideRequest(BaseModel):
    decision: str  # "approved" | "rejected"


@router.post("/{proposal_id}/decide", status_code=200)
async def decide_proposal(
    proposal_id: str,
    body: DecideRequest,
    db: AsyncSession = Depends(get_db),
    user: UserOut = Depends(require_incident_lead),
) -> dict:
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'.")

    # Fetch proposal
    row = (await db.execute(text(
        "SELECT id, incident_id, status FROM proposals WHERE id = :id"
    ), {"id": proposal_id})).fetchone()
    if not row:
        raise HTTPException(404, "Proposal not found.")
    if row.status != "pending":
        raise HTTPException(409, f"Proposal is already '{row.status}'.")

    now = datetime.now(UTC)

    # Record decision on proposal (status update only — no command runs)
    await db.execute(text("""
        UPDATE proposals SET status = :status, decided_by = :uid::uuid, decided_at = :now
        WHERE id = :id
    """), {"status": body.decision, "uid": user.id, "now": now, "id": proposal_id})

    # Append to audit log (never deleted)
    audit_id = f"audit_{uuid.uuid4().hex}"
    await db.execute(text("""
        INSERT INTO audit_log (id, incident_id, proposal_id, timestamp, actor, event_type, decision)
        VALUES (:id, :incident_id::uuid, :proposal_id, :ts, :actor, 'proposal_decision', :decision)
    """), {
        "id": audit_id,
        "incident_id": str(row.incident_id),
        "proposal_id": proposal_id,
        "ts": now,
        "actor": user.username,
        "decision": body.decision,
    })
    await db.commit()

    # Push live update via WebSocket — only a decision record, no command
    await broadcast({
        "type": "proposal_decided",
        "proposal_id": proposal_id,
        "decision": body.decision,
        "decided_by": user.username,
        "note": "No command was executed. This records a human decision only.",
    })

    return {
        "proposal_id": proposal_id,
        "decision": body.decision,
        "decided_by": user.username,
        "note": "Decision recorded in the audit log. No action was executed.",
    }
