import logging

from sqlalchemy import text

from . import audit
from .config import get_settings
from .db import SessionLocal
from .security import hash_password, password_problem

log = logging.getLogger("healthai.bootstrap")


def ensure_admin() -> None:
    """Crea el administrador inicial si no existe ninguno activo (ADMIN_EMAIL / ADMIN_PASSWORD)."""
    settings = get_settings()
    with SessionLocal() as db:
        exists = db.execute(text("SELECT 1 FROM users WHERE rol = 'admin' AND activo LIMIT 1")).first()
        if exists:
            return
        if not settings.admin_email or not settings.admin_password:
            log.warning("No hay administrador y ADMIN_EMAIL/ADMIN_PASSWORD no están definidos.")
            return
        problem = password_problem(settings.admin_password)
        if problem:
            raise RuntimeError(f"ADMIN_PASSWORD no es válida: {problem}")

        user_id = db.execute(
            text(
                "INSERT INTO users (email, password_hash, nombre, rol) VALUES (:e, :h, :n, 'admin') "
                "ON CONFLICT (email) DO UPDATE SET rol = 'admin', activo = TRUE, password_hash = EXCLUDED.password_hash "
                "RETURNING id"
            ),
            {"e": settings.admin_email.strip().lower(), "h": hash_password(settings.admin_password), "n": settings.admin_name},
        ).scalar_one()
        audit.log(db, "admin_inicial_creado", user_id=user_id)
        db.commit()
        log.info("Administrador inicial creado: %s", settings.admin_email)
