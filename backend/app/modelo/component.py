import numpy as np

from .artifact import Artefacto
from .features import FEATURES


class ComponenteEstratificacionSaludMental:
    """Regresión logística L2 estandarizada (estratificación Ruta A / Ruta B).

    Adaptado de la clase entregada por el equipo del modelo, con estos cambios:
      * constructor `__init__` (la versión pegada decía `_init_`) que recibe un `Artefacto`;
      * las variables se identifican por NOMBRE (no por posición) y se validan;
      * la capa de reglas de seguridad NO vive aquí: está en `app/reglas/motor_reglas.py`
        (RNF04.3), con los umbrales del mockup;
      * añade la explicación Linear SHAP (RF04.3).
    """

    def __init__(self, artefacto: Artefacto) -> None:
        self.artefacto = artefacto
        self.weights = np.array(artefacto.pesos, dtype=float)
        self.intercept = float(artefacto.intercepto)
        self.mean = np.array(artefacto.media, dtype=float)
        self.scale = np.array(artefacto.escala, dtype=float)

    def _estandarizar(self, datos: dict[str, float]) -> np.ndarray:
        faltantes = [f for f in self.artefacto.features if f not in datos]
        if faltantes:
            raise ValueError(f"Faltan variables del modelo: {', '.join(faltantes)}")
        vector = np.array([float(datos[f]) for f in self.artefacto.features], dtype=float)
        return (vector - self.mean) / self.scale

    def predecir(self, datos: dict[str, float]) -> dict:
        x_scaled = self._estandarizar(datos)
        logit = float(np.dot(self.weights, x_scaled) + self.intercept)
        prob_ra = float(1.0 / (1.0 + np.exp(-np.clip(logit, -500.0, 500.0))))
        return {
            "ruta_base_modelo": "A" if prob_ra >= self.artefacto.umbral else "B",
            "probabilidad_ra": round(prob_ra, 4),
            "logit": logit,
        }

    def explicar(self, datos: dict[str, float], top: int = 3) -> list[dict]:
        """Linear SHAP: en una regresión logística estandarizada la contribución de cada variable
        (en log-odds, respecto al promedio) es `peso × valor estandarizado`."""
        contributions = self.weights * self._estandarizar(datos)
        order = np.argsort(-np.abs(contributions))[:top]
        factors = []
        for i in order:
            name = self.artefacto.features[int(i)]
            value = round(float(contributions[i]), 4)
            risk = value >= 0
            factors.append(
                {
                    "variable": name,
                    "etiqueta": self.artefacto.etiquetas.get(name) or FEATURES[name][0],
                    "valor": value,
                    "direccion": "riesgo" if risk else "protector",
                    "descripcion": "Aumenta la probabilidad de Ruta A" if risk else "Factor protector hacia Ruta B",
                }
            )
        return factors
