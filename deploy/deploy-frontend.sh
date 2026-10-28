#!/usr/bin/env bash
# Compila el front en TU equipo y lo sube al servidor (no hace falta Node allá). Desde la raíz del repo:
#   SERVER=usuario@IP_DEL_SERVIDOR ./deploy/deploy-frontend.sh
# Sin SERVER solo compila: suba entonces el contenido de frontend/dist/ como siempre (scp, WinSCP, gcloud…).
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-healtai.jmdatalabs.co}"
REMOTE_DIR="${REMOTE_DIR:-/home/gestionacademicasoft/apps/frontend/healtai}"

cd frontend
npm ci
# La API vive bajo /api en el mismo dominio.
VITE_API_BASE_URL="https://${DOMAIN}/api" npm run build

if [ -z "${SERVER:-}" ]; then
  echo "Compilado en frontend/dist/. Defina SERVER=usuario@host para subirlo."
  exit 0
fi

case "$REMOTE_DIR" in /home/*/apps/frontend/*) ;; *) echo "REMOTE_DIR inesperado: $REMOTE_DIR" >&2; exit 1 ;; esac
# Nunca vaciar una carpeta que contenga el repo o código del backend (nginx serviría su contenido).
tar -C dist -cf - . | ssh "$SERVER" "mkdir -p '$REMOTE_DIR' \
  && { [ ! -e '$REMOTE_DIR/.git' ] && [ ! -d '$REMOTE_DIR/backend' ] || { echo 'Ese directorio contiene el repo/backend: use una carpeta solo para el front' >&2; exit 1; }; } \
  && find '$REMOTE_DIR' -mindepth 1 -delete && tar -C '$REMOTE_DIR' -xf -"
echo "Front publicado en ${REMOTE_DIR} → https://${DOMAIN}"
