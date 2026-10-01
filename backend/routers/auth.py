"""JWT authentication and role-based access control."""
from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-32chars+")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    username: str
    role: str


def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.now(UTC) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    row = (await db.execute(
        text("SELECT id, username, role FROM users WHERE username = :u"),
        {"u": username},
    )).fetchone()
    if row is None:
        raise credentials_exc
    return UserOut(id=str(row.id), username=row.username, role=row.role)


def require_incident_lead(user: UserOut = Depends(get_current_user)) -> UserOut:
    if user.role != "incident_lead":
        raise HTTPException(status_code=403, detail="Incident Lead role required.")
    return user


@router.post("/token", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        text("SELECT username, password_hash, role FROM users WHERE username = :u"),
        {"u": form.username},
    )).fetchone()
    if row is None or not pwd_context.verify(form.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    token = create_token({"sub": row.username, "role": row.role})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: UserOut = Depends(get_current_user)) -> UserOut:
    return user
