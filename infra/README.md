# healthAI · infraestructura local

Base de datos PostgreSQL 16 en Docker para el backend (siguiente feature).

## Inicio rápido

```bash
cp .env.example .env            # luego cambie POSTGRES_PASSWORD
docker compose up -d db --wait  # crea el volumen, aplica el esquema y el seed de desarrollo
```

Conexión desde el backend (máquina local):

```
postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:<POSTGRES_PORT>/<POSTGRES_DB>
```

## Comandos útiles

```bash
docker compose exec db psql -U healthai -d healthai        # consola SQL
docker compose down                                         # detiene (conserva los datos)
docker compose down -v                                      # BORRA el volumen: el esquema y el seed se reaplican al siguiente up
cat infra/db/tests/schema_test.sql | docker compose exec -T db psql -U healthai -d healthai -v ON_ERROR_STOP=1
```

El script de pruebas corre dentro de una transacción que se revierte: no deja datos.

> Los scripts de `docker-entrypoint-initdb.d` solo se ejecutan al **crear** el volumen. Si cambia `01_schema.sql`, recree el volumen con `down -v` (aún no hay migraciones; llegarán con el backend, p. ej. Alembic).

## Esquema (`db/init/01_schema.sql`)

| Tabla | Para qué |
|---|---|
| `sites` | Sedes BAQ, RHA, VUP |
| `users`, `user_cargos`, `user_sites` | Usuarios (bcrypt), perfil RBAC, roles operativos permitidos y sedes autorizadas |
| `patient_code_counters` + `next_patient_code()` | Código seudonimizado consecutivo `PAC-AAAA-NNNN`, seguro ante concurrencia |
| `evaluations` | Cada inferencia: formulario, entrada al modelo, predicción, reglas, ruta, versiones |
| `decisions` | Decisión humana final (una por evaluación) |
| `audit_log` | Bitácora con hashes SHA-256 encadenados; `verify_audit_chain()` detecta manipulación |

Garantías que impone la propia base de datos:

- **Sin identificadores de pacientes:** no hay columnas para cédula ni nombre (RNF01.2).
- **Solo inserción:** `evaluations`, `decisions` y `audit_log` rechazan `UPDATE`, `DELETE` y `TRUNCATE` (RNF01.3).
- **Regla de seguridad:** no se puede registrar Ruta B sobre una evaluación con `reglas.locked = true` (RF05.1).
- **Decisión humana:** `confirmar` exige la ruta sugerida; diferir de ella exige justificación de al menos 10 caracteres (RF06.1).
- **Rol operativo:** el cargo `investigador` solo es válido para el perfil `investigador`.

## Datos de desarrollo (`db/seed/dev_seed.sql`)

Sedes y tres usuarios de demostración (`evaluador@cuc.test`, `psicologa@cuc.test`, `investigador@cuc.test`), los mismos del modo `mock` del frontend. **Solo para desarrollo**: quite el montaje del seed en `docker-compose.yml` para cualquier entorno con datos reales.

## Pendiente

- Rol de aplicación con permisos mínimos para el backend (hoy usa el superusuario de desarrollo).
- Contenedores de `backend` y `frontend` en el compose.
- Migraciones (Alembic) y copias de seguridad.
