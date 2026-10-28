"""Pruebas de integración contra la PostgreSQL real del compose.

Cada prueba corre dentro de una transacción externa que se revierte al terminar:
no deja datos, y los `commit()` del código bajo prueba se convierten en SAVEPOINTs.
"""

import os

os.environ["BCRYPT_ROUNDS"] = "4"  # antes de importar la app: acelera las pruebas
# Las pruebas usan SIEMPRE el modelo de prueba, sin importar el .env del desarrollador.
os.environ["MODEL_ARTIFACT_PATH"] = "model_artifacts/model.placeholder.json"
os.environ["ALLOW_PLACEHOLDER_MODEL"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402

PASSWORD = "Clave-de-prueba-1"


@pytest.fixture
def db():
    conn = engine.connect()
    outer = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        conn.close()


@pytest.fixture
def client(db):
    def override():
        # Misma semántica que producción: confirma si va bien y revierte (al SAVEPOINT) si falla.
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = override
    # Sin `with`: no ejecuta el lifespan (no crea el admin inicial en la BD real).
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(db, email, *, rol="evaluador", cargos=("medico",), sedes=("BAQ",), password=PASSWORD, activo=True):
    user_id = db.execute(
        text("INSERT INTO users (email, password_hash, nombre, rol, activo) VALUES (:e, :h, :n, :r, :a) RETURNING id"),
        {"e": email, "h": hash_password(password), "n": f"Usuario {email.split('@')[0]}", "r": rol, "a": activo},
    ).scalar_one()
    for cargo in cargos:
        db.execute(text("INSERT INTO user_cargos VALUES (:u, :c)"), {"u": user_id, "c": cargo})
    for sede in sedes:
        db.execute(text("INSERT INTO user_sites VALUES (:u, :s)"), {"u": user_id, "s": sede})
    return user_id


@pytest.fixture
def admin_headers(client, db):
    make_user(db, "admin@prueba.com", rol="admin", cargos=(), sedes=())
    res = client.post("/admin/auth/login", json={"usuario": "admin@prueba.com", "password": PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def scalar(db, sql, **params):
    return db.execute(text(sql), params).scalar_one()


ANEXO_E = {
    "v8_tiempo_diagnostico": 10,
    "v9_tratamiento": "orales",
    "v11": {"hipertension": True, "cardiaca": False, "obesidad": False, "otra": False},
    "v12_percepcion_salud": 3,
    "v13_apoyo_familiar": 4,
    "v14_actividad_fisica": 0,
    "v15_calidad_sueno": 2,
    "who5_total": 8,
    "dass_depresion": 9,
    "dass_ansiedad": 8,
    "dass_estres": 12,
    "dass_item21": 1,
    "alertas_profesional": {"riesgo_suicida": False, "deterioro_agudo": False, "riesgo_urgente": False},
}


def clinical_headers(client, email, *, cargo="medico", sede="BAQ"):
    res = client.post("/auth/login", json={"usuario": email, "password": PASSWORD, "cargo": cargo, "sede": sede})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
