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
from .routers import admin, auth


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_admin()
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


@app.get("/salud", tags=["salud"])
def salud(db: Session = Depends(get_db)):
    """RF03.3 — estado del servicio."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Base de datos no disponible") from None
    return {"status": "ok", "version_app": APP_VERSION}
