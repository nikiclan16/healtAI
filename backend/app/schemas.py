from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from .security import password_problem

SiteCode = Literal["BAQ", "RHA", "VUP"]
Perfil = Literal["evaluador", "investigador", "admin"]
PerfilCargo = Literal["evaluador", "investigador"]


def _valid_password(value: str) -> str:
    problem = password_problem(value)
    if problem:
        raise ValueError(problem)
    return value


def _valid_email(value: str) -> str:
    import re

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        raise ValueError("Correo electrónico inválido")
    return value.lower()


Password = Annotated[str, AfterValidator(_valid_password)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, max_length=254), AfterValidator(_valid_email)]
Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]


# ── Autenticación ───────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    usuario: str = Field(max_length=254)
    password: str = Field(max_length=200)
    cargo: str = Field(max_length=32)
    sede: SiteCode


class AdminLoginIn(BaseModel):
    usuario: str = Field(max_length=254)
    password: str = Field(max_length=200)


class UsuarioSesion(BaseModel):
    id: UUID
    nombre: str
    rol: Perfil
    cargo: str | None = None
    cargo_label: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    # True si la contraseña es temporal (fijada por un administrador) y debe cambiarse antes de operar.
    debe_cambiar_password: bool = False
    usuario: UsuarioSesion


class CambiarPasswordIn(BaseModel):
    actual: str = Field(max_length=200)
    nueva: Password


class CargoPublico(BaseModel):
    code: str
    label: str


# ── Administración ──────────────────────────────────────────────────────────────

class CargoIn(BaseModel):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=60)]
    rol: PerfilCargo
    code: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_]{2,31}$")


class CargoPatch(BaseModel):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=60)] | None = None
    activo: bool | None = None


class CargoOut(BaseModel):
    code: str
    label: str
    rol: PerfilCargo
    activo: bool
    usuarios: int


class SedeOut(BaseModel):
    code: str
    ciudad: str
    centro: str
    nombre: str


class UsuarioIn(BaseModel):
    email: Email
    nombre: Nombre
    password: Password
    rol: Perfil
    cargos: list[str] = []
    sedes: list[SiteCode] = []


class UsuarioPatch(BaseModel):
    nombre: Nombre | None = None
    activo: bool | None = None
    password: Password | None = None
    cargos: list[str] | None = None
    sedes: list[SiteCode] | None = None


class UsuarioOut(BaseModel):
    id: UUID
    email: str
    nombre: str
    rol: Perfil
    activo: bool
    bloqueado: bool
    debe_cambiar_password: bool
    cargos: list[str]
    sedes: list[str]
    created_at: datetime
    last_login_at: datetime | None
