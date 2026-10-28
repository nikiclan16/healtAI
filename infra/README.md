# healthAI · infraestructura local

PostgreSQL 16 y el backend FastAPI en Docker.

## Inicio rápido

```bash
cp .env.example .env                 # luego cambie POSTGRES_PASSWORD, SECRET_KEY y ADMIN_PASSWORD
docker compose up -d --build --wait  # crea el volumen, aplica el esquema y el seed de desarrollo, arranca la API
```

Conexión desde herramientas (pgAdmin, DBeaver…): host `127.0.0.1`, puerto `POSTGRES_PORT`, base `POSTGRES_DB`, usuario `POSTGRES_USER`, contraseña `POSTGRES_PASSWORD` (todo en `.env`).

## Comandos útiles

```bash
docker compose exec db psql -U healthai -d healthai        # consola SQL
docker compose down                                         # detiene (conserva los datos)
docker compose down -v                                      # BORRA el volumen: esquema y seed se reaplican al siguiente up
docker compose run --rm backend pytest                      # pruebas del backend
cat infra/db/tests/schema_test.sql | docker compose exec -T db psql -U healthai -d healthai -v ON_ERROR_STOP=1
```

Las pruebas (backend y esquema) corren dentro de transacciones que se revierten: no dejan datos.

> Los scripts de `docker-entrypoint-initdb.d` solo se ejecutan al **crear** el volumen. Si cambia `01_schema.sql`, recree el volumen con `down -v` (aún no hay migraciones; llegarán con Alembic).

## Esquema (`db/init/01_schema.sql`)

| Tabla | Para qué |
|---|---|
| `sites` | Sedes BAQ, RHA, VUP |
| `cargos` | Roles operativos (Médico, Psicólogo…). Los gestiona el administrador; cada uno hereda un perfil base |
| `users`, `user_cargos`, `user_sites` | Usuarios (bcrypt), perfil RBAC (`evaluador`, `investigador`, `admin`), roles permitidos y sedes autorizadas; contador de intentos y bloqueo |
| `patient_code_counters` + `next_patient_code()` | Código seudonimizado consecutivo `PAC-AAAA-NNNN`, seguro ante concurrencia |
| `evaluations` | Cada inferencia: formulario, entrada al modelo, predicción, reglas, ruta, versiones |
| `decisions` | Decisión humana final (una por evaluación) |
| `audit_log` | Bitácora con hashes SHA-256 encadenados; `verify_audit_chain()` detecta manipulación |

Garantías que impone la propia base de datos:

- **Sin identificadores de pacientes:** no hay columnas para cédula ni nombre (RNF01.2).
- **Solo inserción:** `evaluations`, `decisions` y `audit_log` rechazan `UPDATE`, `DELETE` y `TRUNCATE` (RNF01.3).
- **Regla de seguridad:** no se puede registrar Ruta B sobre una evaluación con `reglas.locked = true` (RF05.1).
- **Decisión humana:** `confirmar` exige la ruta sugerida; diferir de ella exige justificación de al menos 10 caracteres (RF06.1).
- **Roles coherentes:** el perfil base del rol operativo debe coincidir con el perfil del usuario; el administrador no tiene roles operativos.

## Administrador inicial y datos de desarrollo

- **Administrador:** lo crea el backend al arrancar con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env` (solo si no existe ningún admin activo). No hay contraseña de admin en ningún archivo del repo. Acceso: `/admin/login` en el frontend.
- **Usuarios de demostración** (`db/seed/dev_seed.sql`): `evaluador@cuc.test`, `psicologa@cuc.test`, `investigador@cuc.test`, los mismos del modo demo del frontend. **Solo desarrollo**: quite el montaje del seed en `docker-compose.yml` para cualquier entorno con datos reales.

## Pendiente

- Rol de base de datos con permisos mínimos para el backend (hoy usa el superusuario de desarrollo).
- Contenedor del frontend en el compose.
- Migraciones (Alembic) y copias de seguridad.
