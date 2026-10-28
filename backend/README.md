# healthAI · Backend (FastAPI)

API de autenticación, administración de usuarios/roles, inferencia del modelo, motor de reglas, evaluaciones y decisión humana. Usa la PostgreSQL definida en `../infra`.

## Puesta en marcha

Desde la raíz del repo:

```bash
cp .env.example .env                       # cambie las contraseñas y SECRET_KEY
docker compose up -d --build               # base de datos + API en http://127.0.0.1:8000
docker compose run --rm backend pytest     # pruebas de integración (se revierten, no dejan datos)
```

Documentación interactiva: http://127.0.0.1:8000/docs

Al arrancar, si no existe ningún administrador activo, se crea uno con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/salud` | público | Estado del servicio (RF03.3) |
| POST | `/predecir` | clínico | Inferencia pura (RF03.1): probabilidad, ruta base y Top 3 SHAP. No aplica reglas ni guarda |
| POST | `/evaluaciones` | evaluador | Tamizaje completo: modelo + reglas R1–R5 + registro con sede, profesional y versiones + bitácora |
| GET | `/evaluaciones`, `/evaluaciones/{id}` | clínico | Evaluador: solo las suyas; investigador: todas (lectura) |
| POST | `/evaluaciones/{id}/decision` | evaluador | Decisión humana final (una por evaluación; RF06) |
| GET | `/auth/cargos` | público | Roles operativos activos (selector del portal de acceso) |
| POST | `/auth/login` | público | Usuario + contraseña + **rol operativo** + sede; el servidor valida las tres |
| POST | `/admin/auth/login` | público | Acceso de administración (solo cuentas `admin`) |
| GET | `/admin/sedes` | admin | Sedes del estudio |
| GET · POST | `/admin/roles` | admin | Listar / crear roles operativos |
| PATCH | `/admin/roles/{code}` | admin | Renombrar o activar/desactivar un rol |
| GET · POST | `/admin/usuarios` | admin | Listar (`?q=`) / crear usuarios |
| PATCH | `/admin/usuarios/{id}` | admin | Editar nombre, roles, sedes; activar/desactivar; restablecer contraseña |

## Modelo de acceso

- **Perfil (RBAC):** `evaluador`, `investigador` o `admin`. Lo fija el administrador y no se puede cambiar después.
- **Rol operativo (cargo):** Médico, Psicólogo… Lo crea el administrador y hereda un perfil base. Un usuario solo puede ingresar con los roles y sedes que tenga asignados.
- **Tokens:** JWT firmados con `SECRET_KEY`. Audiencias separadas: un token clínico no sirve en `/admin/*` y viceversa. Clínico: 8 h. Administración: 60 min.

## Modelo y reglas

- El backend **no trae el modelo entrenado**: lo lee de `model_artifacts/model.json` (pesos, intercepto y escalador; ver [`model_artifacts/README.md`](model_artifacts/README.md)). **Sin un artefacto válido, `/predecir` y `/evaluaciones` responden 503** y `/salud` informa `status: "degradado"`; nunca se inventa una predicción.
- `model_artifacts/model.placeholder.json` son valores de ejemplo para desarrollo. Solo se carga con `ALLOW_PLACEHOLDER_MODEL=true`, y toda respuesta lo marca (`modeloPlaceholder`), por lo que el frontend muestra el aviso "MODELO DE PRUEBA". **No activar en producción.**
- `app/modelo/component.py` adapta la clase `ComponenteEstratificacionSaludMental` del equipo del modelo (corrige `__init__`, usa variables por nombre y añade SHAP lineal). Su capa de reglas se sacó a `app/reglas/motor_reglas.py` (RNF04.3) con los umbrales del mockup.
- El contrato del formulario (`app/schemas_clinicos.py`) rechaza con 422 cualquier campo no definido: el nivel de riesgo de amputación o un identificador de paciente no pueden entrar.
- La confianza (KNN, MLP, consenso) devuelve `null` hasta conectar los modelos retadores.
- Las reglas de negocio de la decisión (regla de seguridad, justificación, "confirmar") las impone también la base de datos.

## Seguridad implementada

- Contraseñas con bcrypt; política mínima de 10 caracteres con letras y números.
- Bloqueo de 15 min tras 5 intentos fallidos; el administrador lo levanta restableciendo la contraseña.
- Mismo mensaje y tiempo de respuesta para usuario inexistente o contraseña errónea.
- Todo intento de ingreso y toda acción de administración queda en la bitácora encadenada (sin contraseñas).
- Un administrador no puede desactivar su propia cuenta.

## Pendiente

- Modelos retadores (KNN, MLP) para el nivel de confianza, y el artefacto del modelo entrenado real.
- Carga por lotes (RF03.2) y telemetría de drift (PSI/KS).
- Cambio de contraseña por el propio usuario y obligación de cambiarla en el primer ingreso.
- Rol de base de datos con permisos mínimos, límite de peticiones por IP y desactivar `/docs` en producción.
