# healthAI — Plan de Corto Plazo (Entrega Urgente)

> Complemento del [README.md](README.md) (plan completo de 16 semanas).
> Este documento cubre **solo lo urgente**: **frontend + autenticación + funciones clínicas clave**, desarrollado con Claude Code como asistente que escribe el código.

| | |
|---|---|
| **Objetivo** | Tener una aplicación web funcional y demostrable: login con sedes, formulario clínico validado, resultado con reglas de seguridad y decisión del profesional |
| **Inicio propuesto** | Miércoles 28 de octubre de 2026 |
| **Entrega** | Miércoles 11 de noviembre de 2026 (**10 días hábiles**) |
| **Esfuerzo** | ≈ 10 días de trabajo conjunto humano + Claude |
| **Alcance** | Frontend completo con servicios intercambiables (mock ↔ API real) |
| **Fuera de alcance** | Backend productivo, lotes CSV/XLSX, telemetría PSI/KS, bitácora inmutable, despliegue en producción |

---

## 1. Qué se construye (alcance urgente)

Se prioriza el flujo individual de un profesional, de punta a punta:

```
Login + sede → Formulario (4 pasos) → Predicción → Reglas R1–R5 → Resultado + XAI → Decisión del profesional → PDF
```

| # | Función | Requisito de origen |
|---|---|---|
| 1 | Login, sesión con expiración de 8 h, cierre de sesión, rutas protegidas | RF01.1 |
| 2 | Selección de sede (BAQ / RHA / VUP) ligada a cada evaluación | RF01.2 |
| 3 | Rol visible y menús según perfil (Evaluador / Investigador) | RF01.1 |
| 4 | Formulario por pasos: Datos clínicos → Hábitos → WHO-5 → DASS-21, con indicador de completitud | RF02.1, RF02.2, RNF03.2 |
| 5 | Validación en tiempo real de rangos (contrato de datos) y bloqueo de envío incompleto | RF02.3 |
| 6 | Cálculo automático de WHO-5 (bruto 0–25 y %) y subescalas DASS-21 (0–21) | RF02.2 |
| 7 | Motor de reglas R1–R5 + regla de seguridad (módulo aislado y con pruebas) | RF05.1 |
| 8 | Resultado: P(RA), ruta base/final, nivel de confianza, Top 3 SHAP, reglas disparadas | RF04.1–RF04.3 |
| 9 | Acciones diferenciadas Ruta A / Ruta B y **disclaimer permanente** | RF05.2, RF05.3 |
| 10 | Confirmar / rechazar / ajustar ruta (human-in-the-loop) | RF06.1 |
| 11 | Exportar / imprimir PDF del tamizaje | RNF03.3 |
| 12 | Versiones visibles (sistema, modelo v1.0.0, diccionario v2.1) y diseño responsivo CUC | RNF04.1, RNF03.1 |

**Reglas que no se negocian** (aunque sea urgente):
- `Nivel_de_Riesgo` (ADA/IWGDF) **nunca** va en el payload al modelo (RF02.4).
- El disclaimer aparece en toda pantalla de reporte y en el PDF (RF05.3).
- La regla de seguridad no puede ser anulada por el software; el profesional solo ajusta *después* de ver la alerta (RF05.1, RF06.1).
- **No usar datos reales de pacientes** hasta tener backend seguro, HTTPS y aprobaciones de datos (Ley 1581/2012).

## 2. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Base | React 18 + TypeScript + Vite | Rápido de iniciar, tipado ayuda a Claude a no romper el contrato |
| Estilos | Tailwind con la paleta CUC del prototipo (`#0C2340`, `#005696`, `#008558`, `#E63946`) | Continuidad con el diseño aprobado |
| Formularios | react-hook-form + **zod** | El esquema zod *es* el contrato de datos (rangos, binarios, Likert) |
| Rutas / estado | React Router + Zustand | Simple, sin sobreingeniería |
| Gráficos | Chart.js (`react-chartjs-2`) | Ya usado en el prototipo para SHAP |
| Pruebas | Vitest + Testing Library; Playwright para el flujo E2E | Pruebas pegadas a cada tarea |
| PDF | `window.print()` con CSS de impresión | Suficiente para corto plazo; en servidor llegará con el backend |

### Capa de servicios intercambiable (clave para ir rápido sin backend)

El frontend nunca llama directamente a `fetch`; usa interfaces con dos implementaciones, elegidas por variable de entorno (`VITE_API_MODE=mock|http`):

| Servicio | Modo `mock` (inmediato) | Modo `http` (cuando exista backend) |
|---|---|---|
| `AuthService` | Usuarios de prueba, token simulado de 8 h | `POST /auth/login` con JWT real |
| `ModelService` | Respuesta determinística tipo "Caso Anexo E" | `POST /predecir` y `GET /salud` |
| `EvaluationService` | Guarda decisiones en `localStorage` | `POST /evaluaciones` y `/decision` |

> **Advertencia de seguridad:** la autenticación en modo `mock` es solo para demo. Un login en el navegador **no protege nada**; la autenticación real, el RBAC y la bitácora requieren el backend (fase siguiente, §8).

### Motor de reglas en el frontend (solución temporal)
`RF05` y RNF04.3 piden el motor de reglas desacoplado (`motor_reglas.py`). Para el corto plazo se implementa como **módulo TypeScript puro** (`src/rules/`) detrás de una interfaz `RulesService`, con los umbrales en un archivo de configuración. Al llegar el backend se sustituye por la llamada al motor Python **sin tocar las pantallas**. Evitar tener dos versiones de la lógica en producción.

Cortes DASS-21 (puntaje bruto por subescala) usados por defecto — **deben ser validados por el referente clínico**:

| Nivel | Depresión | Ansiedad | Estrés |
|---|---|---|---|
| Normal | 0–4 | 0–3 | 0–7 |
| Leve | 5–6 | 4–5 | 8–9 |
| Moderado | 7–10 | 6–7 | 10–12 |
| Severo | 11–13 | 8–9 | 13–16 |
| Extremadamente severo | ≥ 14 | ≥ 10 | ≥ 17 |

Equivalencias de WHO-5: R3 (≤ 28 %) ⇒ bruto ≤ 7; marcador de R5 (< 52 %) ⇒ bruto ≤ 12.

## 3. Estructura propuesta

```
healthAI/
├── README.md
├── README_CORTO_PLAZO.md
└── frontend/
    ├── src/
    │   ├── app/            # rutas, layout, guards
    │   ├── features/
    │   │   ├── auth/       # login, sesión, selector de sede
    │   │   ├── screening/  # stepper, pasos, schema zod
    │   │   ├── results/    # P(RA), confianza, SHAP, acciones por ruta
    │   │   └── decision/   # confirmar / rechazar / ajustar, historial
    │   ├── rules/          # motor R1–R5 (puro) + config de umbrales + tests
    │   ├── services/       # interfaces + adapters mock/http
    │   ├── components/     # Disclaimer, VersionBadge, UI base
    │   └── config/         # versiones (v1.0.0 / v2.1), sedes, roles
    └── CLAUDE.md           # convenciones para Claude Code
```

## 4. Plan de trabajo y tiempos

> **Día de trabajo** = jornada conjunta: Claude genera y prueba el código, tú revisas, ejecutas y validas. Las estimaciones suponen que cuentas con los insumos de §7 desde el día 1.

| Tarea | Descripción | Aceptación | Estimado | Días |
|---|---|---|---|---|
| **T0** Base del proyecto | Scaffold Vite/TS/Tailwind, tema CUC, layout con cabecera, pie, versiones y disclaimer, lint y CI básico | `npm run dev/build/test` funcionan; versiones y disclaimer visibles | 0,5 d | D1 |
| **T1** Autenticación | Pantalla de login, selección de sede, sesión de 8 h, guards de ruta, menú por rol, logout, aviso de expiración | Sin sesión no se accede a nada; la sede queda ligada a la sesión; expira a las 8 h | 1,5 d | D1–D2 |
| **T2** Servicios y contrato | Tipos TS, esquema zod del contrato, interfaces + adapters `mock`/`http` | Un valor fuera de rango es rechazado por el esquema; cambiar de modo no altera pantallas | 1 d | D3 |
| **T3** Formulario clínico | Stepper de 4 pasos, ítems individuales WHO-5 (5) y DASS-21 (21), totales automáticos, ítem 21 destacado, completitud, alertas de rango | No se puede enviar incompleto; V8 0–80, Likert 1–5, V14 0–3, DASS 0–3 por ítem | 2,5 d | D4–D6 |
| **T4** Motor de reglas | Funciones puras R1–R5 + regla de seguridad, config de umbrales, tabla de verdad en pruebas | Pruebas cubren cada regla y casos de borde (ítem 21 "no evaluable" ⇒ R1) | 1 d | D6–D7 |
| **T5** Resultados | P(RA), ruta base y final, confianza, gráfico Top 3 SHAP con dirección, reglas disparadas, acciones por ruta | El caso Anexo E del prototipo reproduce Ruta A con R2, R4 y R5 | 1,5 d | D7–D8 |
| **T6** Decisión humana | Confirmar / rechazar / ajustar con justificación, historial de evaluaciones local | La decisión queda registrada con profesional, sede y marca de tiempo | 0,5 d | D9 |
| **T7** PDF | CSS de impresión del resumen con disclaimer y versiones | El PDF contiene resultado, reglas y disclaimer | 0,5 d | D9 |
| **T8** Cierre | E2E del flujo completo, revisión responsiva (tableta), accesibilidad básica, despliegue de demo estática | Flujo Login → Decisión pasa en Playwright; demo accesible por URL | 1 d | D10 |
| | | **Total** | **10 d** | |

### Calendario

| Día | Fecha | Foco |
|---|---|---|
| D1 | mié 28 oct | T0 + inicio T1 |
| D2 | jue 29 oct | T1 → **Hito 1** |
| D3 | vie 30 oct | T2 |
| D4–D5 | mar 3 – mié 4 nov | T3 (pasos 1–4) |
| D6 | jue 5 nov | Cierre T3 + inicio T4 → **Hito 2** |
| D7 | vie 6 nov | T4 + inicio T5 |
| D8 | lun 9 nov | T5 → **Hito 3** |
| D9 | mar 10 nov | T6 + T7 |
| D10 | mié 11 nov | T8 → **Entrega** |

### Hitos demostrables

| Hito | Fecha | Qué se puede mostrar |
|---|---|---|
| **H1** Acceso | 29 oct | Login, selección de sede, rutas protegidas, menú por rol |
| **H2** Captura | 5 nov | Formulario completo con validación y totales automáticos |
| **H3** Flujo end-to-end | 9 nov | Del formulario al resultado con reglas y XAI (modo mock) |
| **H4** Entrega | 11 nov | Todo lo anterior + decisión del profesional + PDF + demo en URL |

### Si hay que mostrar algo antes (plan exprés, 5 días: 28 oct – 4 nov)
Hacer solo **T0, T1, T2, T3 (sin historial) y una versión básica de T4/T5** (ruta, reglas disparadas y disclaimer; sin gráfico SHAP). Se pospone T6, T7 y T8. Demo con datos de prueba, claramente rotulada como prototipo.

## 5. Cómo trabajaremos con Claude Code

1. **Una tarea = una rama = un commit/PR pequeño.** Tareas T0…T8 de §4, en ese orden.
2. **Archivo `frontend/CLAUDE.md`** con convenciones (estructura, nombres, comandos, reglas no negociables de §1). Claude lo lee al inicio de cada sesión.
3. **Insumos fijos en cada sesión:** este README, el [README.md](README.md), la especificación de requisitos y el prototipo HTML (`interactive_ui_ux_specifications_for_ml_health_platform.html`) como referencia visual.
4. **Pruebas primero en lo crítico:** el motor de reglas y el esquema del contrato se escriben con sus pruebas antes de conectarlos a la interfaz.
5. **Definición de terminado por tarea:** `lint`, `test` y `build` en verde + criterio de aceptación de §4 comprobado a mano por ti.
6. **Revisión humana obligatoria** en: umbrales clínicos, textos médicos y cualquier cambio en reglas de seguridad.

**Plantilla de instrucción por tarea** (ejemplo para T3):

```
Implementa la tarea T3 del README_CORTO_PLAZO.md.
Usa el esquema zod de src/services/contract.ts como única fuente de validación.
Sigue el prototipo HTML para el diseño del paso 1 y 2. Añade pruebas de rango para V8, V12–V15 y los 21 ítems DASS.
No incluyas Nivel_de_Riesgo en ningún payload. Al terminar ejecuta lint, test y build y muéstrame el resultado.
```

## 6. Requisitos de entrada (qué necesito de ti en el día 1)

| Insumo | Para qué | Si no está disponible |
|---|---|---|
| Ejemplo real de respuesta de `POST /predecir` (JSON) y URL del servicio | Definir `ModelService` http | Se asume un formato propio y se ajusta después |
| Usuarios de prueba por rol y sede | Datos del modo mock | Se generan ficticios |
| Logo oficial CUC | Cabecera y PDF | Se usa el marcador "CUC" del prototipo |
| Confirmación de umbrales (DASS-21, WHO-5, R1–R5) | Motor de reglas | Se usan los de §2 marcados como *pendientes de validación* |
| Decisión sobre cuántos roles hay (2 perfiles vs. 4 cargos) | Menú y permisos | Se implementan 2 perfiles |
| Dónde alojar la demo (Vercel, Netlify, servidor CUC) | T8 | Demo local + build estático |

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Login simulado se confunde con seguridad real | Alto | Rótulo "MODO DEMO" visible; prohibido datos reales hasta el backend |
| Formato de `/predecir` distinto al supuesto | Medio | Adapter aislado: cambia un solo archivo |
| Umbrales clínicos incorrectos | Alto | Config separada + validación del referente clínico antes de la demo con médicos |
| Alcance crece ("una función más") | Medio | Lo nuevo entra solo si desplaza algo de §4 |
| Lógica de reglas duplicada (TS y Python) | Medio | TS es temporal; se reemplaza por la API del motor en la fase 2 |

## 8. Qué viene después (fase 2 inmediata)

Para pasar de demo a uso real se necesita, en este orden (≈ 3 a 4 semanas del plan completo):

1. Backend FastAPI con **autenticación y RBAC reales**, contrato de datos con 422 y proxy al modelo.
2. Motor `motor_reglas.py` en servidor y bitácora inmutable.
3. HTTPS, seudonimización y aprobaciones de datos.
4. Cambiar `VITE_API_MODE` a `http` y retirar los adapters mock de producción.

El resto del cronograma (lotes, telemetría PSI/KS, piloto en las 3 sedes) sigue en el [README.md](README.md).

---
> Herramienta de apoyo a la toma de decisiones clínicas. Las recomendaciones automatizadas no reemplazan el juicio profesional ni constituyen diagnóstico clínico.

*Documento generado el 27 de octubre de 2026. Fechas y esfuerzos son estimaciones sujetas a los insumos de §6.*
