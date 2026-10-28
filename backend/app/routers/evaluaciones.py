import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..deps import current_clinical, current_evaluator
from ..modelo.component import ComponenteEstratificacionSaludMental
from ..modelo.registro import get_modelo
from ..schemas_clinicos import DecisionIn, ScreeningFormIn
from ..servicios import evaluacion as svc

router = APIRouter(tags=["evaluaciones"])


@router.post("/predecir")
def predecir(
    form: ScreeningFormIn,
    _user: dict = Depends(current_clinical),
    modelo: ComponenteEstratificacionSaludMental = Depends(get_modelo),
):
    """RF03.1 — inferencia pura: probabilidad, ruta base y Top 3 SHAP. No aplica reglas ni guarda nada."""
    prediccion, _ = svc.predecir(modelo, form)
    return prediccion


@router.post("/evaluaciones", status_code=201)
def crear_evaluacion(
    form: ScreeningFormIn,
    user: dict = Depends(current_evaluator),
    modelo: ComponenteEstratificacionSaludMental = Depends(get_modelo),
    db: Session = Depends(get_db),
):
    """Inferencia + reglas + registro (con sede, profesional y versiones) + bitácora (RF01.2, RNF01.3)."""
    sede = user["sede"]
    autorizado = db.execute(
        text("SELECT 1 FROM user_sites WHERE user_id = :u AND site_code = :s"), {"u": user["id"], "s": sede}
    ).first()
    if not sede or autorizado is None:
        raise HTTPException(403, "El usuario no está autorizado en la sede de su sesión")

    r = svc.ejecutar(modelo, form)
    evaluation_id = db.execute(
        text(
            "INSERT INTO evaluations (site_code, user_id, cargo, formulario, entrada_modelo, prediccion, reglas, "
            "probabilidad_ra, ruta_base, ruta_sistema, escalada, reglas_activadas, "
            "version_app, version_modelo, version_diccionario) "
            "VALUES (:site, :user, :cargo, CAST(:formulario AS jsonb), CAST(:entrada AS jsonb), "
            "CAST(:prediccion AS jsonb), CAST(:reglas AS jsonb), :prob, :base, :ruta, :escalada, "
            "CAST(:activadas AS text[]), :v_app, :v_modelo, :v_dic) RETURNING id"
        ),
        {
            "site": sede,
            "user": user["id"],
            "cargo": user["cargo"],
            "formulario": json.dumps(form.model_dump()),
            "entrada": json.dumps(r["entrada"]),
            "prediccion": json.dumps(r["prediccion"]),
            "reglas": json.dumps(r["reglas"]),
            "prob": r["prediccion"]["probabilidadRA"],
            "base": r["prediccion"]["rutaBase"],
            "ruta": r["rutaSistema"],
            "escalada": r["escalada"],
            "activadas": "{" + ",".join(x["code"] for x in r["reglas"]["triggered"]) + "}",
            "v_app": r["versiones"]["app"],
            "v_modelo": r["versiones"]["modelo"],
            "v_dic": r["versiones"]["diccionario"],
        },
    ).scalar_one()

    audit.log(
        db,
        "inferencia",
        user_id=user["id"],
        site_code=sede,
        evaluation_id=evaluation_id,
        detalle={
            "modelo": r["versiones"]["modelo"],
            "placeholder": r["prediccion"]["modeloPlaceholder"],
            "probabilidad_ra": r["prediccion"]["probabilidadRA"],
            "ruta_base": r["prediccion"]["rutaBase"],
            "ruta_sistema": r["rutaSistema"],
            "escalada": r["escalada"],
            "reglas": [x["code"] for x in r["reglas"]["triggered"]],
        },
    )
    return svc.obtener(db, evaluation_id)


def _visible(db: Session, evaluation_id: UUID, user: dict) -> dict:
    """Un evaluador solo ve las suyas; el investigador puede consultar todas (solo lectura)."""
    ev = svc.obtener(db, evaluation_id)
    if ev is None or (user["rol"] == "evaluador" and ev["profesional"]["id"] != str(user["id"])):
        raise HTTPException(404, "Evaluación no encontrada")
    return ev


@router.get("/evaluaciones")
def listar_evaluaciones(
    limit: int = Query(default=50, ge=1, le=200),
    user: dict = Depends(current_clinical),
    db: Session = Depends(get_db),
):
    return svc.listar(db, user_id=user["id"] if user["rol"] == "evaluador" else None, limit=limit)


@router.get("/evaluaciones/{evaluation_id}")
def obtener_evaluacion(evaluation_id: UUID, user: dict = Depends(current_clinical), db: Session = Depends(get_db)):
    return _visible(db, evaluation_id, user)


@router.post("/evaluaciones/{evaluation_id}/decision", status_code=201)
def registrar_decision(
    evaluation_id: UUID,
    body: DecisionIn,
    user: dict = Depends(current_evaluator),
    db: Session = Depends(get_db),
):
    """RF06 — decisión humana final: etiqueta de referencia para la auditoría de drift. Una por evaluación."""
    ev = _visible(db, evaluation_id, user)
    if "decision" in ev:
        raise HTTPException(409, "La evaluación ya tiene una decisión registrada")
    try:
        db.execute(
            text(
                "INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) "
                "VALUES (:ev, :accion, :ruta, :just, :user)"
            ),
            {"ev": evaluation_id, "accion": body.accion, "ruta": body.ruta_final, "just": body.justificacion.strip(), "user": user["id"]},
        )
    except DBAPIError as exc:
        # Las reglas de negocio (regla de seguridad, justificación, confirmar) las impone la propia BD.
        motivo = getattr(getattr(exc.orig, "diag", None), "message_primary", None) or "Decisión no válida"
        raise HTTPException(422, motivo) from None
    audit.log(
        db,
        "decision",
        user_id=user["id"],
        site_code=ev["sede"],
        evaluation_id=evaluation_id,
        detalle={"accion": body.accion, "ruta_sistema": ev["rutaSistema"], "ruta_final": body.ruta_final},
    )
    return svc.obtener(db, evaluation_id)
