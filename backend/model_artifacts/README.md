# Artefacto del modelo

El backend **no incluye el modelo entrenado**: lo lee de un archivo JSON. Sin un artefacto válido, `/predecir` y `/evaluaciones` responden **503** (nunca inventan una predicción) y `/salud` informa `modelo: no_configurado`.

| Archivo | Uso |
|---|---|
| `model.placeholder.json` | Valores de ejemplo para desarrollo y pruebas. Solo se carga con `ALLOW_PLACEHOLDER_MODEL=true`. **No es clínico.** |
| `model.json` | El modelo real. Está en `.gitignore`: se instala en el servidor (volumen o copia segura), no se sube al repo. |

La ruta se configura con `MODEL_ARTIFACT_PATH` (por defecto `model_artifacts/model.json`).

## Formato

```json
{
  "version": "v1.0.0",
  "umbral": 0.5,
  "intercepto": 0.0,
  "features": ["hipertension", "who5_total", "..."],
  "pesos":  [0.0, 0.0],
  "media":  [0.0, 0.0],
  "escala": [1.0, 1.0],
  "etiquetas": { "hipertension": "Comorbilidad: hipertensión" }
}
```

- `features`: nombres del catálogo de `app/modelo/features.py`, **en el mismo orden** que se usó al entrenar.
- `pesos`, `media`, `escala`: un valor por variable (`coef_`, `mean_` y `scale_` del estandarizador).
- `etiquetas` es opcional (nombre legible en la explicación SHAP).
- El nivel de riesgo de amputación ADA/IWGDF no existe en el catálogo a propósito (RF02.4).

## Generarlo desde scikit-learn

```python
import json
json.dump({
    "version": "v1.0.0",
    "umbral": 0.5,
    "intercepto": float(modelo.intercept_[0]),
    "features": FEATURES_EN_ORDEN,
    "pesos": modelo.coef_[0].tolist(),
    "media": scaler.mean_.tolist(),
    "escala": scaler.scale_.tolist(),
}, open("model.json", "w"), indent=2)
```

Si el modelo usa una variable que no está en el catálogo, agréguela en `app/modelo/features.py` (y en el contrato del formulario si hace falta).
