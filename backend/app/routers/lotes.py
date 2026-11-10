from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..deps import current_clinical
from ..modelo.component import ComponenteEstratificacionSaludMental
from ..modelo.registro import get_modelo
from ..servicios import lote

router = APIRouter(prefix="/lotes", tags=["lotes"])

PLANTILLAS = Path(__file__).resolve().parent.parent / "plantillas"
_FORMATOS = {
    "csv": ("Formato_sistematizacion.csv", "text/csv; charset=utf-8"),
    "xlsx": ("Formato_sistematizacion.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
}


@router.get("/plantilla")
def plantilla(formato: Literal["csv", "xlsx"] = "csv", _user: dict = Depends(current_clinical)):
    """Formato de sistematización (hoja «Sistematizacion» + diccionario de codificación en el XLSX)."""
    archivo, media_type = _FORMATOS[formato]
    return Response(
        (PLANTILLAS / archivo).read_bytes(),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{archivo}"'},
    )


@router.post("")
def procesar_lote(
    archivo: UploadFile = File(...),
    user: dict = Depends(current_clinical),
    modelo: ComponenteEstratificacionSaludMental = Depends(get_modelo),
    db: Session = Depends(get_db),
):
    """RF03.2 — inferencia y reglas por lote (CSV/XLSX). Solo calcula: no crea evaluaciones ni decisiones.

    Se registra en la bitácora quién lo procesó, con la huella SHA-256 del archivo (integridad)."""
    contenido = archivo.file.read(lote.MAX_BYTES + 1)
    resultado = lote.procesar(modelo, archivo.filename or "lote.csv", contenido)
    audit.log(
        db,
        "lote",
        user_id=user["id"],
        site_code=user.get("sede"),
        detalle={
            "archivo": resultado["archivo"],
            "sha256": resultado["sha256"],
            **resultado["resumen"],
            "modelo": resultado["versiones"]["modelo"],
            "placeholder": resultado["modeloPlaceholder"],
        },
    )
    return resultado
