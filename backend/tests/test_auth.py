from sqlalchemy import text

from tests.conftest import PASSWORD, make_user, scalar

EMAIL = "eva@prueba.com"


def login(client, **over):
    body = {"usuario": EMAIL, "password": PASSWORD, "cargo": "medico", "sede": "BAQ"} | over
    return client.post("/auth/login", json=body)


def test_salud(client):
    res = client.get("/salud")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_login_ok_devuelve_token_y_rol_operativo(client, db):
    make_user(db, EMAIL)
    res = login(client)
    assert res.status_code == 200
    data = res.json()
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 8 * 3600
    assert data["usuario"]["rol"] == "evaluador"
    assert data["usuario"]["cargo"] == "medico"
    assert data["usuario"]["cargo_label"] == "Médico de Atención Primaria"
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'login' AND user_id = (SELECT id FROM users WHERE email = :e)", e=EMAIL) == 1


def test_login_es_insensible_a_mayusculas_en_el_correo(client, db):
    make_user(db, EMAIL)
    assert login(client, usuario=EMAIL.upper()).status_code == 200


def test_contrasena_incorrecta_cuenta_el_intento_y_audita(client, db):
    make_user(db, EMAIL)
    res = login(client, password="otra-clave-1")
    assert res.status_code == 401
    assert scalar(db, "SELECT failed_logins FROM users WHERE email = :e", e=EMAIL) == 1
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'login_fallido' AND user_id = (SELECT id FROM users WHERE email = :e)", e=EMAIL) == 1


def test_usuario_inexistente_da_el_mismo_error_que_contrasena_incorrecta(client, db):
    make_user(db, EMAIL)
    a = login(client, usuario="nadie@prueba.com")
    b = login(client, password="otra-clave-1")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_bloqueo_tras_cinco_intentos_fallidos(client, db):
    make_user(db, EMAIL)
    for _ in range(5):
        assert login(client, password="otra-clave-1").status_code == 401
    # Con la contraseña correcta sigue bloqueado.
    assert login(client).status_code == 423
    assert scalar(db, "SELECT count(*) FROM audit_log WHERE evento = 'cuenta_bloqueada' AND user_id = (SELECT id FROM users WHERE email = :e)", e=EMAIL) == 1


def test_rol_operativo_no_asignado_es_rechazado_por_el_servidor(client, db):
    make_user(db, EMAIL, cargos=("medico",))
    res = login(client, cargo="psicologo")
    assert res.status_code == 403
    assert "rol operativo" in res.json()["detail"]


def test_no_hay_autopromocion_a_investigador(client, db):
    make_user(db, EMAIL)
    assert login(client, cargo="investigador").status_code == 403


def test_sede_no_autorizada(client, db):
    make_user(db, EMAIL, sedes=("BAQ",))
    res = login(client, sede="RHA")
    assert res.status_code == 403
    assert "sede" in res.json()["detail"]


def test_rol_desactivado_no_permite_ingresar(client, db):
    make_user(db, EMAIL)
    db.execute(text("UPDATE cargos SET activo = FALSE WHERE code = 'medico'"))
    assert login(client).status_code == 403


def test_cuenta_desactivada(client, db):
    make_user(db, EMAIL, activo=False)
    res = login(client)
    assert res.status_code == 403
    assert "desactivada" in res.json()["detail"]


def test_el_admin_no_ingresa_por_el_acceso_clinico(client, db):
    make_user(db, "admin2@prueba.com", rol="admin", cargos=(), sedes=())
    res = login(client, usuario="admin2@prueba.com")
    assert res.status_code == 403


def test_un_evaluador_no_ingresa_por_el_acceso_de_administracion(client, db):
    make_user(db, EMAIL)
    res = client.post("/admin/auth/login", json={"usuario": EMAIL, "password": PASSWORD})
    assert res.status_code == 403


def test_cargos_publicos_solo_activos(client, db):
    db.execute(text("UPDATE cargos SET activo = FALSE WHERE code = 'enfermeria'"))
    codes = {c["code"] for c in client.get("/auth/cargos").json()}
    assert {"medico", "psicologo", "investigador"} <= codes
    assert "enfermeria" not in codes
