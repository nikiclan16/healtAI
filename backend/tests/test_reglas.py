"""Tabla de verdad del motor de reglas. Espejo de frontend/src/rules/engine.test.ts."""

import pytest

from app.reglas.motor_reglas import evaluar_reglas, nivel_dass, resolver_ruta
from app.schemas_clinicos import ScreeningFormIn
from tests.conftest import ANEXO_E

# Perfil sin riesgo: ninguna regla se dispara.
SANO = ANEXO_E | {
    "v13_apoyo_familiar": 5, "v14_actividad_fisica": 3, "v15_calidad_sueno": 5, "who5_total": 20,
    "dass_depresion": 0, "dass_ansiedad": 0, "dass_estres": 0, "dass_item21": 0,
}


def codigos(**over):
    datos = SANO | over
    return [r["code"] for r in evaluar_reglas(ScreeningFormIn(**datos))["triggered"]]


@pytest.mark.parametrize(
    "escala, puntaje, nivel",
    [
        ("depresion", 4, "normal"), ("depresion", 5, "leve"), ("depresion", 7, "moderado"),
        ("depresion", 11, "severo"), ("depresion", 14, "extremo"),
        ("ansiedad", 3, "normal"), ("ansiedad", 8, "severo"), ("ansiedad", 10, "extremo"),
        ("estres", 12, "moderado"), ("estres", 13, "severo"), ("estres", 17, "extremo"),
    ],
)
def test_cortes_dass(escala, puntaje, nivel):
    assert nivel_dass(escala, puntaje) == nivel


def test_perfil_sin_riesgo_no_dispara_reglas():
    r = evaluar_reglas(ScreeningFormIn(**SANO))
    assert r["triggered"] == [] and r["escalates"] is False and r["locked"] is False


@pytest.mark.parametrize("item21", [2, 3])
def test_r1_item21_alto_activa_alerta_suicida(item21):
    r = evaluar_reglas(ScreeningFormIn(**(SANO | {"dass_item21": item21})))
    assert "R1" in [x["code"] for x in r["triggered"]] and r["suicideAlert"] is True


def test_r1_item21_igual_a_1_no_dispara():
    assert "R1" not in codigos(dass_item21=1)


def test_r1_item21_no_evaluable_dispara():
    r = evaluar_reglas(ScreeningFormIn(**(SANO | {"dass_item21": None})))
    assert "R1" in [x["code"] for x in r["triggered"]] and r["suicideAlert"] is True


def test_r2_ansiedad_severa_si_moderada_no():
    assert "R2" in codigos(dass_ansiedad=8)
    assert "R2" not in codigos(dass_ansiedad=7)


def test_r3_who5_7_si_8_no():
    assert "R3" in codigos(who5_total=7)
    assert "R3" not in codigos(who5_total=8)


def test_r4_dos_subescalas_moderadas():
    assert "R4" in codigos(dass_depresion=7, dass_ansiedad=6)
    assert "R4" not in codigos(dass_depresion=7)


def test_r5_dos_marcadores_no_tres_si():
    assert "R5" not in codigos(v15_calidad_sueno=2, v13_apoyo_familiar=2)
    assert "R5" in codigos(v15_calidad_sueno=2, v13_apoyo_familiar=2, v14_actividad_fisica=0)


@pytest.mark.parametrize("campo", ["riesgo_suicida", "deterioro_agudo", "riesgo_urgente"])
def test_regla_de_seguridad_bloquea_y_escala(campo):
    alertas = {"riesgo_suicida": False, "deterioro_agudo": False, "riesgo_urgente": False} | {campo: True}
    r = evaluar_reglas(ScreeningFormIn(**(SANO | {"alertas_profesional": alertas})))
    assert r["locked"] is True and r["escalates"] is True
    assert [x["code"] for x in r["triggered"]] == ["SEG"]


def test_caso_anexo_e_dispara_r2_r4_r5():
    r = evaluar_reglas(ScreeningFormIn(**ANEXO_E))
    assert [x["code"] for x in r["triggered"]] == ["R2", "R4", "R5"]
    assert r["who5Percent"] == 32 and r["scores"] == {"depresion": 9, "ansiedad": 8, "estres": 12}


def test_resolver_ruta():
    assert resolver_ruta("B", {"escalates": True}) == ("A", True)
    assert resolver_ruta("A", {"escalates": True}) == ("A", False)
    assert resolver_ruta("B", {"escalates": False}) == ("B", False)


def test_la_salida_usa_el_formato_que_consume_el_frontend():
    r = evaluar_reglas(ScreeningFormIn(**ANEXO_E))
    assert {"outcomes", "triggered", "escalates", "locked", "suicideAlert", "scores", "levels", "who5Total", "who5Percent"} <= set(r)
    assert {"code", "name", "triggered", "detail"} == set(r["outcomes"][0])
