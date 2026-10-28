from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import audit
from .config import get_settings
from .security import dummy_verify, verify_password

BAD_CREDENTIALS = "Usuario o contraseña incorrectos"


def authenticate(db: Session, usuario: str, password: str) -> dict:
    """Verifica usuario y contraseña con bloqueo temporal tras varios intentos fallidos.

    Los fallos se confirman (commit) antes de responder para que el contador y la
    bitácora persistan aunque la petición termine en error.
    """
    settings = get_settings()
    key = usuario.strip().lower()[:254]
    row = (
        db.execute(
            text(
                "SELECT id, email, nombre, rol, activo, password_hash, failed_logins, "
                "(locked_until IS NOT NULL AND locked_until > now()) AS bloqueado "
                "FROM users WHERE email = :email"
            ),
            {"email": key},
        )
        .mappings()
        .first()
    )

    if row is None:
        dummy_verify(password)
        audit.log(db, "login_fallido", detalle={"motivo": "usuario_desconocido", "usuario": key})
        db.commit()
        raise HTTPException(401, BAD_CREDENTIALS)

    if row["bloqueado"]:
        audit.log(db, "login_bloqueado", user_id=row["id"])
        db.commit()
        raise HTTPException(423, "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.")

    if not verify_password(password, row["password_hash"]):
        failed = row["failed_logins"] + 1
        if failed >= settings.max_failed_logins:
            db.execute(
                text(
                    "UPDATE users SET failed_logins = 0, locked_until = now() + make_interval(mins => :m) "
                    "WHERE id = :id"
                ),
                {"m": settings.lockout_minutes, "id": row["id"]},
            )
            audit.log(db, "cuenta_bloqueada", user_id=row["id"], detalle={"minutos": settings.lockout_minutes})
        else:
            db.execute(text("UPDATE users SET failed_logins = :n WHERE id = :id"), {"n": failed, "id": row["id"]})
        audit.log(db, "login_fallido", user_id=row["id"], detalle={"motivo": "contrasena"})
        db.commit()
        raise HTTPException(401, BAD_CREDENTIALS)

    if not row["activo"]:
        audit.log(db, "login_denegado", user_id=row["id"], detalle={"motivo": "cuenta_desactivada"})
        db.commit()
        raise HTTPException(403, "La cuenta está desactivada")

    db.execute(
        text("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = :id"),
        {"id": row["id"]},
    )
    return dict(row)
