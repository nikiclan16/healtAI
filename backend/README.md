# healthAI · Backend (FastAPI)

API de autenticación, administración de usuarios/roles, inferencia del modelo, motor de reglas, evaluaciones y decisión humana. Usa la PostgreSQL definida en `../infra`.

## Puesta en marcha

Desde la raíz del repo:

```bash
cp .env.example .env                       # cambie las contraseñas y SECRET_KEY
docker compose up -d --build               # base de datos + API en http://127.0.0.1:8000
docker compose run --rm backend pytest     # pruebas de integración (se revierten, no dejan datos)
```

Documentación interactiva (solo desarrollo, la activa `docker-compose.override.yml`): http://127.0.0.1:8000/docs. En producción está cerrada (`ENABLE_DOCS=false`); ver [`../DEPLOY.md`](../DEPLOY.md).

Al arrancar, si no existe ningún administrador activo, se crea uno con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/salud` | público | Estado del servicio (RF03.3) |
| POST | `/predecir` | clínico | Inferencia pura (RF03.1): probabilidad, ruta base y Top 3 SHAP. No aplica reglas ni guarda |
| POST | `/evaluaciones` | evaluador | Tamizaje completo: modelo + reglas R1–R5 + registro con sede, profesional y versiones + bitácora |
| GET | `/evaluaciones`, `/evaluaciones/{id}` | clínico | Evaluador: solo las suyas; investigador: todas (lectura) |
| POST | `/evaluaciones/{id}/decision` | evaluador | Decisión humana final (una por evaluación; RF06) |
| POST | `/lotes` | clínico | Procesamiento por lotes (RF03.2): archivo CSV/XLSX → inferencia + reglas por fila. Solo calcula; no crea evaluaciones. Registra en bitácora el SHA-256 del archivo |
| GET | `/lotes/plantilla` | clínico | Plantilla CSV con las columnas del diccionario |
| GET | `/investigador/metricas` | investigador | Métricas por sede, reglas activadas, concordancia modelo vs. profesional (ventana de 50), integridad de la bitácora |
| GET | `/investigador/evaluaciones.csv`, `/investigador/auditoria.csv` | investigador | Exportaciones (solo código seudonimizado); cada descarga queda en bitácora |
| POST | `/auth/cambiar-password` | clínico | El usuario cambia su propia contraseña (exige la actual) |
| POST | `/admin/cuenta/password` | admin | Ídem para el administrador |
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

## Carga por lotes (RF03.2)

`POST /lotes` (campo `archivo`, `.csv` o `.xlsx`, máx. 5 MB y 2000 filas). Acepta coma, punto y coma o tabulación. La primera fila es la cabecera; las columnas son las del formulario:

`v8_tiempo_diagnostico, v9_tratamiento, v11_hipertension, v11_cardiaca, v11_obesidad, v11_otra, v12_percepcion_salud, v13_apoyo_familiar, v14_actividad_fisica, v15_calidad_sueno, who5_total, dass_depresion, dass_ansiedad, dass_estres, dass_item21` y, opcionales (por defecto sin alerta), `alerta_riesgo_suicida, alerta_deterioro_agudo, alerta_riesgo_urgente`.

- Booleanos: `1/0`, `sí/no`, `true/false`. `dass_item21` vacío = no evaluable (activa R1).
- **Una columna desconocida rechaza todo el archivo** (422): así no entran identificadores (cédula, nombre…) ni el nivel de riesgo de amputación.
- Las filas inválidas no detienen el lote: se devuelven con su número de fila y el motivo.
- Los nombres de columna son provisionales hasta contar con el Diccionario de Datos v2.1 oficial: se cambian en un solo lugar (`app/servicios/lote.py`, `COLUMNAS`).

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
- Las cuentas creadas o restablecidas por un administrador quedan con contraseña **temporal**: el usuario debe cambiarla al ingresar y, mientras no lo haga, el servidor le niega toda operación (403), no solo la interfaz.
- Todo intento de ingreso y toda acción de administración queda en la bitácora encadenada (sin contraseñas).
- Un administrador no puede desactivar su propia cuenta.

## Pendiente

- Modelos retadores (KNN, MLP) para el nivel de confianza, y el artefacto del modelo entrenado real.
- Telemetría de Data Drift (PSI/KS): necesita la distribución de entrenamiento como referencia (el panel del investigador ya muestra la concordancia modelo vs. profesional).
- Rol de base de datos con permisos mínimos, límite de peticiones por IP (en el proxy) y migraciones versionadas.
