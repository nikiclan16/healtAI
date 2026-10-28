from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..deps import current_clinical
from ..modelo.component import ComponenteEstratificacionSaludMental
from ..modelo.registro import get_modelo
from ..servicios import lote

router = APIRouter(prefix="/lotes", tags=["lotes"])


@router.get("/plantilla", response_class=PlainTextResponse)
def plantilla(_user: dict = Depends(current_clinical)):
    """Plantilla CSV con las columnas del diccionario y una fila de ejemplo."""
    return PlainTextResponse(
        "\n".join(lote.PLANTILLA) + "\n",
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="plantilla_lote.csv"'},
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
