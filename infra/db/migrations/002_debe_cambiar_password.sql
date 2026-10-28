-- Contraseña temporal: las cuentas creadas o restablecidas por un administrador deben cambiarla al ingresar.
-- Aplicar a una base ya creada con:
--   docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB < infra/db/migrations/002_debe_cambiar_password.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
