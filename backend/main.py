"""Sentinel — FastAPI application factory."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, Base
from .routers import auth, incidents, ingest, proposals, ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are created by schema.sql; nothing to do at startup.
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Sentinel Incident Commander API",
        version="1.0.0",
        description="Advisory-only multi-agent incident diagnosis platform.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
    app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
    app.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
    app.include_router(ws_router.router, tags=["websocket"])

    return app


app = create_app()
