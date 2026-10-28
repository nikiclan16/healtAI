"""Pruebas de integración contra la PostgreSQL real del compose.

Cada prueba corre dentro de una transacción externa que se revierte al terminar:
no deja datos, y los `commit()` del código bajo prueba se convierten en SAVEPOINTs.
"""

import os

os.environ["BCRYPT_ROUNDS"] = "4"  # antes de importar la app: acelera las pruebas

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
    app.dependency_overrides[get_db] = lambda: db
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
