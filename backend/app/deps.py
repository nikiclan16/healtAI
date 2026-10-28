from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .security import AUD_ADMIN, AUD_APP, decode_token

bearer = HTTPBearer(auto_error=False)


PASSWORD_CHANGE_REQUIRED = "Debe cambiar su contraseña temporal antes de continuar"


def _admin_user(creds: HTTPAuthorizationCredentials | None, db: Session) -> dict:
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
            text("SELECT id, email, nombre, rol, activo, debe_cambiar_password FROM users WHERE id = :id"),
            {"id": user_id},
        )
        .mappings()
        .first()
    )
    if user is None or not user["activo"] or user["rol"] != "admin":
        raise unauthorized
    return dict(user)


def current_admin_any(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Administrador autenticado, aunque aún deba cambiar su contraseña temporal (solo para cambiarla)."""
    return _admin_user(creds, db)


def current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Exige un token de administración vigente, un admin activo y sin contraseña temporal pendiente."""
    user = _admin_user(creds, db)
    if user["debe_cambiar_password"]:
        raise HTTPException(403, PASSWORD_CHANGE_REQUIRED)
    return user


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
            text("SELECT id, email, nombre, rol, activo, debe_cambiar_password FROM users WHERE id = :id"),
            {"id": user_id},
        )
        .mappings()
        .first()
    )
    if user is None or not user["activo"] or user["rol"] not in ("evaluador", "investigador"):
        raise unauthorized
    return {**user, "sede": claims.get("sede"), "cargo": claims.get("cargo")}


def current_clinical_any(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Sesión clínica vigente, aunque deba cambiar su contraseña temporal (solo para cambiarla)."""
    return _clinical_user(creds, db)


def current_clinical(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Evaluador o investigador con sesión clínica vigente y sin contraseña temporal pendiente."""
    user = _clinical_user(creds, db)
    if user["debe_cambiar_password"]:
        raise HTTPException(403, PASSWORD_CHANGE_REQUIRED)
    return user


def current_investigator(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Solo investigadores: métricas globales y exportaciones (solo lectura)."""
    user = current_clinical(creds, db)
    if user["rol"] != "investigador":
        raise HTTPException(403, "Solo los investigadores pueden consultar esta información")
    return user


def current_evaluator(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> dict:
    """Solo evaluadores: registran evaluaciones y decisiones."""
    user = current_clinical(creds, db)
    if user["rol"] != "evaluador":
        raise HTTPException(403, "Solo los profesionales evaluadores pueden registrar evaluaciones")
    return user
