# healthAI — Frontend

SPA en React + TypeScript + Vite + Tailwind. Estado actual: **estructura inicial funcional en modo demo** (datos simulados).

## Inicio rápido

```bash
npm install
cp .env.example .env     # VITE_API_MODE=mock por defecto
npm run dev              # http://localhost:5173
```

Usuarios de prueba (solo demo): ver `src/services/mock/users.ts`. En la pantalla de nueva evaluación, el botón **Cargar caso Anexo E** rellena el formulario con el caso del prototipo (resultado esperado: Ruta A con R2, R4 y R5).

## Qué incluye

| Módulo | Estado |
|---|---|
| Login, selección de sede, sesión de 8 h, rutas protegidas, RBAC en UI | Hecho (auth simulada) |
| Formulario de 4 pasos con validación zod y completitud | Hecho |
| WHO-5 (5 ítems) y DASS-21 (21 ítems) con totales y subescalas | Hecho (texto DASS pendiente) |
| Motor de reglas R1–R5 + seguridad (con pruebas) | Hecho (umbrales por validar) |
| Resultado: P(RA), confianza, Top 3 SHAP, reglas, acciones por ruta, disclaimer | Hecho (modelo simulado) |
| Decisión humana (confirmar / rechazar / ajustar) | Hecho (local) |
| Exportar PDF | `window.print()` (CSS de impresión básico) |
| Panel de investigador | Placeholder |
| Adapters `http` | Esqueleto: contrato **provisional** |

## Conectar el backend real

1. `VITE_API_MODE=http` y `VITE_API_BASE_URL=<url>` en `.env`.
2. Ajustar `src/services/http/model.ts` al contrato real de `POST /predecir` (y `auth.ts`, `evaluations.ts`).
3. Si cambian las variables del modelo, actualizar `buildModelInput` en `src/services/contract.ts`.

Más contexto y reglas del proyecto en [`CLAUDE.md`](CLAUDE.md).

## Scripts

`npm run dev` · `npm run test:run` · `npm run lint` · `npm run build` · `npm run typecheck`
