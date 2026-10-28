from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .security import AUD_ADMIN, AUD_APP, decode_token

bearer = HTTPBearer(auto_error=False)


def current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> dict:
    """Exige un token de administración vigente y un usuario admin activo."""
    unauthorized = HTTPException(401, "No autenticado o sesión expirada", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        claims = decode_token(creds.credentials, AUD_ADMIN)
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized from None

    user = (
        db.execute(
            text("SELECT id, email, nombre, rol, activo FROM users WHERE id = :id"),
            {"id": user_id},
        )
        .mappings()
        .first()
    )
    if user is None or not user["activo"] or user["rol"] != "admin":
        raise unauthorized
    return dict(user)


def _clinical_user(creds: HTTPAuthorizationCredentials | None, db: Session) -> dict:
    """Usuario del flujo clínico (token de /auth/login). Incluye la sede y el rol operativo del token."""
    unauthorized = HTTPException(401, "No autenticado o sesión expirada", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        claims = decode_token(creds.credentials, AUD_APP)
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized from None

    user = (
        db.execute(
            text("SELECT id, email, nombre, rol, activo FROM users WHERE id = :id"),
            {"id": user_id},
        )
        .mappings()
        .first()
    )
    if user is None or not user["activo"] or user["rol"] not in ("evaluador", "investigador"):
        raise unauthorized
    return {**user, "sede": claims.get("sede"), "cargo": claims.get("cargo")}


def current_clinical(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Evaluador o investigador con sesión clínica vigente (lectura)."""
    return _clinical_user(creds, db)


def current_evaluator(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Solo evaluadores: registran evaluaciones y decisiones."""
    user = _clinical_user(creds, db)
    if user["rol"] != "evaluador":
        raise HTTPException(403, "Solo los profesionales evaluadores pueden registrar evaluaciones")
    return user
