from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .security import AUD_ADMIN, decode_token

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
