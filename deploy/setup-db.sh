#!/usr/bin/env bash
# Crea la base de datos de healthAI en un PostgreSQL ya instalado en el servidor y carga el esquema.
# Ejecutar UNA vez, desde la raíz del repo, con un usuario que pueda usar `sudo -u postgres`:
#   DB_PASS='una-contraseña-larga' ./deploy/setup-db.sh
# Requiere PostgreSQL 12+ (probado en 12 y 16) con las extensiones pgcrypto y citext (Debian/Ubuntu: postgresql-contrib).
# Las extensiones se crean como superusuario (en PostgreSQL 12 solo un superusuario puede); el esquema lo carga el
# usuario de la aplicación, así que ya queda como propietario de todas las tablas (no hace falta cambiar dueños).
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-healthai}"
DB_USER="${DB_USER:-healthai}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
: "${DB_PASS:?Defina DB_PASS con la contraseña del usuario de la base de datos}"

psql_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }

if psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  echo "La base '${DB_NAME}' ya existe: no se toca." >&2
  exit 1
fi

psql_admin -v dbuser="$DB_USER" -v dbname="$DB_NAME" -v dbpass="$DB_PASS" <<'SQL'
CREATE ROLE :"dbuser" LOGIN PASSWORD :'dbpass';
ALTER ROLE :"dbuser" SET client_encoding TO 'utf8';
ALTER ROLE :"dbuser" SET default_transaction_isolation TO 'read committed';
ALTER ROLE :"dbuser" SET timezone TO 'America/Bogota';
CREATE DATABASE :"dbname" OWNER :"dbuser";
SQL
psql_admin -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;"

PGPASSWORD="$DB_PASS" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f infra/db/init/01_schema.sql

echo "Listo. DATABASE_URL=postgresql+psycopg://${DB_USER}:<DB_PASS>@${DB_HOST}:${DB_PORT}/${DB_NAME}"
