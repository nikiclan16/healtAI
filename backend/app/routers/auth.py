from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import audit
from ..auth_service import authenticate, cambiar_password
from ..config import get_settings
from ..db import get_db
from ..deps import current_clinical_any
from ..schemas import CambiarPasswordIn, CargoPublico, LoginIn, TokenOut, UsuarioSesion
from ..security import AUD_APP, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/cargos", response_model=list[CargoPublico])
def listar_cargos(db: Session = Depends(get_db)):
    """Roles operativos activos para el selector del portal de acceso."""
    rows = db.execute(text("SELECT code, label FROM cargos WHERE activo ORDER BY label")).mappings().all()
    return [dict(r) for r in rows]


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Acceso del personal clínico: usuario + rol operativo + sede. El servidor valida las tres cosas."""
    user = authenticate(db, body.usuario, body.password)

    if user["rol"] == "admin":
        audit.log(db, "login_denegado", user_id=user["id"], detalle={"motivo": "admin_en_acceso_clinico"})
        db.commit()
        raise HTTPException(403, "Las cuentas de administración ingresan por /admin")

    cargo = (
        db.execute(
            text(
                "SELECT c.code, c.label FROM user_cargos uc JOIN cargos c ON c.code = uc.cargo "
                "WHERE uc.user_id = :u AND uc.cargo = :c AND c.activo"
            ),
            {"u": user["id"], "c": body.cargo},
        )
        .mappings()
        .first()
    )
    if cargo is None:
        audit.log(db, "login_denegado", user_id=user["id"], detalle={"motivo": "rol_no_asignado", "cargo": body.cargo})
        db.commit()
        raise HTTPException(403, "El usuario no tiene asignado el rol operativo seleccionado")

    in_site = db.execute(
        text("SELECT 1 FROM user_sites WHERE user_id = :u AND site_code = :s"),
        {"u": user["id"], "s": body.sede},
    ).first()
    if in_site is None:
        audit.log(db, "login_denegado", user_id=user["id"], site_code=None, detalle={"motivo": "sede_no_autorizada", "sede": body.sede})
        db.commit()
        raise HTTPException(403, "El usuario no está autorizado en la sede seleccionada")

    token, expires_in = create_token(
        str(user["id"]), user["rol"], AUD_APP, get_settings().access_token_minutes, cargo=cargo["code"], sede=body.sede
    )
    audit.log(db, "login", user_id=user["id"], site_code=body.sede, detalle={"cargo": cargo["code"]})
    return TokenOut(
        access_token=token,
        expires_in=expires_in,
        debe_cambiar_password=user["debe_cambiar_password"],
        usuario=UsuarioSesion(
            id=user["id"], nombre=user["nombre"], rol=user["rol"], cargo=cargo["code"], cargo_label=cargo["label"]
        ),
    )


@router.post("/cambiar-password", status_code=204)
def cambiar_mi_password(body: CambiarPasswordIn, user: dict = Depends(current_clinical_any), db: Session = Depends(get_db)):
    """El usuario cambia su propia contraseña (obligatorio si la actual es temporal)."""
    cambiar_password(db, user, body.actual, body.nueva)
