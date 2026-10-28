// pm2 para el backend de healthAI (FastAPI). Uso, desde la raíz del repo en el servidor:
//   pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save
//
// El backend solo lee variables de entorno (no el archivo .env): aquí se cargan desde
// .env.production, en la raíz del repo, que NO está en git (ver deploy/env.production.example).
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BACKEND = path.join(ROOT, 'backend')

function loadEnv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Falta ${file}. Cópielo de deploy/env.production.example y complete los valores.`)
  }
  const env = {}
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const env = loadEnv(path.join(ROOT, '.env.production'))
const port = env.BACKEND_PORT || '8010'

module.exports = {
  apps: [
    {
      name: 'healthai-api',
      cwd: BACKEND,
      script: path.join(BACKEND, 'venv', 'bin', 'uvicorn'),
      args: `app.main:app --host 127.0.0.1 --port ${port}`,
      interpreter: 'none', // uvicorn es un script del entorno virtual, no de Node
      env,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      time: true,
    },
  ],
}
