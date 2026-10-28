#!/usr/bin/env bash
# Actualiza y reinicia el backend de healthAI en el servidor (pm2). Desde la raíz del repo:
#   ./deploy/deploy-backend.sh
# La primera vez: cree .env.production (deploy/env.production.example) y la base (deploy/setup-db.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.production ] || { echo "Falta .env.production (ver deploy/env.production.example)" >&2; exit 1; }
[ -f backend/model_artifacts/model.json ] || echo "AVISO: no hay backend/model_artifacts/model.json; la API responderá 503 en inferencia." >&2

git pull --ff-only

[ -d backend/venv ] || python3 -m venv backend/venv
backend/venv/bin/pip install --quiet --upgrade pip
backend/venv/bin/pip install --quiet -r backend/requirements.txt

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

PORT="$(grep -E '^BACKEND_PORT=' .env.production | cut -d= -f2- || true)"
sleep 4
curl -fsS "http://127.0.0.1:${PORT:-8010}/salud" && echo
echo "Si hay scripts nuevos en infra/db/migrations/, aplíquelos antes de usar la nueva versión (ver DEPLOY.md)."
