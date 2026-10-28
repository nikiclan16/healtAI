from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración por variables de entorno (ver .env.example en la raíz del repo)."""

    model_config = SettingsConfigDict(extra="ignore")

    database_url: str
    secret_key: str = Field(min_length=32)

    access_token_minutes: int = 480  # turno de atención (8 h)
    admin_token_minutes: int = 60  # el acceso de administración es más corto

    bcrypt_rounds: int = Field(default=12, ge=4, le=15)  # las pruebas lo bajan para ir más rápido
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    # Artefacto del modelo entrenado (JSON con pesos, intercepto y escalador). Ver model_artifacts/README.md.
    model_artifact_path: str = "model_artifacts/model.json"
    # Un artefacto marcado `placeholder` (valores de ejemplo) solo se carga si esto es true: NUNCA en producción.
    allow_placeholder_model: bool = False

    dictionary_version: str = "v2.1"

    # Documentación interactiva (/docs, /openapi.json). Desactivada por defecto: solo desarrollo.
    enable_docs: bool = False

    cors_origins: str ="http://localhost:5173,http://localhost:5174"

    # Administrador inicial: se crea al arrancar solo si no existe ningún admin activo.
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Administrador"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
