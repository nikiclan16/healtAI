import json
import math

import pytest

from app.modelo.artifact import Artefacto, ModeloNoDisponible, cargar_artefacto
from app.modelo.component import ComponenteEstratificacionSaludMental
from app.modelo.features import FEATURES
from app.schemas_clinicos import ScreeningFormIn
from app.servicios.evaluacion import entrada_del_modelo
from tests.conftest import ANEXO_E

PLACEHOLDER = "model_artifacts/model.placeholder.json"


def artefacto(**over):
    base = dict(
        version="t1", features=("hipertension", "who5_total"), pesos=(1.0, -0.5), intercepto=0.2,
        media=(0.0, 10.0), escala=(1.0, 5.0), umbral=0.5, placeholder=False, etiquetas={},
    )
    return Artefacto(**(base | over))


def escribir(tmp_path, **over):
    data = {
        "version": "v9", "umbral": 0.5, "intercepto": 0.1, "features": ["hipertension", "who5_total"],
        "pesos": [1.0, -0.5], "media": [0.0, 10.0], "escala": [1.0, 5.0],
    } | over
    path = tmp_path / "m.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return str(path)


# ── Artefacto ───────────────────────────────────────────────────────────────────

def test_carga_un_artefacto_valido(tmp_path):
    art = cargar_artefacto(escribir(tmp_path))
    assert art.version == "v9" and art.features == ("hipertension", "who5_total")


def test_el_modelo_de_prueba_exige_permiso_explicito():
    with pytest.raises(ModeloNoDisponible, match="placeholder"):
        cargar_artefacto(PLACEHOLDER, permitir_placeholder=False)
    assert cargar_artefacto(PLACEHOLDER, permitir_placeholder=True).placeholder is True


@pytest.mark.parametrize(
    "over, mensaje",
    [
        ({"features": ["hipertension", "inventada"]}, "desconocidas"),
        ({"features": ["hipertension", "hipertension"], "pesos": [1, 1], "media": [0, 0], "escala": [1, 1]}, "repite"),
        ({"pesos": [1.0]}, "se esperaban 2"),
        ({"escala": [1.0, 0.0]}, "no puede ser 0"),
        ({"intercepto": "x"}, "intercepto"),
        ({"umbral": 1.5}, "umbral"),
        ({"version": ""}, "version"),
        ({"media": [0.0, float("nan")]}, "números finitos"),
    ],
)
def test_rechaza_artefactos_invalidos(tmp_path, over, mensaje):
    with pytest.raises(ModeloNoDisponible, match=mensaje):
        cargar_artefacto(escribir(tmp_path, **over))


def test_artefacto_inexistente_o_corrupto(tmp_path):
    with pytest.raises(ModeloNoDisponible, match="No existe"):
        cargar_artefacto(str(tmp_path / "no.json"))
    roto = tmp_path / "roto.json"
    roto.write_text("{ no es json", encoding="utf-8")
    with pytest.raises(ModeloNoDisponible, match="no se pudo leer"):
        cargar_artefacto(str(roto))


def test_el_catalogo_no_incluye_riesgo_de_amputacion_ni_apoyo_familiar():
    nombres = " ".join(FEATURES).lower()
    assert not any(x in nombres for x in ("ada", "iwgdf", "amputacion", "riesgo", "apoyo"))


# ── Componente ──────────────────────────────────────────────────────────────────

def test_predecir_calcula_logit_y_probabilidad():
    comp = ComponenteEstratificacionSaludMental(artefacto())
    r = comp.predecir({"hipertension": 1, "who5_total": 5})
    # x = [1, -1] → logit = 1*1 + (-0.5)*(-1) + 0.2 = 1.7
    assert r["logit"] == pytest.approx(1.7)
    assert r["probabilidad_ra"] == round(1 / (1 + math.exp(-1.7)), 4)
    assert r["ruta_base_modelo"] == "A"


def test_el_umbral_define_la_ruta():
    comp = ComponenteEstratificacionSaludMental(artefacto(umbral=0.9))
    assert comp.predecir({"hipertension": 1, "who5_total": 5})["ruta_base_modelo"] == "B"


def test_shap_lineal_es_aditivo():
    comp = ComponenteEstratificacionSaludMental(artefacto())
    datos = {"hipertension": 1, "who5_total": 5}
    suma = sum(f["valor"] for f in comp.explicar(datos, top=2))
    assert suma + comp.intercept == pytest.approx(comp.predecir(datos)["logit"], abs=1e-3)


def test_shap_ordena_por_magnitud_e_indica_direccion():
    comp = ComponenteEstratificacionSaludMental(
        artefacto(features=("hipertension", "who5_total"), pesos=(0.1, -2.0), media=(0.0, 10.0), escala=(1.0, 5.0))
    )
    top = comp.explicar({"hipertension": 1, "who5_total": 20}, top=2)
    assert [f["variable"] for f in top] == ["who5_total", "hipertension"]
    assert top[0]["direccion"] == "protector" and top[1]["direccion"] == "riesgo"
    assert top[0]["etiqueta"] == "Bienestar WHO-5"


def test_faltan_variables():
    comp = ComponenteEstratificacionSaludMental(artefacto())
    with pytest.raises(ValueError, match="who5_total"):
        comp.predecir({"hipertension": 1})


def test_modelo_de_prueba_con_el_caso_anexo_e():
    comp = ComponenteEstratificacionSaludMental(cargar_artefacto(PLACEHOLDER, permitir_placeholder=True))
    entrada = entrada_del_modelo(comp, ScreeningFormIn(**ANEXO_E))
    assert set(entrada) == {"hipertension", "actividad_fisica", "calidad_sueno", "who5_total", "tiempo_dm2"}
    r = comp.predecir(entrada)
    assert r["probabilidad_ra"] == pytest.approx(0.5319, abs=1e-3)
    assert r["ruta_base_modelo"] == "A"
    assert [f["variable"] for f in comp.explicar(entrada)] == ["hipertension", "actividad_fisica", "who5_total"]
