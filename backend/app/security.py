import re
import time
from functools import cache

import bcrypt
import jwt

from .config import get_settings

ALGORITHM = "HS256"
AUD_APP = "healthai-app"  # tokens del flujo clínico
AUD_ADMIN = "healthai-admin"  # tokens de administración (no sirven en el flujo clínico y viceversa)

MAX_PASSWORD_BYTES = 72  # límite de bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


@cache
def _dummy_hash() -> str:
    return hash_password("contrasena-de-relleno")


def dummy_verify(password: str) -> None:
    """Gasta el mismo tiempo que una verificación real (evita revelar si el usuario existe)."""
    verify_password(password, _dummy_hash())


def password_problem(password: str) -> str | None:
    """Política mínima de contraseñas. Devuelve el motivo del rechazo o None si es válida."""
    if len(password) < 10:
        return "La contraseña debe tener al menos 10 caracteres"
    if len(password.encode()) > MAX_PASSWORD_BYTES:
        return f"La contraseña no puede superar {MAX_PASSWORD_BYTES} bytes"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "La contraseña debe combinar letras y números"
    return None


def create_token(user_id: str, perfil: str, audience: str, minutes: int, **claims: str) -> tuple[str, int]:
    now = int(time.time())
    payload = {"sub": user_id, "perfil": perfil, "aud": audience, "iat": now, "exp": now + minutes * 60, **claims}
    token = jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)
    return token, minutes * 60


def decode_token(token: str, audience: str) -> dict:
    return jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM], audience=audience)
