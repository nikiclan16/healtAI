from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import audit
from ..auth_service import authenticate, cambiar_password
from ..config import get_settings
from ..db import get_db
from ..deps import current_admin, current_admin_any
from ..schemas import (
    AdminLoginIn,
    CambiarPasswordIn,
    CargoIn,
    CargoOut,
    CargoPatch,
    SedeOut,
    TokenOut,
    UsuarioIn,
    UsuarioOut,
    UsuarioPatch,
    UsuarioSesion,
)
from ..security import AUD_ADMIN, create_token, hash_password
from ..util import CARGO_CODE_RE, slugify_code

# Login de administración: sin dependencia de sesión.
login_router = APIRouter(prefix="/admin/auth", tags=["admin"])
# Cuenta propia del administrador: también accesible mientras tenga una contraseña temporal pendiente.
cuenta_router = APIRouter(prefix="/admin/cuenta", tags=["admin"])
# Todo lo demás exige un administrador autenticado.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


@login_router.post("/login", response_model=TokenOut)
def admin_login(body: AdminLoginIn, db: Session = Depends(get_db)):
    user = authenticate(db, body.usuario, body.password)
    if user["rol"] != "admin":
        audit.log(db, "login_admin_denegado", user_id=user["id"])
        db.commit()
        raise HTTPException(403, "Esta cuenta no tiene acceso de administración")
    token, expires_in = create_token(str(user["id"]), "admin", AUD_ADMIN, get_settings().admin_token_minutes)
    audit.log(db, "login_admin", user_id=user["id"])
    return TokenOut(
        access_token=token,
        expires_in=expires_in,
        debe_cambiar_password=user["debe_cambiar_password"],
        usuario=UsuarioSesion(id=user["id"], nombre=user["nombre"], rol="admin"),
    )


@cuenta_router.post("/password", status_code=204)
def cambiar_mi_password(body: CambiarPasswordIn, admin: dict = Depends(current_admin_any), db: Session = Depends(get_db)):
    cambiar_password(db, admin, body.actual, body.nueva)


# ── Sedes ───────────────────────────────────────────────────────────────────────

@router.get("/sedes", response_model=list[SedeOut])
def listar_sedes(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT code, ciudad, centro, nombre FROM sites ORDER BY code")).mappings().all()
    return [dict(r) for r in rows]


# ── Roles operativos ────────────────────────────────────────────────────────────

_CARGO_SELECT = (
    "SELECT c.code, c.label, c.rol, c.activo, "
    "(SELECT count(*) FROM user_cargos uc WHERE uc.cargo = c.code) AS usuarios FROM cargos c"
)


@router.get("/roles", response_model=list[CargoOut])
def listar_roles(db: Session = Depends(get_db)):
    rows = db.execute(text(f"{_CARGO_SELECT} ORDER BY c.rol, c.label")).mappings().all()
    return [dict(r) for r in rows]


@router.post("/roles", response_model=CargoOut, status_code=201)
def crear_rol(body: CargoIn, admin: dict = Depends(current_admin), db: Session = Depends(get_db)):
    code = body.code or slugify_code(body.label)
    if not CARGO_CODE_RE.match(code):
        raise HTTPException(400, "No fue posible generar un código válido; indíquelo manualmente")
    if db.execute(text("SELECT 1 FROM cargos WHERE code = :c"), {"c": code}).first():
        raise HTTPException(409, f"Ya existe un rol con el código '{code}'")
    db.execute(
        text("INSERT INTO cargos (code, label, rol) VALUES (:code, :label, :rol)"),
        {"code": code, "label": body.label, "rol": body.rol},
    )
    audit.log(db, "rol_creado", user_id=admin["id"], detalle={"code": code, "label": body.label, "rol": body.rol})
    return db.execute(text(f"{_CARGO_SELECT} WHERE c.code = :c"), {"c": code}).mappings().one()


@router.patch("/roles/{code}", response_model=CargoOut)
def actualizar_rol(code: str, body: CargoPatch, admin: dict = Depends(current_admin), db: Session = Depends(get_db)):
    if db.execute(text("SELECT 1 FROM cargos WHERE code = :c"), {"c": code}).first() is None:
        raise HTTPException(404, "Rol no encontrado")
    changes = body.model_dump(exclude_none=True)
    if changes:
        sets = ", ".join(f"{k} = :{k}" for k in changes)
        db.execute(text(f"UPDATE cargos SET {sets} WHERE code = :code"), {**changes, "code": code})
        audit.log(db, "rol_actualizado", user_id=admin["id"], detalle={"code": code, **changes})
    return db.execute(text(f"{_CARGO_SELECT} WHERE c.code = :c"), {"c": code}).mappings().one()


# ── Usuarios ────────────────────────────────────────────────────────────────────

_USER_SELECT = """
SELECT u.id, u.email, u.nombre, u.rol, u.activo, u.created_at, u.last_login_at, u.debe_cambiar_password,
       (u.locked_until IS NOT NULL AND u.locked_until > now()) AS bloqueado,
       COALESCE((SELECT array_agg(cargo ORDER BY cargo) FROM user_cargos WHERE user_id = u.id), ARRAY[]::text[]) AS cargos,
       COALESCE((SELECT array_agg(site_code ORDER BY site_code) FROM user_sites WHERE user_id = u.id), ARRAY[]::text[]) AS sedes
FROM users u
"""


def _get_user(db: Session, user_id: UUID):
    return db.execute(text(f"{_USER_SELECT} WHERE u.id = :id"), {"id": user_id}).mappings().first()


def _validate_assignment(db: Session, rol: str, cargos: list[str], sedes: list[str]) -> None:
    """Un admin no tiene cargos ni sedes; el resto necesita al menos uno de cada uno, compatibles con su perfil."""
    if rol == "admin":
        if cargos or sedes:
            raise HTTPException(400, "Un administrador no tiene roles operativos ni sedes")
        return
    if not cargos:
        raise HTTPException(400, "Asigne al menos un rol operativo")
    if not sedes:
        raise HTTPException(400, "Asigne al menos una sede")
    found = (
        db.execute(
            text("SELECT code, rol, activo FROM cargos WHERE code = ANY(:codes)"),
            {"codes": list(set(cargos))},
        )
        .mappings()
        .all()
    )
    by_code = {r["code"]: r for r in found}
    for code in set(cargos):
        c = by_code.get(code)
        if c is None:
            raise HTTPException(400, f"El rol '{code}' no existe")
        if not c["activo"]:
            raise HTTPException(400, f"El rol '{code}' está desactivado")
        if c["rol"] != rol:
            raise HTTPException(400, f"El rol '{code}' pertenece al perfil '{c['rol']}', no a '{rol}'")


def _replace_assignments(db: Session, user_id: UUID, cargos: list[str] | None, sedes: list[str] | None) -> None:
    if cargos is not None:
        db.execute(text("DELETE FROM user_cargos WHERE user_id = :u"), {"u": user_id})
        for code in sorted(set(cargos)):
            db.execute(text("INSERT INTO user_cargos (user_id, cargo) VALUES (:u, :c)"), {"u": user_id, "c": code})
    if sedes is not None:
        db.execute(text("DELETE FROM user_sites WHERE user_id = :u"), {"u": user_id})
        for code in sorted(set(sedes)):
            db.execute(text("INSERT INTO user_sites (user_id, site_code) VALUES (:u, :s)"), {"u": user_id, "s": code})


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(q: str | None = Query(default=None, max_length=100), db: Session = Depends(get_db)):
    if q:
        rows = db.execute(
            text(f"{_USER_SELECT} WHERE u.email ILIKE :p OR u.nombre ILIKE :p ORDER BY u.created_at DESC"),
            {"p": f"%{q}%"},
        )
    else:
        rows = db.execute(text(f"{_USER_SELECT} ORDER BY u.created_at DESC"))
    return [dict(r) for r in rows.mappings().all()]


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(body: UsuarioIn, admin: dict = Depends(current_admin), db: Session = Depends(get_db)):
    _validate_assignment(db, body.rol, body.cargos, body.sedes)
    if db.execute(text("SELECT 1 FROM users WHERE email = :e"), {"e": body.email}).first():
        raise HTTPException(409, "Ya existe un usuario con ese correo")
    try:
        user_id = db.execute(
            text(
                "INSERT INTO users (email, password_hash, nombre, rol, debe_cambiar_password) "
                "VALUES (:e, :h, :n, :r, TRUE) RETURNING id"
            ),
            {"e": body.email, "h": hash_password(body.password), "n": body.nombre, "r": body.rol},
        ).scalar_one()
        _replace_assignments(db, user_id, body.cargos, body.sedes)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No fue posible crear el usuario (datos duplicados o inválidos)") from None
    audit.log(
        db,
        "usuario_creado",
        user_id=admin["id"],
        detalle={"usuario_id": str(user_id), "email": body.email, "rol": body.rol, "cargos": body.cargos, "sedes": body.sedes},
    )
    return _get_user(db, user_id)


@router.patch("/usuarios/{user_id}", response_model=UsuarioOut)
def actualizar_usuario(
    user_id: UUID, body: UsuarioPatch, admin: dict = Depends(current_admin), db: Session = Depends(get_db)
):
    target = _get_user(db, user_id)
    if target is None:
        raise HTTPException(404, "Usuario no encontrado")
    if body.activo is False and user_id == admin["id"]:
        raise HTTPException(400, "No puede desactivar su propia cuenta")

    cargos = body.cargos if body.cargos is not None else list(target["cargos"])
    sedes = body.sedes if body.sedes is not None else list(target["sedes"])
    if body.cargos is not None or body.sedes is not None:
        _validate_assignment(db, target["rol"], cargos, sedes)

    changed: list[str] = []
    if body.nombre is not None:
        db.execute(text("UPDATE users SET nombre = :n WHERE id = :id"), {"n": body.nombre, "id": user_id})
        changed.append("nombre")
    if body.activo is not None:
        db.execute(text("UPDATE users SET activo = :a WHERE id = :id"), {"a": body.activo, "id": user_id})
        changed.append("activo")
    if body.password is not None:
        # Restablecer la contraseña también levanta cualquier bloqueo.
        db.execute(
            text("UPDATE users SET password_hash = :h, failed_logins = 0, locked_until = NULL, "
                "debe_cambiar_password = TRUE WHERE id = :id"),
            {"h": hash_password(body.password), "id": user_id},
        )
        changed.append("password")
    if body.cargos is not None or body.sedes is not None:
        _replace_assignments(db, user_id, body.cargos, body.sedes)
        changed += [k for k, v in (("cargos", body.cargos), ("sedes", body.sedes)) if v is not None]

    if changed:
        values = {k: v for k, v in body.model_dump(exclude_none=True).items() if k != "password"}
        audit.log(
            db,
            "usuario_actualizado",
            user_id=admin["id"],
            detalle={"usuario_id": str(user_id), "campos": changed, "valores": values},
        )
    return _get_user(db, user_id)
