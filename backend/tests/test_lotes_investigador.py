import io

from openpyxl import Workbook
from sqlalchemy import text

from app.servicios.lote import COLUMNAS, PLANTILLA

from .conftest import ANEXO_E, PASSWORD, clinical_headers, make_user, scalar

CABECERA = PLANTILLA[0]
FILA_ANEXO_E = PLANTILLA[1]  # el caso del Anexo E: reglas R2, R4 y R5, ruta A


def csv_bytes(*lineas: str) -> bytes:
    return ("\n".join(lineas) + "\n").encode()


def subir(client, headers, contenido: bytes, nombre="lote.csv"):
    return client.post("/lotes", headers=headers, files={"archivo": (nombre, contenido, "text/csv")})


def evaluador(client, db, email="lote@prueba.com"):
    make_user(db, email, rol="evaluador")
    return clinical_headers(client, email)


# ── Carga por lotes ─────────────────────────────────────────────────────────────

def test_lote_procesa_filas_y_resume(client, db):
    h = evaluador(client, db)
    res = subir(client, h, csv_bytes(CABECERA, FILA_ANEXO_E, FILA_ANEXO_E))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["resumen"]["filas"] == 2 and body["resumen"]["procesadas"] == 2 and body["resumen"]["conError"] == 0
    r = body["resultados"][0]
    assert r["ok"] and r["fila"] == 2 and r["reglas"] == ["R2", "R4", "R5"] and r["rutaSistema"] == "A"
    assert len(r["shapTop3"]) == 3
    assert len(body["sha256"]) == 64 and body["modeloPlaceholder"] is True
    assert body["resumen"]["finalA"] == 2


def test_lote_no_persiste_evaluaciones_pero_si_audita(client, db):
    h = evaluador(client, db)
    antes = scalar(db, "SELECT count(*) FROM evaluations")
    subir(client, h, csv_bytes(CABECERA, FILA_ANEXO_E))
    assert scalar(db, "SELECT count(*) FROM evaluations") == antes
    detalle = db.execute(text("SELECT detalle FROM audit_log WHERE evento = 'lote' ORDER BY id DESC LIMIT 1")).scalar_one()
    assert detalle["procesadas"] == 1 and len(detalle["sha256"]) == 64


def test_lote_acepta_punto_y_coma_y_decimales_de_excel(client, db):
    h = evaluador(client, db)
    fila = FILA_ANEXO_E.replace(",", ";").replace("10;orales", "10.0;orales")
    res = subir(client, h, csv_bytes(CABECERA.replace(",", ";"), fila))
    assert res.status_code == 200 and res.json()["resumen"]["procesadas"] == 1


def test_lote_item21_vacio_activa_r1(client, db):
    h = evaluador(client, db)
    campos = FILA_ANEXO_E.split(",")
    campos[list(COLUMNAS).index("dass_item21")] = ""
    res = subir(client, h, csv_bytes(CABECERA, ",".join(campos)))
    assert "R1" in res.json()["resultados"][0]["reglas"]


def test_lote_errores_por_fila_no_detienen_el_resto(client, db):
    h = evaluador(client, db)
    campos = FILA_ANEXO_E.split(",")
    campos[list(COLUMNAS).index("dass_ansiedad")] = "99"
    malo = ",".join(campos)
    res = subir(client, h, csv_bytes(CABECERA, FILA_ANEXO_E, malo))
    body = res.json()
    assert body["resumen"]["procesadas"] == 1 and body["resumen"]["conError"] == 1
    error = body["resultados"][1]
    assert error["ok"] is False and error["fila"] == 3
    assert error["error"] == "dass_ansiedad: debe ser como máximo 21"


def test_lote_rechaza_columnas_desconocidas_como_identificadores(client, db):
    h = evaluador(client, db)
    res = subir(client, h, csv_bytes(CABECERA + ",cedula", FILA_ANEXO_E + ",123"))
    assert res.status_code == 422 and "cedula" in res.json()["detail"]
    res = subir(client, h, csv_bytes(CABECERA + ",riesgo_ada", FILA_ANEXO_E + ",alto"))
    assert res.status_code == 422


def test_lote_exige_columnas_obligatorias(client, db):
    h = evaluador(client, db)
    cabecera = ",".join(c for c in COLUMNAS if c != "who5_total")
    res = subir(client, h, csv_bytes(cabecera, "1"))
    assert res.status_code == 422 and "who5_total" in res.json()["detail"]


def test_lote_alertas_son_opcionales_y_fuerzan_ruta_a(client, db):
    h = evaluador(client, db)
    base = [c for c in COLUMNAS if not c.startswith("alerta_")]
    campos = FILA_ANEXO_E.split(",")[: len(base)]
    # Perfil de bajo riesgo + alerta de riesgo suicida => la regla de seguridad fuerza Ruta A.
    bajo = dict(zip(COLUMNAS, FILA_ANEXO_E.split(",")))
    bajo.update(who5_total="22", dass_depresion="0", dass_ansiedad="0", dass_estres="0", dass_item21="0",
                v14_actividad_fisica="3", v15_calidad_sueno="5", v13_apoyo_familiar="5")
    sin_alertas = ",".join(bajo[c] for c in base)
    res = subir(client, h, csv_bytes(",".join(base), sin_alertas))
    assert res.status_code == 200 and res.json()["resultados"][0]["ok"], res.text
    assert "SEG" not in res.json()["resultados"][0]["reglas"]
    con_alerta = ",".join(bajo[c] for c in base) + ",1"
    res = subir(client, h, csv_bytes(",".join(base) + ",alerta_riesgo_suicida", con_alerta))
    fila = res.json()["resultados"][0]
    assert "SEG" in fila["reglas"] and fila["rutaSistema"] == "A"
    assert len(campos) == len(base)


def test_lote_xlsx(client, db):
    h = evaluador(client, db)
    wb = Workbook()
    ws = wb.active
    ws.append(CABECERA.split(","))
    ws.append([int(x) if x.lstrip("-").isdigit() else x for x in FILA_ANEXO_E.split(",")])
    buf = io.BytesIO()
    wb.save(buf)
    res = client.post(
        "/lotes",
        headers=h,
        files={"archivo": ("lote.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 200 and res.json()["resumen"]["procesadas"] == 1, res.text


def test_lote_formato_tamano_y_vacio(client, db):
    h = evaluador(client, db)
    assert subir(client, h, b"x", "lote.pdf").status_code == 415
    assert subir(client, h, b"", "lote.csv").status_code == 422
    grande = csv_bytes(CABECERA, *([FILA_ANEXO_E] * 2001))
    assert subir(client, h, grande).status_code == 413


def test_lote_exige_sesion_clinica(client, db):
    assert client.post("/lotes", files={"archivo": ("a.csv", b"x", "text/csv")}).status_code == 401
    assert client.get("/lotes/plantilla").status_code == 401


def test_plantilla_descargable_y_valida(client, db):
    h = evaluador(client, db)
    res = client.get("/lotes/plantilla", headers=h)
    assert res.status_code == 200 and res.text.splitlines()[0] == CABECERA
    # La plantilla debe poder subirse tal cual.
    assert subir(client, h, res.content).json()["resumen"]["procesadas"] == 1


# ── Panel del investigador ──────────────────────────────────────────────────────

def investigador(client, db):
    make_user(db, "inv@prueba.com", rol="investigador", cargos=("investigador",), sedes=("BAQ", "RHA", "VUP"))
    return clinical_headers(client, "inv@prueba.com", cargo="investigador")


def crear_evaluacion(client, headers):
    res = client.post("/evaluaciones", headers=headers, json=ANEXO_E)
    assert res.status_code == 201, res.text
    return res.json()


def test_metricas_solo_para_investigadores(client, db):
    h = evaluador(client, db)
    assert client.get("/investigador/metricas", headers=h).status_code == 403
    assert client.get("/investigador/metricas").status_code == 401


def test_metricas_cuentan_evaluaciones_decisiones_y_concordancia(client, db):
    inv = investigador(client, db)
    base = client.get("/investigador/metricas", headers=inv).json()

    h = evaluador(client, db)
    a = crear_evaluacion(client, h)
    b = crear_evaluacion(client, h)
    client.post(f"/evaluaciones/{a['id']}/decision", headers=h, json={"accion": "confirmar", "rutaFinal": a["rutaSistema"]})
    client.post(
        f"/evaluaciones/{b['id']}/decision",
        headers=h,
        json={"accion": "ajustar", "rutaFinal": "B", "justificacion": "Criterio clínico del profesional"},
    )

    m = client.get("/investigador/metricas", headers=inv).json()
    assert m["totales"]["evaluaciones"] == base["totales"]["evaluaciones"] + 2
    assert m["totales"]["decisiones"] == base["totales"]["decisiones"] + 2
    baq = next(s for s in m["sedes"] if s["sede"] == "BAQ")
    assert baq["evaluaciones"] >= 2 and baq["decisiones"] >= 2
    assert {"R2", "R4", "R5"} <= set(m["reglas"])
    assert m["conceptDrift"]["ventana"] == 50 and m["conceptDrift"]["decisiones"] >= 2
    assert m["dataDrift"]["disponible"] is False
    assert m["auditoria"]["integra"] is True


def test_exportaciones_csv_registran_auditoria(client, db):
    inv = investigador(client, db)
    h = evaluador(client, db)
    crear_evaluacion(client, h)

    ev = client.get("/investigador/evaluaciones.csv", headers=inv)
    assert ev.status_code == 200 and "text/csv" in ev.headers["content-type"]
    lineas = ev.text.lstrip("﻿").splitlines()
    assert lineas[0].startswith("fecha,codigo_paciente,sede") and "who5_total" in lineas[0]
    assert any("PAC-" in linea for linea in lineas[1:])

    au = client.get("/investigador/auditoria.csv", headers=inv)
    assert au.status_code == 200 and "inferencia" in au.text
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'exportacion'") >= 2

    assert client.get("/investigador/evaluaciones.csv", headers=h).status_code == 403


# ── Cambio de contraseña ────────────────────────────────────────────────────────

NUEVA = "Otra-clave-segura-2"


def test_usuario_cambia_su_contrasena(client, db):
    make_user(db, "cambio@prueba.com")
    h = clinical_headers(client, "cambio@prueba.com")
    res = client.post("/auth/cambiar-password", headers=h, json={"actual": PASSWORD, "nueva": NUEVA})
    assert res.status_code == 204
    login = client.post("/auth/login", json={"usuario": "cambio@prueba.com", "password": NUEVA, "cargo": "medico", "sede": "BAQ"})
    assert login.status_code == 200
    viejo = client.post("/auth/login", json={"usuario": "cambio@prueba.com", "password": PASSWORD, "cargo": "medico", "sede": "BAQ"})
    assert viejo.status_code == 401
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'cambio_password'") >= 1


def test_cambio_de_contrasena_valida_la_actual_y_la_politica(client, db):
    make_user(db, "cambio2@prueba.com")
    h = clinical_headers(client, "cambio2@prueba.com")
    assert client.post("/auth/cambiar-password", headers=h, json={"actual": "incorrecta-123", "nueva": NUEVA}).status_code == 400
    assert client.post("/auth/cambiar-password", headers=h, json={"actual": PASSWORD, "nueva": PASSWORD}).status_code == 400
    assert client.post("/auth/cambiar-password", headers=h, json={"actual": PASSWORD, "nueva": "corta1"}).status_code == 422
    assert client.post("/auth/cambiar-password", json={"actual": PASSWORD, "nueva": NUEVA}).status_code == 401


def test_contrasena_temporal_obliga_a_cambiarla_antes_de_operar(client, db, admin_headers):
    res = client.post(
        "/admin/usuarios",
        headers=admin_headers,
        json={"email": "nuevo@prueba.com", "nombre": "Nuevo Usuario", "password": "Temporal-1234", "rol": "evaluador",
              "cargos": ["medico"], "sedes": ["BAQ"]},
    )
    assert res.status_code == 201 and res.json()["debe_cambiar_password"] is True

    login = client.post("/auth/login", json={"usuario": "nuevo@prueba.com", "password": "Temporal-1234", "cargo": "medico", "sede": "BAQ"})
    assert login.status_code == 200 and login.json()["debe_cambiar_password"] is True
    h = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Mientras sea temporal, el servidor bloquea cualquier operación clínica.
    bloqueado = client.post("/evaluaciones", headers=h, json=ANEXO_E)
    assert bloqueado.status_code == 403 and "contraseña" in bloqueado.json()["detail"]
    assert client.get("/evaluaciones", headers=h).status_code == 403

    assert client.post("/auth/cambiar-password", headers=h, json={"actual": "Temporal-1234", "nueva": NUEVA}).status_code == 204
    assert client.post("/evaluaciones", headers=h, json=ANEXO_E).status_code == 201
    relogin = client.post("/auth/login", json={"usuario": "nuevo@prueba.com", "password": NUEVA, "cargo": "medico", "sede": "BAQ"})
    assert relogin.json()["debe_cambiar_password"] is False


def test_restablecer_contrasena_la_vuelve_temporal(client, db, admin_headers):
    uid = make_user(db, "reset@prueba.com")
    res = client.patch(f"/admin/usuarios/{uid}", headers=admin_headers, json={"password": "Temporal-5678"})
    assert res.status_code == 200 and res.json()["debe_cambiar_password"] is True


def test_administrador_cambia_su_propia_contrasena(client, db, admin_headers):
    res = client.post("/admin/cuenta/password", headers=admin_headers, json={"actual": PASSWORD, "nueva": NUEVA})
    assert res.status_code == 204
    assert client.post("/admin/auth/login", json={"usuario": "admin@prueba.com", "password": NUEVA}).status_code == 200
    assert client.post("/admin/cuenta/password", json={"actual": PASSWORD, "nueva": NUEVA}).status_code == 401
