import io
from pathlib import Path

from openpyxl import Workbook, load_workbook
from sqlalchemy import text

from app.servicios.lote import COLUMNAS, PLANTILLA, _clasificar

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


def test_plantilla_csv_descargable(client, db):
    h = evaluador(client, db)
    res = client.get("/lotes/plantilla", headers=h)
    assert res.status_code == 200 and "text/csv" in res.headers["content-type"]
    assert res.text.lstrip("﻿").startswith("Sujeto,Nivel_de_Riesgo,Ruta_1,Ruta_2,V1_Edad")
    # Solo trae la cabecera: subirla tal cual avisa que faltan datos.
    sin_datos = subir(client, h, res.content)
    assert sin_datos.status_code == 422 and "filas de datos" in sin_datos.json()["detail"]


def test_plantilla_xlsx_descargable(client, db):
    h = evaluador(client, db)
    res = client.get("/lotes/plantilla?formato=xlsx", headers=h)
    assert res.status_code == 200 and "spreadsheetml" in res.headers["content-type"]
    libro = load_workbook(io.BytesIO(res.content))
    assert libro.sheetnames == ["Sistematizacion", "Diccionario_Codificacion"]
    assert client.get("/lotes/plantilla?formato=pdf", headers=h).status_code == 422


# ── Formato de sistematización (Formato.xlsx / Formato.csv) ─────────────────────

PLANTILLAS = Path(__file__).resolve().parents[1] / "app" / "plantillas"
# Anexo E en el formato de sistematización: mismos totales que FILA_ANEXO_E (WHO-5 = 8, DASS D/A/E = 9/8/12).
ITEMS = {
    "WHO5 - ": [2, 2, 1, 2, 1],
    "DASS21 - Dep": [1, 1, 2, 1, 2, 1, 1],  # el último es el ítem 21
    "DASS21 - Ans": [1, 1, 1, 2, 1, 1, 1],
    "DASS21 - Est": [2, 2, 2, 2, 1, 2, 1],
}


def cabecera_formato() -> list[str]:
    return (PLANTILLAS / "Formato_sistematizacion.csv").read_text(encoding="utf-8-sig").splitlines()[0].split(",")


def columna(prefijo: str, contiene: str = "") -> str:
    return next(c for c in cabecera_formato() if c.startswith(prefijo) and contiene in c)


def fila_formato(**cambios: str) -> list[str]:
    """Una fila válida del formato de sistematización; `cambios` sobrescribe por nombre de columna."""
    cab = cabecera_formato()
    valores = {c: "" for c in cab}
    valores.update({
        "Sujeto": "S01", "Nivel_de_Riesgo": "2", "Ruta_1": "A", "Ruta_2": "B", "V1_Edad": "58", "V2_Sexo": "2",
        "V3_EstadoCivil": "2", "V4_NivelEducativo": "3", "V5_SituacionLaboral": "1", "V6_Estrato": "3",
        "V8_TiempoDiagnosticoDM2": "10", "V9_Trat_DietaEjercicio": "0", "V9_Trat_Orales": "1", "V9_Trat_Insulina": "0",
        "V9_Trat_OralesInsulina": "0", "V9_Trat_Ninguno": "0", "V11_Enf_Ninguna": "0", "V11_Enf_Hipertension": "1",
        "V11_Enf_Cardiaca": "0", "V11_Enf_Obesidad": "0", "V11_Enf_Otra": "0", "V12_PercepcionSalud": "3",
        "V13_ApoyoFamiliar": "4", "V14_ActividadFisica": "0", "V15_CalidadSueno": "2",
    })
    for prefijo, items in ITEMS.items():
        for nombre, valor in zip([c for c in cab if c.startswith(prefijo)], items):
            valores[nombre] = str(valor)
    valores.update(cambios)
    return [valores[c] for c in cab]


def csv_formato(*filas: list[str], cabecera: list[str] | None = None) -> bytes:
    return csv_bytes(",".join(cabecera or cabecera_formato()), *(",".join(f) for f in filas))


def test_lote_formato_sistematizacion_procesa_y_descarta_columnas_no_clinicas(client, db):
    h = evaluador(client, db)
    res = subir(client, h, csv_formato(fila_formato()))
    assert res.status_code == 200, res.text
    body = res.json()
    r = body["resultados"][0]
    assert r["ok"] and r["fila"] == 2 and r["reglas"] == ["R2", "R4", "R5"] and r["rutaSistema"] == "A"
    # Lo que se descarta se informa, y no se devuelve el código del sujeto.
    assert {"Sujeto", "Nivel_de_Riesgo", "Ruta_1", "Ruta_2", "V1_Edad", "V6_Estrato"} <= set(body["columnasIgnoradas"])
    assert "S01" not in res.text
    # Mismo resultado que el formato corto con los mismos totales.
    corto = subir(client, h, csv_bytes(CABECERA, FILA_ANEXO_E)).json()["resultados"][0]
    assert r["probabilidadRA"] == corto["probabilidadRA"]


def test_nivel_de_riesgo_de_amputacion_no_influye_en_el_modelo(client, db):
    h = evaluador(client, db)
    res = subir(client, h, csv_formato(fila_formato(Nivel_de_Riesgo="0"), fila_formato(Nivel_de_Riesgo="4")))
    a, b = res.json()["resultados"]
    assert a["ok"] and a["probabilidadRA"] == b["probabilidadRA"] and a["shapTop3"] == b["shapTop3"]


def test_lote_formato_xlsx_usa_la_hoja_sistematizacion(client, db):
    h = evaluador(client, db)
    libro = load_workbook(PLANTILLAS / "Formato_sistematizacion.xlsx")
    libro["Sistematizacion"].append([int(x) if x.isdigit() else x for x in fila_formato()])
    buf = io.BytesIO()
    libro.save(buf)
    res = client.post(
        "/lotes",
        headers=h,
        files={"archivo": ("lote.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert res.status_code == 200, res.text
    assert res.json()["resumen"]["procesadas"] == 1 and res.json()["resultados"][0]["fila"] == 2


def test_lote_formato_csv_en_windows_1252(client, db):
    h = evaluador(client, db)
    contenido = csv_formato(fila_formato()).decode("utf-8").encode("cp1252")  # como lo guarda Excel en Windows
    res = subir(client, h, contenido)
    assert res.status_code == 200 and res.json()["resumen"]["procesadas"] == 1, res.text


def test_lote_formato_totales_se_calculan_o_se_verifican(client, db):
    h = evaluador(client, db)
    # Total con fórmula sin valor guardado (vacío): se calcula con los ítems.
    assert subir(client, h, csv_formato(fila_formato(Total_WHO5=""))).json()["resumen"]["procesadas"] == 1
    # Total digitado que no coincide con los ítems: error claro por fila.
    malo = subir(client, h, csv_formato(fila_formato(Total_WHO5="9"))).json()["resultados"][0]
    assert malo["ok"] is False and "Total_WHO5 (9) no coincide con la suma de los ítems (8)" in malo["error"]
    # Ítems vacíos pero con el total digitado: también se acepta.
    vacios = {c: "" for c in cabecera_formato() if c.startswith("WHO5 - ")}
    assert subir(client, h, csv_formato(fila_formato(Total_WHO5="8", **vacios))).json()["resumen"]["procesadas"] == 1


def test_lote_formato_item21_vacio_activa_r1(client, db):
    h = evaluador(client, db)
    item21 = columna("DASS21 - Dep", "tem 21")
    r = subir(client, h, csv_formato(fila_formato(**{item21: ""}))).json()["resultados"][0]
    assert r["ok"] and "R1" in r["reglas"] and r["rutaSistema"] == "A"


def test_lote_formato_valida_opciones_de_respuesta_multiple_y_rangos(client, db):
    h = evaluador(client, db)
    dos_tratamientos = subir(client, h, csv_formato(fila_formato(V9_Trat_Insulina="1"))).json()["resultados"][0]
    assert dos_tratamientos["error"] == "V9 (tratamiento): marque exactamente una opción"
    ninguna_y_otra = subir(client, h, csv_formato(fila_formato(V11_Enf_Ninguna="1"))).json()["resultados"][0]
    assert "«Ninguna» no puede marcarse junto con otra enfermedad" in ninguna_y_otra["error"]
    sin_marcar = subir(client, h, csv_formato(fila_formato(V11_Enf_Hipertension="0"))).json()["resultados"][0]
    assert "marque «Ninguna» o al menos una enfermedad" in sin_marcar["error"]
    fuera = subir(client, h, csv_formato(fila_formato(**{columna("DASS21 - Ans"): "4"}))).json()["resultados"][0]
    assert fuera["error"] == "DASS21 ansiedad ítem 2: debe estar entre 0 y 3"


def test_lote_formato_ignora_filas_vacias_y_totales_con_formula(client, db):
    h = evaluador(client, db)
    cab = cabecera_formato()
    solo_formulas = ["0" if c.startswith("Total_") or c == "Puntaje_WHO5_Pct" else "" for c in cab]
    contenido = csv_bytes(",".join(cab), ",".join(fila_formato()), "", ",".join(solo_formulas), ",".join(fila_formato()))
    body = subir(client, h, contenido).json()
    # La fila vacía y la que solo trae fórmulas no cuentan, pero los números de fila son los del archivo.
    assert [r["fila"] for r in body["resultados"]] == [2, 5]


def test_lote_formato_rechaza_columnas_desconocidas_y_pide_las_obligatorias(client, db):
    h = evaluador(client, db)
    res = subir(client, h, csv_formato(fila_formato() + ["123"], cabecera=cabecera_formato() + ["Cedula"]))
    assert res.status_code == 422 and "Cedula" in res.json()["detail"]
    cab = [c for c in cabecera_formato() if not c.startswith("WHO5 - ") and c != "Total_WHO5"]
    faltan = subir(client, h, csv_bytes(",".join(cab), "1"))
    assert faltan.status_code == 422 and "WHO-5" in faltan.json()["detail"]


def test_encabezados_con_codificacion_danada_se_reconocen():
    assert _clasificar("WHO5 - �tem 1: Me he sentido alegre") == "who5_i1"
    assert _clasificar("DASS21 - Depresi�n - �tem 21: Sent� que la vida") == "dass_item21"
    assert _clasificar("DASS21 - Estr�s - �tem 18: He tendido") == "est_i18"
    assert _clasificar("DASS21 - Depresión - Ítem 4: no existe") is None
    assert _clasificar("Nivel de Riesgo") == "~ignorada"


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
