from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import APP_VERSION
from .bootstrap import ensure_admin
from .config import get_settings
from .db import get_db
from .modelo.registro import cargar as cargar_modelo
from .routers import admin, auth, evaluaciones


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_admin()
    cargar_modelo()  # deja en el log si el modelo está disponible o por qué no
    yield


app = FastAPI(title="healthAI API", version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(admin.login_router)
app.include_router(admin.router)
app.include_router(evaluaciones.router)


@app.get("/salud", tags=["salud"])
def salud(db: Session = Depends(get_db)):
    """RF03.3 — estado del servicio. `status` es "ok" solo si la base de datos y el modelo están disponibles."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Base de datos no disponible") from None
    modelo, motivo = cargar_modelo()
    info = (
        {"estado": "ok", "version": modelo.artefacto.version, "placeholder": modelo.artefacto.placeholder}
        if modelo
        else {"estado": "no_configurado", "motivo": motivo}
    )
    return {
        "status": "ok" if modelo else "degradado",
        "version_app": APP_VERSION,
        "version_modelo": info.get("version"),
        "modelo": info,
    }
