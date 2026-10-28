import logging
from functools import lru_cache

from fastapi import HTTPException

from ..config import get_settings
from .artifact import ModeloNoDisponible, cargar_artefacto
from .component import ComponenteEstratificacionSaludMental

log = logging.getLogger("healthai.modelo")


@lru_cache
def cargar() -> tuple[ComponenteEstratificacionSaludMental | None, str | None]:
    """Carga el modelo una vez. Devuelve (componente, None) o (None, motivo del fallo)."""
    settings = get_settings()
    try:
        componente = ComponenteEstratificacionSaludMental(
            cargar_artefacto(settings.model_artifact_path, settings.allow_placeholder_model)
        )
    except ModeloNoDisponible as exc:
        log.error("Modelo no disponible: %s", exc)
        return None, str(exc)
    if componente.artefacto.placeholder:
        log.warning("MODELO DE PRUEBA cargado (placeholder): las predicciones NO son clínicas.")
    else:
        log.info("Modelo %s cargado", componente.artefacto.version)
    return componente, None


def get_modelo() -> ComponenteEstratificacionSaludMental:
    """Dependencia de FastAPI: sin modelo válido responde 503 (nunca inventa una predicción)."""
    componente, motivo = cargar()
    if componente is None:
        raise HTTPException(503, f"Modelo no disponible: {motivo}")
    return componente
