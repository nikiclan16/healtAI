import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def log(
    db: Session,
    evento: str,
    *,
    user_id: Any = None,
    site_code: str | None = None,
    evaluation_id: Any = None,
    detalle: dict[str, Any] | None = None,
) -> None:
    """Registra un evento en la bitácora (el trigger de la BD encadena el hash).

    Nunca incluir contraseñas ni datos identificables de pacientes en `detalle`.
    """
    db.execute(
        text(
            "INSERT INTO audit_log (evento, user_id, site_code, evaluation_id, detalle) "
            "VALUES (:evento, :user_id, :site_code, :evaluation_id, CAST(:detalle AS jsonb))"
        ),
        {
            "evento": evento,
            "user_id": user_id,
            "site_code": site_code,
            "evaluation_id": evaluation_id,
            "detalle": json.dumps(detalle or {}, ensure_ascii=False, default=str),
        },
    )
