# healthAI frontend — guía para Claude Code

Frontend del proyecto healthAI (CUC, convenio 112721-224-2025). Lee `../README.md` y `../README_CORTO_PLAZO.md` antes de cambiar nada.

## Comandos

```bash
npm run dev         # servidor de desarrollo (modo mock por defecto)
npm run test:run    # pruebas (Vitest)
npm run lint        # oxlint
npm run build       # tsc -b + vite build
```

Una tarea no está terminada hasta que `lint`, `test:run` y `build` pasan.

## Reglas no negociables (seguridad clínica)

1. `nivel_riesgo_amputacion` (ADA/IWGDF) **nunca** se envía al modelo. Solo `buildModelInput()` en `src/services/contract.ts` arma la entrada del modelo; no construir payloads a mano.
2. El `<Disclaimer />` debe verse en toda pantalla autenticada y en el PDF (RF05.3). No quitarlo del `Layout`.
3. La regla de seguridad (`SEG`) fuerza Ruta A y no se puede degradar a B desde la UI (`DecisionPanel`).
4. Sin datos reales de pacientes. El formulario NO captura ningún identificador: el código seudonimizado (`PAC-AAAA-NNNN`) lo genera el sistema al guardar (en modo `http`, el servidor).
5. Los umbrales clínicos viven en `src/rules/config.ts`, no en componentes. Cambiarlos requiere validación del referente clínico.
6. El portal de acceso muestra el selector de **rol operativo** (como el mockup), pero el servidor valida que el usuario lo tenga asignado y decide el perfil RBAC. Nunca confiar en el rol que declara el cliente.

## Arquitectura

- `src/services/` — **las pantallas nunca usan `fetch`**; importan `services` de `@/services`.
  - `interfaces.ts`: contratos (`AuthService`, `ModelService`, `EvaluationService`).
  - `mock/` (demo, `VITE_API_MODE=mock`) y `http/` (backend real, `VITE_API_MODE=http`).
  - **Cuando llegue el contrato real de `POST /predecir`, el único archivo a ajustar es `http/model.ts`** (`toRequestBody`/`RawPredict`/`toPredictResponse`) y, si cambian las variables, `buildModelInput` en `contract.ts`.
- `src/rules/` — motor R1–R5 + seguridad: funciones puras, sin React ni I/O, con pruebas. Se reemplazará por la API de `motor_reglas.py`.
- `src/services/contract.ts` — esquema zod = única fuente de validación de rangos.
- `src/features/<módulo>/` — auth, screening, results, decision, dashboard, investigator.
- `src/components/` — Layout, Disclaimer, VersionBadge, ui.

## Convenciones

- TypeScript estricto; `erasableSyntaxOnly` (sin `enum` ni parameter properties).
- Alias `@/` → `src/`. Imports de tipos con `import type`.
- Texto de interfaz en español; nombres de código en inglés salvo el vocabulario del diccionario de datos (V8, V9…).
- Tailwind v4 con la paleta `cuc-*` definida en `src/index.css`.
- Toda lógica clínica nueva trae su prueba (tabla de verdad) antes de conectarse a la UI.
- Una tarea = una rama = un commit pequeño.

## Pendientes conocidos

- El formulario captura WHO-5 y subescalas DASS-21 como **totales** (sliders / campos numéricos) y el ítem 21 como desplegable, igual que el mockup. La especificación RF02.2 pide los 21 ítems individuales: pendiente de decidir con el equipo clínico.
- Contrato real de `/predecir`, `/auth/login`, `/evaluaciones`.
- Validación clínica de umbrales (`rules/config.ts`).
- Decidir cuántos roles hay (2 perfiles vs. 4 cargos).
