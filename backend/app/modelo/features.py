"""Variables que un artefacto de modelo puede usar y de dónde salen en el formulario.

El artefacto lista sus variables por nombre (`features`); este catálogo las traduce a valores.
Quedan FUERA a propósito: el nivel de riesgo de amputación ADA/IWGDF (RF02.4: causaría fuga de
información) y el apoyo familiar V13 (insumo de las reglas, no del clasificador).
"""

from collections.abc import Callable

from ..schemas_clinicos import ScreeningFormIn

Extractor = Callable[[ScreeningFormIn], float]


def _f(value: object) -> float:
    return float(value)  # type: ignore[arg-type]


FEATURES: dict[str, tuple[str, Extractor]] = {
    "tiempo_dm2": ("Tiempo de diagnóstico DM2 (años)", lambda f: _f(f.v8_tiempo_diagnostico)),
    "trat_dieta_ejercicio": ("Tratamiento: dieta y ejercicio", lambda f: _f(f.v9_tratamiento == "dieta_ejercicio")),
    "trat_orales": ("Tratamiento: hipoglucemiantes orales", lambda f: _f(f.v9_tratamiento == "orales")),
    "trat_insulina": ("Tratamiento: insulina", lambda f: _f(f.v9_tratamiento == "insulina")),
    "trat_orales_insulina": ("Tratamiento: orales + insulina", lambda f: _f(f.v9_tratamiento == "orales_insulina")),
    "trat_ninguno": ("Sin tratamiento activo", lambda f: _f(f.v9_tratamiento == "ninguno")),
    "hipertension": ("Comorbilidad: hipertensión", lambda f: _f(f.v11.hipertension)),
    "cardiaca": ("Comorbilidad: cardíaca", lambda f: _f(f.v11.cardiaca)),
    "obesidad": ("Comorbilidad: obesidad", lambda f: _f(f.v11.obesidad)),
    "enf_otra": ("Comorbilidad: otra", lambda f: _f(f.v11.otra)),
    "enf_ninguna": (
        "Sin comorbilidades",
        lambda f: _f(not (f.v11.hipertension or f.v11.cardiaca or f.v11.obesidad or f.v11.otra)),
    ),
    "percepcion_salud": ("Percepción de salud", lambda f: _f(f.v12_percepcion_salud)),
    "actividad_fisica": ("Actividad física", lambda f: _f(f.v14_actividad_fisica)),
    "calidad_sueno": ("Calidad del sueño", lambda f: _f(f.v15_calidad_sueno)),
    "who5_total": ("Bienestar WHO-5", lambda f: _f(f.who5_total)),
    "dass_depresion": ("DASS-21 depresión", lambda f: _f(f.dass_depresion)),
    "dass_ansiedad": ("DASS-21 ansiedad", lambda f: _f(f.dass_ansiedad)),
    "dass_estres": ("DASS-21 estrés", lambda f: _f(f.dass_estres)),
}
