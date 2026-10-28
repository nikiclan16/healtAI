# healthAI · Despliegue en el servidor (nginx + pm2)

Dominio: **https://healtai.jmdatalabs.co** (front y API en el mismo dominio; la API bajo `/api/`).
No usa Docker: el backend corre con pm2 y el front es estático servido por nginx, como las demás aplicaciones del servidor.

```
/home/gestionacademicasoft/apps/
├── backend/healtai/      ← el repo clonado (pm2 corre backend/ desde aquí)
└── frontend/healtai/     ← solo el contenido de frontend/dist (nginx)
```

> **Importante:** no clone el repo dentro de la carpeta del front. nginx sirve esa carpeta completa como sitio público y expondría el código y `.env.production`. El repo va en `apps/backend/healtai`; en `apps/frontend/healtai` solo van los archivos compilados.

## Requisitos del servidor

- nginx y certbot (ya los usan las otras aplicaciones), pm2 (con `pm2 startup` configurado).
- **Python 3.10 o superior** (probado en 3.12). Ubuntu 20.04 trae 3.8, que no sirve: instale una versión nueva **en paralelo** (no cambia el `python3` del sistema ni afecta a las otras apps), ver más abajo.
- PostgreSQL 12 o superior con `postgresql-contrib` (extensiones `pgcrypto` y `citext`). Probado en 12 y 16.
- El DNS de `healtai.jmdatalabs.co` apuntando a la IP del servidor.

## Servidor compartido: qué toca cada paso

El servidor ya aloja otras aplicaciones. Esta instalación está pensada para no modificarlas:

| Paso | Qué cambia | Qué NO toca |
|---|---|---|
| Python 3.12 con `uv` | Solo `~/.local` del usuario | Paquetes del sistema, `python3` (3.8) |
| Base de datos | Una base y un rol **nuevos** | Las bases y roles existentes |
| pm2 | Un proceso nuevo: `healthai-api` | Los otros procesos (no se usa `pm2 save`, `pm2 startup` ni `pm2 restart all`) |
| nginx | Un archivo nuevo + `reload` (no `restart`) | Los otros sitios; `nginx -t` valida antes y, si falla, no se recarga |
| certbot | El bloque de este dominio | Los demás certificados |
| Front y backend | Carpetas propias `healtai` | Las carpetas de otras apps |

Comprobaciones previas (solo leen, no cambian nada):

```bash
ss -ltnp | grep ':8010 ' || echo "puerto 8010 libre"
sudo -u postgres psql -c '\l'
sudo grep -rn "healthai" /etc/nginx/ || echo "sin choques de nombres en nginx"
free -h
pm2 list
dig +short healtai.jmdatalabs.co
```

Si algo falla o se quiere deshacer todo: `pm2 delete healthai-api`, quitar el enlace de `sites-enabled` y `sudo systemctl reload nginx`, y borrar la base y el rol (`DROP DATABASE`, `DROP ROLE`) y las dos carpetas `healtai`.

## Primera vez

**1. Clonar el repo**

```bash
cd /home/gestionacademicasoft/apps/backend
git clone https://github.com/nikiclan16/healtAI.git healtai
cd healtai
```

**2. Instalar Python 3.12 en paralelo** (una sola vez)

Opción recomendada en un servidor compartido: `uv` instala Python solo en la carpeta del usuario, sin `sudo` ni `apt`.

```bash
curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh
```

```bash
less /tmp/uv-install.sh        # revíselo si quiere; salga con q
```

```bash
UV_NO_MODIFY_PATH=1 sh /tmp/uv-install.sh && ~/.local/bin/uv python install 3.12
```

```bash
~/.local/bin/uv python find 3.12     # imprime la ruta del Python 3.12; se usa como PYTHON= en el paso 6
```

Alternativa con `apt` (añade un repositorio al sistema): `sudo add-apt-repository ppa:deadsnakes/ppa && sudo apt update && sudo apt install python3.12 python3.12-venv`. No cambia `python3`, pero sí la lista de repositorios.

**3. Crear la base de datos** (una sola vez; usa `sudo -u postgres`)

```bash
DB_PASS='una-contraseña-larga-y-aleatoria' ./deploy/setup-db.sh
```

**4. Configuración**

```bash
cp deploy/env.production.example .env.production
chmod 600 .env.production
nano .env.production      # DATABASE_URL, SECRET_KEY (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
```

**5. Modelo entrenado** (cuando el equipo lo entregue)

```bash
# desde su PC
scp model.json usuario@servidor:/home/gestionacademicasoft/apps/backend/healtai/backend/model_artifacts/model.json
```

Sin ese archivo la API arranca, pero `/predecir` y `/evaluaciones` responden 503 y `/api/salud` dice `degradado`. Es a propósito: nunca inventa una predicción.

**6. Levantar el backend**

```bash
PYTHON="$(~/.local/bin/uv python find 3.12)" ./deploy/deploy-backend.sh
```

Crea el entorno virtual, instala dependencias, inicia `healthai-api` en pm2 (`127.0.0.1:8010`) y consulta `/salud`. Si el puerto 8010 estuviera ocupado (`ss -ltnp | grep 8010`), cambie `BACKEND_PORT` en `.env.production` **y** el `proxy_pass` del archivo de nginx.

**7. nginx y HTTPS**

```bash
sudo cp -a /etc/nginx /etc/nginx.bak-$(date +%F)     # copia de seguridad, por si acaso
sudo cp deploy/nginx/healtai.jmdatalabs.co.conf /etc/nginx/sites-available/healtai.jmdatalabs.co
sudo ln -s /etc/nginx/sites-available/healtai.jmdatalabs.co /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx     # si nginx -t falla NO recargue: quite el enlace y avíseme
sudo certbot --nginx -d healtai.jmdatalabs.co
```

El archivo ya limita los intentos de ingreso por IP (10 por minuto, responde 429), admite lotes de hasta 5 MB y cachea los archivos con hash.

**8. Publicar el front** (desde su PC, en la raíz del repo; no hace falta Node en el servidor)

```bash
SERVER=usuario@IP_DEL_SERVIDOR ./deploy/deploy-frontend.sh
```

Compila con `VITE_API_BASE_URL=https://healtai.jmdatalabs.co/api` y sube `dist/` a `apps/frontend/healtai`. Si prefiere subirlo a mano, ejecute el script sin `SERVER` y copie el contenido de `frontend/dist/`.

**9. Verificar**

- `https://healtai.jmdatalabs.co/api/salud` → `{"status": ...}` (`ok` solo con el modelo real instalado).
- `https://healtai.jmdatalabs.co/admin/login` → ingrese con `ADMIN_EMAIL`/`ADMIN_PASSWORD`, **cambie la contraseña** y cree roles y usuarios.
- Luego borre `ADMIN_PASSWORD` de `.env.production` y ejecute `pm2 restart healthai-api --update-env`.

> Para una prueba de humo antes de tener el modelo puede añadir `ALLOW_PLACEHOLDER_MODEL=true` a `.env.production`. La aplicación mostrará "MODELO DE PRUEBA". **Nunca con pacientes reales**; quite la línea al instalar el modelo.

## Actualizar

```bash
# backend (en el servidor, desde la raíz del repo; el venv ya existe, no hace falta PYTHON)
./deploy/deploy-backend.sh

# front (desde su PC)
SERVER=usuario@IP_DEL_SERVIDOR ./deploy/deploy-frontend.sh
```

Si la versión nueva trae scripts en `infra/db/migrations/`, aplíquelos antes: `psql "postgresql://healthai:CLAVE@127.0.0.1:5432/healthai" -f infra/db/migrations/<script>.sql`.

## Operación

```bash
pm2 logs healthai-api        # registros
pm2 restart healthai-api --update-env
```

Respalde la base con `pg_dump` (la bitácora de auditoría está encadenada: no la restaure parcialmente). Más detalle y pendientes en [`../DEPLOY.md`](../DEPLOY.md).
