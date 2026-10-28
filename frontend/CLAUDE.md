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

1. El nivel de riesgo de amputación (ADA/IWGDF) **no se captura en el formulario** (el mockup no lo trae) y **nunca** se envía al modelo. Solo `buildModelInput()` en `src/services/contract.ts` arma la entrada del modelo; no construir payloads a mano.
2. El `<Disclaimer />` debe verse en toda pantalla autenticada y en el PDF (RF05.3). No quitarlo del `Layout`.
3. La regla de seguridad (`SEG`) fuerza Ruta A y no se puede degradar a B desde la UI (`DecisionPanel`).
4. Sin datos reales de pacientes. El formulario NO captura ningún identificador: el código seudonimizado (`PAC-AAAA-NNNN`) lo genera el sistema al guardar (en modo `http`, el servidor).
5. Los umbrales clínicos viven en `src/rules/config.ts`, no en componentes. Cambiarlos requiere validación del referente clínico.
6. Los roles operativos ya no son una lista fija: los crea el administrador y el login los consulta a `GET /auth/cargos` (`Cargo` es `string`). El portal de acceso muestra el selector de **rol operativo** (como el mockup), pero el servidor valida que el usuario lo tenga asignado y decide el perfil RBAC. Nunca confiar en el rol que declara el cliente.

7. **El modo `mock` es solo para desarrollo.** `config/app.ts` lo desactiva en producción (`import.meta.env.DEV`) y `services/index.ts` enlaza los mocks únicamente en desarrollo, de modo que ni los servicios simulados ni los usuarios de prueba entran al paquete desplegado. No volver a exponer el modo demo en producción.

## Arquitectura

- `src/services/` — **las pantallas nunca usan `fetch`**; importan `services` de `@/services`.
  - `interfaces.ts`: contratos (`AuthService`, `ModelService`, `EvaluationService`).
  - `mock/` (demo, `VITE_API_MODE=mock`) y `http/` (backend real, `VITE_API_MODE=http`).
  - `EvaluationService.submit(form)` → `POST /evaluaciones`: **el servidor** ejecuta modelo, SHAP, reglas y registro; el cliente solo envía las respuestas y muestra el resultado. El contrato del formulario está duplicado en `backend/app/schemas_clinicos.py`: cambiarlos juntos.
  - La confianza puede ser `null` (modelos retadores sin conectar) y `modeloPlaceholder` indica que el backend usa el modelo de prueba: la UI debe mostrarlo.
- `src/rules/` — motor R1–R5 + seguridad: funciones puras con pruebas. **Solo lo usa el modo mock de desarrollo**; en producción las reglas las ejecuta el backend (`backend/app/reglas/motor_reglas.py`). Mantener ambos en sincronía.
- `src/services/contract.ts` — esquema zod = única fuente de validación de rangos.
- `src/features/<módulo>/` — auth, screening, results, decision, dashboard, investigator, **admin** (URL `/admin`, sin modo mock: siempre usa el backend; sesión y token propios).
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
- Validación clínica de umbrales (`rules/config.ts`).
- Decidir cuántos roles hay (2 perfiles vs. 4 cargos).
