"""Motor de reglas clínicas de seguridad R1–R5 + regla de seguridad (RF05.1).

Funciones puras, independientes del clasificador y de la base de datos (RNF04.3). Los umbrales
están en `CONFIG` y siguen el mockup. PENDIENTE: validación del referente clínico.

Espejo de frontend/src/rules/engine.ts: ambos deben mantenerse en sincronía. La salida usa
claves en camelCase porque es el formato que consume el frontend.
"""

from copy import deepcopy

from ..schemas_clinicos import ScreeningFormIn

NIVELES = ("normal", "leve", "moderado", "severo", "extremo")
ESCALAS = ("depresion", "ansiedad", "estres")
NOMBRE_ESCALA = {"depresion": "Depresión", "ansiedad": "Ansiedad", "estres": "Estrés"}

CONFIG = {
    # Límites superiores (inclusive) de normal, leve, moderado y severo; por encima es extremo.
    "cortes_dass": {
        "depresion": (4, 6, 10, 13),
        "ansiedad": (3, 5, 7, 9),
        "estres": (7, 9, 12, 16),
    },
    "r1_item21_min": 2,
    "r2_nivel_min": "severo",
    "r3_who5_max_pct": 28,
    "r4": {"nivel_min": "moderado", "min_escalas": 2},
    "r5": {"min_marcadores": 3, "sueno_max": 2, "apoyo_max": 2, "actividad_igual": 0, "who5_menor_pct": 52},
}


def nivel_dass(escala: str, puntaje: int, cortes: dict | None = None) -> str:
    limites = (cortes or CONFIG["cortes_dass"])[escala]
    for i, limite in enumerate(limites):
        if puntaje <= limite:
            return NIVELES[i]
    return NIVELES[-1]


def _al_menos(nivel: str, minimo: str) -> bool:
    return NIVELES.index(nivel) >= NIVELES.index(minimo)


def evaluar_reglas(form: ScreeningFormIn, config: dict | None = None) -> dict:
    cfg = config or CONFIG
    puntajes = {
        "depresion": form.dass_depresion,
        "ansiedad": form.dass_ansiedad,
        "estres": form.dass_estres,
    }
    niveles = {e: nivel_dass(e, puntajes[e], cfg["cortes_dass"]) for e in ESCALAS}
    who5 = form.who5_total
    pct = who5 * 4
    item21 = form.dass_item21

    # R1 — ítem 21 ≥ 2 o no evaluable
    r1 = item21 is None or item21 >= cfg["r1_item21_min"]
    r1_detalle = (
        "Ítem 21 no evaluable: se trata como riesgo suicida"
        if item21 is None
        else f"Ítem 21 = {item21} (umbral ≥ {cfg['r1_item21_min']})"
    )

    # R2 — alguna subescala severa o extremadamente severa
    severas = [e for e in ESCALAS if _al_menos(niveles[e], cfg["r2_nivel_min"])]
    r2_detalle = (
        ", ".join(f"{NOMBRE_ESCALA[e]} {puntajes[e]} ({niveles[e]})" for e in severas)
        if severas
        else "Ninguna subescala en nivel severo o superior"
    )

    # R3 — WHO-5 ≤ 28 %
    r3 = pct <= cfg["r3_who5_max_pct"]
    r3_detalle = f"WHO-5 = {who5}/25 ({pct} %), umbral ≤ {cfg['r3_who5_max_pct']} %"

    # R4 — dos o más subescalas en nivel moderado o superior
    moderadas = [e for e in ESCALAS if _al_menos(niveles[e], cfg["r4"]["nivel_min"])]
    r4 = len(moderadas) >= cfg["r4"]["min_escalas"]
    listado = ", ".join(f"{NOMBRE_ESCALA[e]} {puntajes[e]}" for e in moderadas) or "ninguna"
    r4_detalle = f"{len(moderadas)} subescala(s) en nivel {cfg['r4']['nivel_min']} o superior: {listado}"

    # R5 — ≥ 3 de 4 marcadores de vulnerabilidad
    c5 = cfg["r5"]
    marcadores = [
        (f"Sueño ≤ {c5['sueno_max']}", form.v15_calidad_sueno <= c5["sueno_max"]),
        (f"Apoyo familiar ≤ {c5['apoyo_max']}", form.v13_apoyo_familiar <= c5["apoyo_max"]),
        (f"Actividad física = {c5['actividad_igual']}", form.v14_actividad_fisica == c5["actividad_igual"]),
        (f"WHO-5 < {c5['who5_menor_pct']} %", pct < c5["who5_menor_pct"]),
    ]
    cumplidos = [nombre for nombre, ok in marcadores if ok]
    r5 = len(cumplidos) >= c5["min_marcadores"]
    r5_detalle = f"{len(cumplidos)} de {len(marcadores)} marcadores: {', '.join(cumplidos) or 'ninguno'}"

    # Regla de seguridad — reporte del profesional
    alertas = form.alertas_profesional
    reportes = [
        texto
        for texto, activo in (
            ("riesgo suicida", alertas.riesgo_suicida),
            ("deterioro clínico agudo", alertas.deterioro_agudo),
            ("riesgo clínico urgente", alertas.riesgo_urgente),
        )
        if activo
    ]
    seg = bool(reportes)

    resultados = [
        {"code": "R1", "name": "Ítem 21 DASS-21 (Riesgo Suicida)", "triggered": r1, "detail": r1_detalle},
        {"code": "R2", "name": "Subescala Severa/Extrema", "triggered": bool(severas), "detail": r2_detalle},
        {"code": "R3", "name": "WHO-5 ≤ 28% (Probable Depresión)", "triggered": r3, "detail": r3_detalle},
        {"code": "R4", "name": "Co-ocurrencia de Malestar", "triggered": r4, "detail": r4_detalle},
        {"code": "R5", "name": "Marcadores de Vulnerabilidad Acumulada", "triggered": r5, "detail": r5_detalle},
        {
            "code": "SEG",
            "name": "Seguridad (reporte del profesional)",
            "triggered": seg,
            "detail": f"Reportado: {', '.join(reportes)}" if seg else "Sin alertas reportadas por el profesional",
        },
    ]
    activadas = [r for r in resultados if r["triggered"]]
    return {
        "outcomes": resultados,
        "triggered": deepcopy(activadas),
        "escalates": bool(activadas),
        "locked": seg,
        "suicideAlert": r1,
        "scores": puntajes,
        "levels": niveles,
        "who5Total": who5,
        "who5Percent": pct,
    }


def resolver_ruta(ruta_base: str, reglas: dict) -> tuple[str, bool]:
    """Ruta sugerida por el sistema: cualquier regla disparada fuerza Ruta A. Devuelve (ruta, escalada)."""
    if reglas["escalates"]:
        return "A", ruta_base == "B"
    return ruta_base, False
