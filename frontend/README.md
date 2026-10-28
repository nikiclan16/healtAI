# healthAI — Frontend

SPA en React + TypeScript + Vite + Tailwind. Estado actual: **estructura inicial funcional en modo demo** (datos simulados).

## Inicio rápido

```bash
npm install
cp .env.example .env     # VITE_API_MODE=mock por defecto
npm run dev              # http://localhost:5173
```

Usuarios de prueba (solo demo): ver `src/services/mock/users.ts`. En la pantalla de nueva evaluación, el botón **Recargar Valores Anexo E** rellena el formulario con el caso del prototipo (resultado esperado: Ruta A con R2, R4 y R5).

## Qué incluye

| Módulo | Estado |
|---|---|
| Login con rol operativo, sede, sesión de 8 h, rutas protegidas, RBAC en UI | Hecho (auth simulada) |
| Formulario en 3 secciones (sliders V8 y WHO-5, selects, ítem 21) con validación zod y completitud | Hecho |
| WHO-5 y DASS-21 capturados como totales (como el mockup) | Hecho (ítems individuales pendientes) |
| Motor de reglas R1–R5 + seguridad (con pruebas) | Hecho (umbrales por validar) |
| Resultado: P(RA), confianza, Top 3 SHAP, reglas, acciones por ruta, disclaimer | Hecho (modelo simulado) |
| Decisión humana (confirmar / rechazar / ajustar) | Hecho (local) |
| Exportar PDF | `window.print()` (CSS de impresión básico) |
| Panel de investigador | Placeholder |
| **Administración** (`/admin`): login de admin, alta de usuarios y roles | Hecho (requiere el backend) |
| Adapters `http` | Esqueleto: contrato **provisional** |

## Administración de usuarios y roles

URL: **`/admin/login`** (sesión propia de 60 min, separada del portal clínico). Requiere el backend en marcha (`docker compose up -d --build` en la raíz). Desde ahí el administrador:

- crea **roles operativos** (p. ej. "Trabajo Social") con un perfil base (Evaluador o Investigador);
- crea **usuarios**, les asigna roles y sedes, y les genera una contraseña inicial que se muestra una sola vez;
- edita, desactiva/activa y restablece contraseñas.

Para que el portal clínico (`/login`) use esos usuarios y roles reales, active la autenticación real sin tocar el resto del demo:

```bash
echo "VITE_AUTH_MODE=http" > .env.local   # y VITE_API_BASE_URL si la API no está en http://localhost:8000
```

El administrador inicial lo define `ADMIN_EMAIL` / `ADMIN_PASSWORD` en el `.env` de la raíz.

## Conectar el backend real

1. `VITE_API_MODE=http` y `VITE_API_BASE_URL=<url>` en `.env`.
2. Ajustar `src/services/http/model.ts` al contrato real de `POST /predecir` (y `auth.ts`, `evaluations.ts`).
3. Si cambian las variables del modelo, actualizar `buildModelInput` en `src/services/contract.ts`.

Más contexto y reglas del proyecto en [`CLAUDE.md`](CLAUDE.md).

## Scripts

`npm run dev` · `npm run test:run` · `npm run lint` · `npm run build` · `npm run typecheck`
