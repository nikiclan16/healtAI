import logging
from functools import lru_cache
from pathlib import Path

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


@lru_cache
def cargar_generico() -> ComponenteEstratificacionSaludMental | None:
    """Modelo de prueba (`model.placeholder.json`, junto al artefacto real) para la respuesta genérica."""
    ruta = Path(get_settings().model_artifact_path).with_name("model.placeholder.json")
    try:
        return ComponenteEstratificacionSaludMental(cargar_artefacto(str(ruta), permitir_placeholder=True))
    except ModeloNoDisponible as exc:
        log.error("Modelo de prueba no disponible: %s", exc)
        return None


def get_modelo_o_generico() -> ComponenteEstratificacionSaludMental:
    """Para `/predecir` y `/lotes`, que solo calculan y no guardan nada.

    Con el modelo real usa el real. Sin él responde con el modelo de prueba, y la respuesta lo declara
    (`modeloPlaceholder: true`) para que la interfaz muestre «MODELO DE PRUEBA». `/evaluaciones`, que sí
    registra al paciente, sigue exigiendo el modelo real (`get_modelo`)."""
    componente, _ = cargar()
    if componente is not None:
        return componente
    generico = cargar_generico()
    if generico is None:
        raise HTTPException(503, "Modelo no disponible")
    return generico
