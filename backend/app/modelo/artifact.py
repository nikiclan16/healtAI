import json
import math
from dataclasses import dataclass
from pathlib import Path

from .features import FEATURES


class ModeloNoDisponible(Exception):
    """El artefacto del modelo falta o no es válido: el servicio NO inventa predicciones."""


@dataclass(frozen=True)
class Artefacto:
    version: str
    features: tuple[str, ...]
    pesos: tuple[float, ...]
    intercepto: float
    media: tuple[float, ...]
    escala: tuple[float, ...]
    umbral: float
    placeholder: bool
    etiquetas: dict[str, str]


def _numbers(data: dict, key: str, n: int | None = None) -> tuple[float, ...]:
    raw = data.get(key)
    if not isinstance(raw, list) or not raw or not all(isinstance(x, int | float) and math.isfinite(x) for x in raw):
        raise ModeloNoDisponible(f"El artefacto debe incluir '{key}' como lista de números finitos")
    if n is not None and len(raw) != n:
        raise ModeloNoDisponible(f"'{key}' tiene {len(raw)} valores y se esperaban {n} (uno por variable)")
    return tuple(float(x) for x in raw)


def cargar_artefacto(path: str, permitir_placeholder: bool = False) -> Artefacto:
    file = Path(path)
    if not file.is_file():
        raise ModeloNoDisponible(f"No existe el artefacto del modelo en '{path}'")
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModeloNoDisponible(f"El artefacto del modelo no se pudo leer: {exc}") from exc

    features = data.get("features")
    if not isinstance(features, list) or not features or not all(isinstance(f, str) for f in features):
        raise ModeloNoDisponible("El artefacto debe incluir 'features' como lista de nombres")
    unknown = [f for f in features if f not in FEATURES]
    if unknown:
        raise ModeloNoDisponible(f"Variables desconocidas en el artefacto: {', '.join(unknown)}")
    if len(set(features)) != len(features):
        raise ModeloNoDisponible("El artefacto repite variables")

    n = len(features)
    escala = _numbers(data, "escala", n)
    if any(s == 0 for s in escala):
        raise ModeloNoDisponible("La escala del estandarizador no puede ser 0")
    intercepto = data.get("intercepto")
    if not isinstance(intercepto, int | float) or not math.isfinite(intercepto):
        raise ModeloNoDisponible("El artefacto debe incluir 'intercepto' numérico")
    umbral = data.get("umbral", 0.5)
    if not isinstance(umbral, int | float) or not 0 < umbral < 1:
        raise ModeloNoDisponible("'umbral' debe estar entre 0 y 1")
    version = data.get("version")
    if not isinstance(version, str) or not version.strip():
        raise ModeloNoDisponible("El artefacto debe incluir 'version'")

    placeholder = bool(data.get("placeholder", False))
    if placeholder and not permitir_placeholder:
        raise ModeloNoDisponible(
            "El artefacto es de prueba (placeholder) y ALLOW_PLACEHOLDER_MODEL no está activo. "
            "Instale el modelo entrenado real."
        )

    return Artefacto(
        version=version.strip(),
        features=tuple(features),
        pesos=_numbers(data, "pesos", n),
        intercepto=float(intercepto),
        media=_numbers(data, "media", n),
        escala=escala,
        umbral=float(umbral),
        placeholder=placeholder,
        etiquetas={k: str(v) for k, v in (data.get("etiquetas") or {}).items()},
    )
