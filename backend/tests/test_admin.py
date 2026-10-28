from sqlalchemy import text

from tests.conftest import PASSWORD, make_user, scalar

NEW_USER = {
    "email": "nuevo@prueba.com",
    "nombre": "Dra. Ana Gómez",
    "password": "Inicial-2026-ok",
    "rol": "evaluador",
    "cargos": ["psicologo"],
    "sedes": ["BAQ", "VUP"],
}


def login(client, email, password, cargo="psicologo", sede="BAQ"):
    return client.post("/auth/login", json={"usuario": email, "password": password, "cargo": cargo, "sede": sede})


# ── Acceso ──────────────────────────────────────────────────────────────────────

def test_sin_token_es_401(client):
    assert client.get("/admin/usuarios").status_code == 401


def test_token_clinico_no_sirve_en_administracion(client, db):
    make_user(db, "eva@prueba.com")
    token = login(client, "eva@prueba.com", PASSWORD, cargo="medico").json()["access_token"]
    res = client.get("/admin/usuarios", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_token_de_admin_no_sirve_como_token_clinico_pero_si_en_admin(client, admin_headers):
    assert client.get("/admin/usuarios", headers=admin_headers).status_code == 200


def test_admin_desactivado_pierde_el_acceso(client, db, admin_headers):
    db.execute(text("UPDATE users SET activo = FALSE WHERE email = 'admin@prueba.com'"))
    assert client.get("/admin/usuarios", headers=admin_headers).status_code == 401


# ── Roles ───────────────────────────────────────────────────────────────────────

def test_crear_rol_genera_el_codigo_y_aparece_en_el_login(client, admin_headers):
    res = client.post("/admin/roles", json={"label": "Trabajo Social", "rol": "evaluador"}, headers=admin_headers)
    assert res.status_code == 201
    assert res.json() | {"usuarios": 0} == {"code": "trabajo_social", "label": "Trabajo Social", "rol": "evaluador", "activo": True, "usuarios": 0}
    assert "trabajo_social" in {c["code"] for c in client.get("/auth/cargos").json()}


def test_codigo_de_rol_sin_tildes(client, admin_headers):
    res = client.post("/admin/roles", json={"label": "Fisioterapia Cardíaca", "rol": "evaluador"}, headers=admin_headers)
    assert res.json()["code"] == "fisioterapia_cardiaca"


def test_rol_duplicado_es_409(client, admin_headers):
    body = {"label": "Trabajo Social", "rol": "evaluador"}
    assert client.post("/admin/roles", json=body, headers=admin_headers).status_code == 201
    assert client.post("/admin/roles", json=body, headers=admin_headers).status_code == 409


def test_un_rol_no_puede_tener_perfil_admin(client, admin_headers):
    res = client.post("/admin/roles", json={"label": "Superusuario", "rol": "admin"}, headers=admin_headers)
    assert res.status_code == 422


def test_desactivar_rol_lo_oculta_del_login(client, admin_headers):
    client.post("/admin/roles", json={"label": "Trabajo Social", "rol": "evaluador"}, headers=admin_headers)
    res = client.patch("/admin/roles/trabajo_social", json={"activo": False}, headers=admin_headers)
    assert res.status_code == 200 and res.json()["activo"] is False
    assert "trabajo_social" not in {c["code"] for c in client.get("/auth/cargos").json()}


def test_listar_roles_cuenta_usuarios(client, admin_headers):
    count = lambda: {r["code"]: r["usuarios"] for r in client.get("/admin/roles", headers=admin_headers).json()}["psicologo"]  # noqa: E731
    before = count()  # la BD de desarrollo ya trae usuarios de demostración
    client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers)
    assert count() == before + 1


# ── Usuarios ────────────────────────────────────────────────────────────────────

def test_crear_usuario_y_que_pueda_ingresar_con_su_rol_y_sede(client, db, admin_headers):
    res = client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "nuevo@prueba.com"
    assert data["cargos"] == ["psicologo"] and data["sedes"] == ["BAQ", "VUP"]
    assert "password" not in str(data).lower()

    stored = scalar(db, "SELECT password_hash FROM users WHERE email = 'nuevo@prueba.com'")
    assert stored.startswith("$2b$") and NEW_USER["password"] not in stored

    ok = login(client, "nuevo@prueba.com", NEW_USER["password"], sede="VUP")
    assert ok.status_code == 200
    assert login(client, "nuevo@prueba.com", NEW_USER["password"], sede="RHA").status_code == 403


def test_usuario_con_un_rol_recien_creado(client, admin_headers):
    client.post("/admin/roles", json={"label": "Trabajo Social", "rol": "evaluador"}, headers=admin_headers)
    res = client.post("/admin/usuarios", json=NEW_USER | {"cargos": ["trabajo_social"]}, headers=admin_headers)
    assert res.status_code == 201
    assert login(client, NEW_USER["email"], NEW_USER["password"], cargo="trabajo_social").status_code == 200


def test_correo_con_dominio_de_prueba_es_valido(client, admin_headers):
    res = client.post("/admin/usuarios", json=NEW_USER | {"email": "alguien@cuc.test"}, headers=admin_headers)
    assert res.status_code == 201


def test_correo_duplicado_sin_importar_mayusculas(client, admin_headers):
    assert client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers).status_code == 201
    dup = client.post("/admin/usuarios", json=NEW_USER | {"email": "NUEVO@prueba.com"}, headers=admin_headers)
    assert dup.status_code == 409


def test_crear_administrador(client, admin_headers):
    res = client.post(
        "/admin/usuarios",
        json=NEW_USER | {"email": "otroadmin@prueba.com", "rol": "admin", "cargos": [], "sedes": []},
        headers=admin_headers,
    )
    assert res.status_code == 201 and res.json()["rol"] == "admin"


def test_validaciones_de_asignacion(client, admin_headers):
    post = lambda **over: client.post("/admin/usuarios", json=NEW_USER | over, headers=admin_headers)  # noqa: E731
    assert post(rol="admin").status_code == 400  # admin no lleva cargos ni sedes
    assert post(cargos=[]).status_code == 400
    assert post(sedes=[]).status_code == 400
    assert post(cargos=["investigador"]).status_code == 400  # perfil distinto al del usuario
    assert post(cargos=["no_existe"]).status_code == 400
    assert post(rol="investigador", cargos=["medico"]).status_code == 400


def test_entradas_invalidas_son_422(client, admin_headers):
    post = lambda **over: client.post("/admin/usuarios", json=NEW_USER | over, headers=admin_headers)  # noqa: E731
    assert post(password="corta1").status_code == 422
    assert post(password="sololetrasaquiyyy").status_code == 422
    assert post(email="no-es-correo").status_code == 422
    assert post(nombre="ab").status_code == 422
    assert post(sedes=["XXX"]).status_code == 422


def test_listar_y_buscar_usuarios(client, admin_headers):
    client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers)
    assert any(u["email"] == "nuevo@prueba.com" for u in client.get("/admin/usuarios", headers=admin_headers).json())
    found = client.get("/admin/usuarios?q=gómez", headers=admin_headers).json()
    assert [u["email"] for u in found] == ["nuevo@prueba.com"]


def test_desactivar_y_reactivar_usuario(client, admin_headers):
    uid = client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers).json()["id"]
    assert client.patch(f"/admin/usuarios/{uid}", json={"activo": False}, headers=admin_headers).status_code == 200
    assert login(client, NEW_USER["email"], NEW_USER["password"]).status_code == 403
    client.patch(f"/admin/usuarios/{uid}", json={"activo": True}, headers=admin_headers)
    assert login(client, NEW_USER["email"], NEW_USER["password"]).status_code == 200


def test_restablecer_contrasena_levanta_el_bloqueo(client, admin_headers):
    uid = client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers).json()["id"]
    for _ in range(5):
        login(client, NEW_USER["email"], "mala-clave-1")
    assert login(client, NEW_USER["email"], NEW_USER["password"]).status_code == 423

    res = client.patch(f"/admin/usuarios/{uid}", json={"password": "Nueva-clave-2026"}, headers=admin_headers)
    assert res.status_code == 200 and res.json()["bloqueado"] is False
    assert login(client, NEW_USER["email"], NEW_USER["password"]).status_code == 401
    assert login(client, NEW_USER["email"], "Nueva-clave-2026").status_code == 200


def test_cambiar_roles_y_sedes_de_un_usuario(client, admin_headers):
    uid = client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers).json()["id"]
    res = client.patch(
        f"/admin/usuarios/{uid}", json={"cargos": ["medico", "enfermeria"], "sedes": ["RHA"]}, headers=admin_headers
    )
    assert res.status_code == 200
    assert res.json()["cargos"] == ["enfermeria", "medico"] and res.json()["sedes"] == ["RHA"]
    bad = client.patch(f"/admin/usuarios/{uid}", json={"cargos": ["investigador"]}, headers=admin_headers)
    assert bad.status_code == 400


def test_no_puede_desactivar_su_propia_cuenta(client, db, admin_headers):
    admin_id = scalar(db, "SELECT id FROM users WHERE email = 'admin@prueba.com'")
    res = client.patch(f"/admin/usuarios/{admin_id}", json={"activo": False}, headers=admin_headers)
    assert res.status_code == 400


def test_usuario_inexistente_es_404(client, admin_headers):
    res = client.patch("/admin/usuarios/00000000-0000-0000-0000-000000000000", json={"nombre": "Alguien"}, headers=admin_headers)
    assert res.status_code == 404


# ── Auditoría ───────────────────────────────────────────────────────────────────

def test_las_acciones_quedan_en_la_bitacora_sin_contrasenas(client, db, admin_headers):
    client.post("/admin/roles", json={"label": "Trabajo Social", "rol": "evaluador"}, headers=admin_headers)
    uid = client.post("/admin/usuarios", json=NEW_USER, headers=admin_headers).json()["id"]
    client.patch(f"/admin/usuarios/{uid}", json={"password": "Nueva-clave-2026"}, headers=admin_headers)

    eventos = {r[0] for r in db.execute(text("SELECT evento FROM audit_log")).all()}
    assert {"login_admin", "rol_creado", "usuario_creado", "usuario_actualizado"} <= eventos

    blob = " ".join(r[0] for r in db.execute(text("SELECT detalle::text FROM audit_log")).all())
    assert NEW_USER["password"] not in blob and "Nueva-clave-2026" not in blob
    assert scalar(db, "SELECT verify_audit_chain() IS NULL") is True
