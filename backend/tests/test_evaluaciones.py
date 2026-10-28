import re

from sqlalchemy import text

from app.main import app
from app.modelo.registro import get_modelo
from tests.conftest import ANEXO_E, clinical_headers, make_user, scalar

EVA = "eva@prueba.com"
OTRA = "otra@prueba.com"


def crear(client, headers, form=ANEXO_E):
    return client.post("/evaluaciones", json=form, headers=headers)


def con_evaluador(client, db, email=EVA, **kw):
    make_user(db, email, **kw)
    return clinical_headers(client, email)


# ── /predecir ───────────────────────────────────────────────────────────────────

def test_predecir_devuelve_prediccion_pura(client, db):
    h = con_evaluador(client, db)
    res = client.post("/predecir", json=ANEXO_E, headers=h)
    assert res.status_code == 200
    p = res.json()
    assert p["rutaBase"] == "A" and 0.52 < p["probabilidadRA"] < 0.54
    assert len(p["shapTop3"]) == 3 and p["confianza"] is None and p["modeloPlaceholder"] is True
    assert scalar(db, "SELECT count(*) FROM evaluations") == 0  # no guarda nada


def test_predecir_exige_sesion_clinica(client, admin_headers):
    assert client.post("/predecir", json=ANEXO_E).status_code == 401
    assert client.post("/predecir", json=ANEXO_E, headers=admin_headers).status_code == 401


def test_sin_modelo_responde_503_y_no_inventa_nada(client, db):
    from fastapi import HTTPException

    def sin_modelo():
        raise HTTPException(503, "Modelo no disponible: prueba")

    h = con_evaluador(client, db)
    app.dependency_overrides[get_modelo] = sin_modelo
    try:
        assert client.post("/predecir", json=ANEXO_E, headers=h).status_code == 503
        assert crear(client, h).status_code == 503
    finally:
        app.dependency_overrides.pop(get_modelo, None)
    assert scalar(db, "SELECT count(*) FROM evaluations") == 0


# ── Contrato de datos (HTTP 422) ────────────────────────────────────────────────

def test_valores_fuera_de_rango_son_422(client, db):
    h = con_evaluador(client, db)
    for campo, valor in [
        ("v8_tiempo_diagnostico", 81), ("v12_percepcion_salud", 0), ("v14_actividad_fisica", 4),
        ("who5_total", 26), ("dass_ansiedad", 22), ("dass_item21", 4), ("v9_tratamiento", "otro"),
    ]:
        assert crear(client, h, ANEXO_E | {campo: valor}).status_code == 422, campo


def test_el_item21_nulo_es_valido_y_activa_r1(client, db):
    h = con_evaluador(client, db)
    res = crear(client, h, ANEXO_E | {"dass_item21": None})
    assert res.status_code == 201 and res.json()["reglas"]["suicideAlert"] is True


def test_campos_no_definidos_se_rechazan_riesgo_de_amputacion_e_identificadores(client, db):
    h = con_evaluador(client, db)
    assert crear(client, h, ANEXO_E | {"nivel_riesgo_amputacion": 3}).status_code == 422
    assert crear(client, h, ANEXO_E | {"cedula": "123456789"}).status_code == 422
    assert crear(client, h, ANEXO_E | {"codigo_paciente": "PAC-1"}).status_code == 422
    faltante = {k: v for k, v in ANEXO_E.items() if k != "who5_total"}
    assert crear(client, h, faltante).status_code == 422


# ── Crear y consultar evaluaciones ──────────────────────────────────────────────

def test_crear_evaluacion_anexo_e(client, db):
    h = con_evaluador(client, db)
    res = crear(client, h)
    assert res.status_code == 201
    ev = res.json()
    assert re.fullmatch(r"PAC-\d{4}-\d{4}", ev["codigoPaciente"])
    assert ev["sede"] == "BAQ" and ev["profesional"]["nombre"].startswith("Usuario eva")
    assert ev["rutaSistema"] == "A" and ev["escalada"] is False
    assert [r["code"] for r in ev["reglas"]["triggered"]] == ["R2", "R4", "R5"]
    assert ev["versiones"] == {"app": "0.1.0", "modelo": "v1.0.0-placeholder", "diccionario": "v2.1"}
    assert "decision" not in ev
    # Lo que se guardó es lo que se envió; nada identificable ni ADA.
    assert ev["formulario"]["who5_total"] == 8 and "nivel_riesgo_amputacion" not in ev["formulario"]
    assert set(ev["entrada"]) == {"hipertension", "actividad_fisica", "calidad_sueno", "who5_total", "tiempo_dm2"}


def test_una_regla_escala_de_ruta_b_a_ruta_a(client, db):
    h = con_evaluador(client, db)
    sano = ANEXO_E | {
        "v11": {"hipertension": False, "cardiaca": False, "obesidad": False, "otra": False},
        "v13_apoyo_familiar": 5, "v14_actividad_fisica": 3, "v15_calidad_sueno": 5, "who5_total": 20,
        "dass_depresion": 0, "dass_ansiedad": 0, "dass_estres": 0, "dass_item21": 3,
    }
    ev = crear(client, h, sano).json()
    assert ev["prediccion"]["rutaBase"] == "B"
    assert ev["rutaSistema"] == "A" and ev["escalada"] is True  # R1 (ítem 21 ≥ 2)


def test_codigos_consecutivos(client, db):
    h = con_evaluador(client, db)
    a, b = crear(client, h).json()["codigoPaciente"], crear(client, h).json()["codigoPaciente"]
    assert int(b[-4:]) == int(a[-4:]) + 1


def test_la_sede_viene_de_la_sesion_y_debe_seguir_autorizada(client, db):
    make_user(db, EVA, sedes=("BAQ", "RHA"))
    h = clinical_headers(client, EVA, sede="RHA")
    assert crear(client, h).json()["sede"] == "RHA"
    db.execute(text("DELETE FROM user_sites WHERE site_code = 'RHA'"))  # el admin le quita la sede
    assert crear(client, h).status_code == 403


def test_el_investigador_no_registra_evaluaciones(client, db):
    make_user(db, "inv@prueba.com", rol="investigador", cargos=("investigador",))
    h = clinical_headers(client, "inv@prueba.com", cargo="investigador")
    assert crear(client, h).status_code == 403


def test_cada_evaluador_ve_solo_las_suyas_y_el_investigador_todas(client, db):
    h1 = con_evaluador(client, db, EVA)
    h2 = con_evaluador(client, db, OTRA)
    make_user(db, "inv@prueba.com", rol="investigador", cargos=("investigador",))
    hi = clinical_headers(client, "inv@prueba.com", cargo="investigador")

    mia = crear(client, h1).json()
    crear(client, h2)

    propias = client.get("/evaluaciones", headers=h1).json()
    assert [e["id"] for e in propias] == [mia["id"]]
    assert client.get(f"/evaluaciones/{mia['id']}", headers=h1).status_code == 200
    assert client.get(f"/evaluaciones/{mia['id']}", headers=h2).status_code == 404
    assert len(client.get("/evaluaciones", headers=hi).json()) == 2
    assert client.get(f"/evaluaciones/{mia['id']}", headers=hi).status_code == 200


def test_la_inferencia_queda_en_la_bitacora_sin_datos_clinicos(client, db):
    h = con_evaluador(client, db)
    ev = crear(client, h).json()
    detalle = db.execute(
        text("SELECT detalle FROM audit_log WHERE evento = 'inferencia' AND evaluation_id = :e"), {"e": ev["id"]}
    ).scalar_one()
    assert detalle["modelo"] == "v1.0.0-placeholder" and detalle["reglas"] == ["R2", "R4", "R5"]
    assert "formulario" not in detalle and "who5_total" not in str(detalle)
    assert scalar(db, "SELECT verify_audit_chain() IS NULL") is True


# ── Decisión humana ─────────────────────────────────────────────────────────────

def decidir(client, h, ev_id, **body):
    return client.post(f"/evaluaciones/{ev_id}/decision", json=body, headers=h)


def test_confirmar_la_ruta_sugerida(client, db):
    h = con_evaluador(client, db)
    ev = crear(client, h).json()
    res = decidir(client, h, ev["id"], accion="confirmar", rutaFinal="A", justificacion="")
    assert res.status_code == 201
    d = res.json()["decision"]
    assert d["accion"] == "confirmar" and d["rutaFinal"] == "A" and d["profesionalId"] == ev["profesional"]["id"]
    assert client.get(f"/evaluaciones/{ev['id']}", headers=h).json()["decision"]["rutaFinal"] == "A"
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'decision' AND evaluation_id = :i", i=ev["id"]) == 1


def test_solo_una_decision_por_evaluacion(client, db):
    h = con_evaluador(client, db)
    ev = crear(client, h).json()
    assert decidir(client, h, ev["id"], accion="confirmar", rutaFinal="A").status_code == 201
    assert decidir(client, h, ev["id"], accion="confirmar", rutaFinal="A").status_code == 409


def test_diferir_de_la_ruta_exige_justificacion(client, db):
    h = con_evaluador(client, db)
    # Evaluación sin reglas disparadas → ruta B (no bloqueada)
    sano = ANEXO_E | {
        "v11": {"hipertension": False, "cardiaca": False, "obesidad": False, "otra": False},
        "v13_apoyo_familiar": 5, "v14_actividad_fisica": 3, "v15_calidad_sueno": 5, "who5_total": 20,
        "dass_depresion": 0, "dass_ansiedad": 0, "dass_estres": 0, "dass_item21": 0,
    }
    ev = crear(client, h, sano).json()
    assert ev["rutaSistema"] == "B"
    corta = decidir(client, h, ev["id"], accion="rechazar", rutaFinal="A", justificacion="corta")
    assert corta.status_code == 422 and "justificación" in corta.json()["detail"]
    ok = decidir(client, h, ev["id"], accion="rechazar", rutaFinal="A", justificacion="Paciente refiere alta angustia")
    assert ok.status_code == 201


def test_confirmar_con_otra_ruta_es_invalido(client, db):
    h = con_evaluador(client, db)
    ev = crear(client, h).json()
    res = decidir(client, h, ev["id"], accion="confirmar", rutaFinal="B", justificacion="x" * 20)
    assert res.status_code == 422


def test_la_regla_de_seguridad_no_se_puede_degradar_a_ruta_b(client, db):
    h = con_evaluador(client, db)
    ev = crear(client, h, ANEXO_E | {"alertas_profesional": {"riesgo_suicida": True, "deterioro_agudo": False, "riesgo_urgente": False}}).json()
    assert ev["reglas"]["locked"] is True
    res = decidir(client, h, ev["id"], accion="rechazar", rutaFinal="B", justificacion="Justificación clínica larga")
    assert res.status_code == 422 and "seguridad" in res.json()["detail"].lower()
    assert "decision" not in client.get(f"/evaluaciones/{ev['id']}", headers=h).json()


def test_otro_profesional_no_puede_decidir_sobre_una_evaluacion_ajena(client, db):
    h1 = con_evaluador(client, db, EVA)
    h2 = con_evaluador(client, db, OTRA)
    ev = crear(client, h1).json()
    assert decidir(client, h2, ev["id"], accion="confirmar", rutaFinal="A").status_code == 404


def test_las_evaluaciones_son_inmutables(client, db):
    import pytest
    from sqlalchemy.exc import DBAPIError

    h = con_evaluador(client, db)
    crear(client, h)
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE evaluations SET escalada = TRUE"))
    db.rollback()


# ── Salud ───────────────────────────────────────────────────────────────────────

def test_salud_informa_el_estado_del_modelo(client):
    data = client.get("/salud").json()
    assert data["status"] == "ok" and data["modelo"]["estado"] == "ok" and data["modelo"]["placeholder"] is True
    assert data["version_modelo"] == "v1.0.0-placeholder"
