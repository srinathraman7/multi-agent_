"""WebSocket connection manager and broadcast helper."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

_clients: list[WebSocket] = []


async def broadcast(message: dict[str, Any]) -> None:
    """Push a JSON message to all connected WebSocket clients."""
    text = json.dumps(message, default=str)
    dead: list[WebSocket] = []
    for ws in list(_clients):
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _clients.remove(ws)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    _clients.append(websocket)
    try:
        while True:
            # Keep the connection alive; clients send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _clients:
            _clients.remove(websocket)
