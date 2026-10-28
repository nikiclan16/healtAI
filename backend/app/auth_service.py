from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import audit
from .config import get_settings
from .security import dummy_verify, hash_password, verify_password

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
                "SELECT id, email, nombre, rol, activo, debe_cambiar_password, password_hash, failed_logins, "
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


def cambiar_password(db: Session, user: dict, actual: str, nueva: str) -> None:
    """Cambio de contraseña por el propio usuario: exige la actual y rechaza reutilizarla."""
    row = db.execute(text("SELECT password_hash FROM users WHERE id = :id"), {"id": user["id"]}).mappings().one()
    if not verify_password(actual, row["password_hash"]):
        audit.log(db, "cambio_password_fallido", user_id=user["id"])
        db.commit()
        raise HTTPException(400, "La contraseña actual no es correcta")
    if verify_password(nueva, row["password_hash"]):
        raise HTTPException(400, "La nueva contraseña debe ser distinta de la actual")
    db.execute(
        text("UPDATE users SET password_hash = :h, debe_cambiar_password = FALSE WHERE id = :id"),
        {"h": hash_password(nueva), "id": user["id"]},
    )
    audit.log(db, "cambio_password", user_id=user["id"])
