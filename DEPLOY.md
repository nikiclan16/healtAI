# healthAI · Despliegue

Guía para llevar la plataforma a un servidor. `docker-compose.yml` es la configuración **base y apta para producción**; `docker-compose.override.yml` solo existe para desarrollo (usuarios de demostración y `/docs`) y **no debe usarse** en el servidor.

> **Servidor con nginx + pm2 (healtai.jmdatalabs.co):** siga [`deploy/README.md`](deploy/README.md), con scripts y configuración listos. El resto de este documento describe la variante con Docker Compose y la lista general de verificación.

## 1. Antes de empezar

| Necesita | Detalle |
|---|---|
| Servidor con Docker y Compose v2 (solo variante Docker) | PostgreSQL y la API corren en contenedores |
| Dominio con HTTPS | Un proxy inverso (Nginx, Caddy, Traefik…) con certificado válido. Los datos clínicos nunca deben viajar por HTTP |
| Artefacto del modelo | `backend/model_artifacts/model.json` entregado por el equipo del modelo (pesos, intercepto y escalador; ver [`backend/model_artifacts/README.md`](backend/model_artifacts/README.md)) |
| Node 20+ (solo para construir) | El frontend se compila a archivos estáticos |

## 2. Configuración (`.env`)

```bash
cp .env.example .env
```

Cambie **todos** los valores de ejemplo:

| Variable | En producción |
|---|---|
| `POSTGRES_PASSWORD` | Aleatoria y larga |
| `SECRET_KEY` | `openssl rand -hex 32`. Si cambia, se cierran todas las sesiones |
| `CORS_ORIGINS` | Solo el origen real del frontend, p. ej. `https://healthai.ejemplo.co` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador inicial (mín. 10 caracteres, letras y números). Se crea una sola vez, si no existe ningún admin |
| `ALLOW_PLACEHOLDER_MODEL` | **Borrar la línea** (o `false`). Con `true` se aceptan valores de ejemplo como si fueran el modelo |
| `MODEL_ARTIFACT_PATH` | **Borrar la línea** (usa `model_artifacts/model.json`) |
| `ENABLE_DOCS` | **Borrar la línea** (o `false`): cierra `/docs` y `/openapi.json` |

## 3. Publicar

```bash
# Instale el modelo real
cp /ruta/al/modelo.json backend/model_artifacts/model.json

# Solo el archivo base: sin usuarios de demostración ni /docs
docker compose -f docker-compose.yml up -d --build
curl http://127.0.0.1:8000/salud
```

`/salud` debe responder `"status": "ok"` y `"placeholder": false`. Si dice `degradado`, el modelo no se cargó (motivo en `modelo.motivo`) y la API responde 503 en inferencia: es el comportamiento esperado, nunca inventa una predicción.

La API y la base de datos solo escuchan en `127.0.0.1`. Exponga la API únicamente a través del proxy inverso con HTTPS (por ejemplo `https://api.healthai.ejemplo.co` → `127.0.0.1:8000`). No publique el puerto 5432.

### Frontend

```bash
cd frontend
VITE_API_BASE_URL=https://api.healthai.ejemplo.co npm ci && npm run build
```

Sirva el contenido de `frontend/dist/` como sitio estático con **fallback a `index.html`** (la aplicación usa rutas como `/login` y `/admin`). La compilación de producción nunca incluye el modo demostración ni los usuarios de prueba.

## 4. Primer ingreso

1. Entre a `https://<frontend>/admin/login` con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Cambie la contraseña desde el enlace **Contraseña** del encabezado.
3. Cree los roles operativos y los usuarios. Cada usuario nuevo recibe una contraseña temporal y **debe cambiarla en su primer ingreso**; mientras no lo haga, el servidor le niega cualquier operación.
4. Retire `ADMIN_PASSWORD` del `.env` (ya no se usa).

## 5. Bases de datos ya creadas

`infra/db/init/01_schema.sql` solo corre al crear el volumen. Para actualizar una base existente aplique los scripts de [`infra/db/migrations/`](infra/db/migrations) en orden:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < infra/db/migrations/002_debe_cambiar_password.sql
```

## 6. Respaldos y operación

- Respalde el volumen `pgdata` (p. ej. `pg_dump` diario). La bitácora `audit_log` está encadenada con hashes: una restauración parcial rompe la cadena y el panel del investigador lo señala.
- Verifique la integridad cuando lo necesite: `SELECT verify_audit_chain();` (devuelve `NULL` si está íntegra).
- Logs: `docker compose logs -f backend`.

## 7. Pendiente (no bloquea el despliegue, sí la operación clínica)

- **Modelo entrenado real** y validación clínica de los umbrales de las reglas R1–R5 y de DASS-21.
- Modelos retadores (KNN, MLP) para el nivel de confianza; hasta entonces la interfaz muestra "No disponible".
- Referencia de entrenamiento para la telemetría de Data Drift (PSI/KS).
- Endurecimiento adicional: rol de base de datos con permisos mínimos, límite de peticiones por IP en el proxy, migraciones versionadas (Alembic).
