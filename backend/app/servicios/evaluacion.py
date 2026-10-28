from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import APP_VERSION
from ..config import get_settings
from ..modelo.component import ComponenteEstratificacionSaludMental
from ..modelo.features import FEATURES
from ..reglas.motor_reglas import evaluar_reglas, resolver_ruta
from ..schemas_clinicos import ScreeningFormIn


def entrada_del_modelo(modelo: ComponenteEstratificacionSaludMental, form: ScreeningFormIn) -> dict[str, float]:
    """Valores de las variables que usa el modelo (y solo esas)."""
    return {name: FEATURES[name][1](form) for name in modelo.artefacto.features}


def predecir(modelo: ComponenteEstratificacionSaludMental, form: ScreeningFormIn) -> tuple[dict, dict[str, float]]:
    """Inferencia pura (sin reglas ni persistencia). Devuelve (predicción, entrada usada)."""
    entrada = entrada_del_modelo(modelo, form)
    base = modelo.predecir(entrada)
    prediccion = {
        "probabilidadRA": base["probabilidad_ra"],
        "rutaBase": base["ruta_base_modelo"],
        # Los modelos retadores (KNN, MLP) aún no están conectados: no se inventa una confianza.
        "confianza": None,
        "retadores": None,
        "shapTop3": modelo.explicar(entrada, top=3),
        "versionModelo": modelo.artefacto.version,
        "modeloPlaceholder": modelo.artefacto.placeholder,
    }
    return prediccion, entrada


def ejecutar(modelo: ComponenteEstratificacionSaludMental, form: ScreeningFormIn) -> dict:
    """Inferencia + motor de reglas + ruta final sugerida."""
    prediccion, entrada = predecir(modelo, form)
    reglas = evaluar_reglas(form)
    ruta, escalada = resolver_ruta(prediccion["rutaBase"], reglas)
    return {
        "entrada": entrada,
        "prediccion": prediccion,
        "reglas": reglas,
        "rutaSistema": ruta,
        "escalada": escalada,
        "versiones": {
            "app": APP_VERSION,
            "modelo": prediccion["versionModelo"],
            "diccionario": get_settings().dictionary_version,
        },
    }


_SELECT = """
SELECT e.id, e.created_at, e.codigo_paciente, e.site_code, e.user_id, u.nombre AS profesional_nombre,
       e.formulario, e.entrada_modelo, e.prediccion, e.reglas, e.ruta_sistema, e.escalada,
       e.version_app, e.version_modelo, e.version_diccionario,
       d.accion, d.ruta_final, d.justificacion, d.user_id AS decision_user_id, d.decidido_en
FROM evaluations e
JOIN users u ON u.id = e.user_id
LEFT JOIN decisions d ON d.evaluation_id = e.id
"""


def _iso(value: datetime) -> str:
    return value.isoformat()


def _a_json(row) -> dict:
    """Fila → forma `Evaluation` que consume el frontend (camelCase)."""
    out = {
        "id": str(row["id"]),
        "creadoEn": _iso(row["created_at"]),
        "codigoPaciente": row["codigo_paciente"],
        "sede": row["site_code"],
        "profesional": {"id": str(row["user_id"]), "nombre": row["profesional_nombre"]},
        "formulario": row["formulario"],
        "entrada": row["entrada_modelo"],
        "prediccion": row["prediccion"],
        "reglas": row["reglas"],
        "rutaSistema": row["ruta_sistema"],
        "escalada": row["escalada"],
        "versiones": {
            "app": row["version_app"],
            "modelo": row["version_modelo"],
            "diccionario": row["version_diccionario"],
        },
    }
    if row["accion"] is not None:
        out["decision"] = {
            "accion": row["accion"],
            "rutaFinal": row["ruta_final"],
            "justificacion": row["justificacion"],
            "profesionalId": str(row["decision_user_id"]),
            "decididoEn": _iso(row["decidido_en"]),
        }
    return out


def obtener(db: Session, evaluation_id: UUID) -> dict | None:
    row = db.execute(text(f"{_SELECT} WHERE e.id = :id"), {"id": evaluation_id}).mappings().first()
    return _a_json(row) if row else None


def listar(db: Session, *, user_id: UUID | None, limit: int) -> list[dict]:
    where = "WHERE e.user_id = :u " if user_id else ""
    rows = db.execute(
        text(f"{_SELECT} {where}ORDER BY e.created_at DESC LIMIT :limit"),
        {"u": user_id, "limit": limit} if user_id else {"limit": limit},
    ).mappings()
    return [_a_json(r) for r in rows]
