#!/usr/bin/env bash
# Actualiza y reinicia el backend de healthAI en el servidor (pm2). Desde la raíz del repo:
#   PYTHON=python3.12 ./deploy/deploy-backend.sh      (PYTHON solo hace falta la primera vez: crea el venv)
# La primera vez: cree .env.production (deploy/env.production.example) y la base (deploy/setup-db.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.production ] || { echo "Falta .env.production (ver deploy/env.production.example)" >&2; exit 1; }
[ -f backend/model_artifacts/model.json ] || echo "AVISO: no hay backend/model_artifacts/model.json; la API responderá 503 en inferencia." >&2

git pull --ff-only

# Python 3.10+ (probado en 3.12). En Ubuntu 20.04 el python3 del sistema es 3.8: use PYTHON=python3.12.
PYTHON="${PYTHON:-python3}"
"$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || {
  echo "Se requiere Python 3.10 o superior. Ej.: PYTHON=python3.12 ./deploy/deploy-backend.sh (ver deploy/README.md)" >&2
  exit 1
}
[ -d backend/venv ] || "$PYTHON" -m venv backend/venv
backend/venv/bin/pip install --quiet --upgrade pip
backend/venv/bin/pip install --quiet -r backend/requirements.txt

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

PORT="$(grep -E '^BACKEND_PORT=' .env.production | cut -d= -f2- || true)"
sleep 4
curl -fsS "http://127.0.0.1:${PORT:-8010}/salud" && echo
echo "Si hay scripts nuevos en infra/db/migrations/, aplíquelos antes de usar la nueva versión (ver DEPLOY.md)."
