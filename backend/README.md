# healthAI · Backend (FastAPI)

API de autenticación, administración de usuarios/roles y (próximamente) inferencia y evaluaciones. Usa la PostgreSQL definida en `../infra`.

## Puesta en marcha

Desde la raíz del repo:

```bash
cp .env.example .env                       # cambie las contraseñas y SECRET_KEY
docker compose up -d --build               # base de datos + API en http://127.0.0.1:8000
docker compose run --rm backend pytest     # pruebas de integración (se revierten, no dejan datos)
```

Documentación interactiva: http://127.0.0.1:8000/docs

Al arrancar, si no existe ningún administrador activo, se crea uno con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/salud` | público | Estado del servicio (RF03.3) |
| GET | `/auth/cargos` | público | Roles operativos activos (selector del portal de acceso) |
| POST | `/auth/login` | público | Usuario + contraseña + **rol operativo** + sede; el servidor valida las tres |
| POST | `/admin/auth/login` | público | Acceso de administración (solo cuentas `admin`) |
| GET | `/admin/sedes` | admin | Sedes del estudio |
| GET · POST | `/admin/roles` | admin | Listar / crear roles operativos |
| PATCH | `/admin/roles/{code}` | admin | Renombrar o activar/desactivar un rol |
| GET · POST | `/admin/usuarios` | admin | Listar (`?q=`) / crear usuarios |
| PATCH | `/admin/usuarios/{id}` | admin | Editar nombre, roles, sedes; activar/desactivar; restablecer contraseña |

## Modelo de acceso

- **Perfil (RBAC):** `evaluador`, `investigador` o `admin`. Lo fija el administrador y no se puede cambiar después.
- **Rol operativo (cargo):** Médico, Psicólogo… Lo crea el administrador y hereda un perfil base. Un usuario solo puede ingresar con los roles y sedes que tenga asignados.
- **Tokens:** JWT firmados con `SECRET_KEY`. Audiencias separadas: un token clínico no sirve en `/admin/*` y viceversa. Clínico: 8 h. Administración: 60 min.

## Seguridad implementada

- Contraseñas con bcrypt; política mínima de 10 caracteres con letras y números.
- Bloqueo de 15 min tras 5 intentos fallidos; el administrador lo levanta restableciendo la contraseña.
- Mismo mensaje y tiempo de respuesta para usuario inexistente o contraseña errónea.
- Todo intento de ingreso y toda acción de administración queda en la bitácora encadenada (sin contraseñas).
- Un administrador no puede desactivar su propia cuenta.

## Pendiente

- `/predecir`, `/evaluaciones` y decisión humana (el frontend aún los simula).
- Cambio de contraseña por el propio usuario y obligación de cambiarla en el primer ingreso.
- Rol de base de datos con permisos mínimos, límite de peticiones por IP y desactivar `/docs` en producción.
