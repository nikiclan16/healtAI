"""Panel del investigador (solo lectura): métricas agregadas y exportaciones para análisis.

Los datos exportados llevan solo el código seudonimizado del paciente (PAC-AAAA-NNNN); nunca
nombres ni documentos, porque el sistema no los captura.
"""

import csv
import io
import json
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..deps import current_investigator
from ..servicios.lote import COLUMNAS

router = APIRouter(prefix="/investigador", tags=["investigador"])

VENTANA_CONCEPT_DRIFT = 50  # casos por ventana móvil (mockup RF06)


def _tasa(parte: int, total: int) -> float | None:
    return round(parte / total, 4) if total else None


@router.get("/metricas")
def metricas(_user: dict = Depends(current_investigator), db: Session = Depends(get_db)):
    por_sede = (
        db.execute(
            text(
                """
                SELECT s.code AS sede, s.nombre,
                       count(e.id) AS evaluaciones,
                       count(*) FILTER (WHERE e.ruta_sistema = 'A') AS ruta_a,
                       count(*) FILTER (WHERE e.escalada) AS escaladas,
                       count(d.evaluation_id) AS decisiones,
                       count(*) FILTER (WHERE d.ruta_final = e.ruta_sistema) AS concordantes
                FROM sites s
                LEFT JOIN evaluations e ON e.site_code = s.code
                LEFT JOIN decisions d ON d.evaluation_id = e.id
                GROUP BY s.code, s.nombre ORDER BY s.code
                """
            )
        )
        .mappings()
        .all()
    )
    sedes = [
        {
            "sede": r["sede"],
            "nombre": r["nombre"],
            "evaluaciones": r["evaluaciones"],
            "rutaA": r["ruta_a"],
            "escaladas": r["escaladas"],
            "decisiones": r["decisiones"],
            "concordancia": _tasa(r["concordantes"], r["decisiones"]),
        }
        for r in por_sede
    ]

    decisiones = sum(r["decisiones"] for r in por_sede)
    concordantes = sum(r["concordantes"] for r in por_sede)
    total = sum(r["evaluaciones"] for r in por_sede)

    ventana = (
        db.execute(
            text(
                "SELECT count(*) AS n, count(*) FILTER (WHERE d.ruta_final = e.ruta_sistema) AS ok FROM ("
                "  SELECT evaluation_id, ruta_final FROM decisions ORDER BY decidido_en DESC LIMIT :n"
                ") d JOIN evaluations e ON e.id = d.evaluation_id"
            ),
            {"n": VENTANA_CONCEPT_DRIFT},
        )
        .mappings()
        .one()
    )

    acciones = {
        r["accion"]: r["n"]
        for r in db.execute(text("SELECT accion, count(*) AS n FROM decisions GROUP BY accion")).mappings()
    }
    reglas = {
        r["regla"]: r["n"]
        for r in db.execute(
            text(
                "SELECT regla, count(*) AS n FROM evaluations, unnest(reglas_activadas) AS regla "
                "GROUP BY regla ORDER BY regla"
            )
        ).mappings()
    }
    eventos = db.execute(text("SELECT count(*) FROM audit_log")).scalar_one()
    primera_rota = db.execute(text("SELECT verify_audit_chain()")).scalar_one()

    return {
        "totales": {
            "evaluaciones": total,
            "decisiones": decisiones,
            "pendientes": total - decisiones,
            "rutaA": sum(s["rutaA"] for s in sedes),
            "escaladas": sum(s["escaladas"] for s in sedes),
            "concordancia": _tasa(concordantes, decisiones),
        },
        "sedes": sedes,
        "acciones": acciones,
        "reglas": reglas,
        # Concept drift: concordancia modelo vs. profesional en la ventana móvil de las últimas decisiones.
        "conceptDrift": {
            "ventana": VENTANA_CONCEPT_DRIFT,
            "decisiones": ventana["n"],
            "concordancia": _tasa(ventana["ok"], ventana["n"]),
        },
        # Data drift (PSI/KS): necesita la distribución del conjunto de entrenamiento como referencia.
        "dataDrift": {
            "disponible": False,
            "motivo": "Requiere la distribución de referencia del conjunto de entrenamiento (aún no entregada).",
        },
        "auditoria": {"eventos": eventos, "integra": primera_rota is None, "primerRegistroAlterado": primera_rota},
    }


def _celda(valor: Any) -> Any:
    """Evita la inyección de fórmulas al abrir el CSV en Excel."""
    if isinstance(valor, str) and valor[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + valor
    return valor


def _csv(nombre: str, cabecera: list[str], filas: list[list[Any]]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cabecera)
    w.writerows([[_celda(c) for c in fila] for fila in filas])
    return Response(
        "﻿" + buf.getvalue(),  # BOM: Excel reconoce UTF-8
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


def _valor(formulario: dict, ruta: tuple[str, ...]) -> Any:
    v: Any = formulario
    for parte in ruta:
        v = v.get(parte) if isinstance(v, dict) else None
    return int(v) if isinstance(v, bool) else v


@router.get("/evaluaciones.csv")
def exportar_evaluaciones(user: dict = Depends(current_investigator), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                "SELECT e.created_at, e.codigo_paciente, e.site_code, e.cargo, e.formulario, e.probabilidad_ra, "
                "e.ruta_base, e.ruta_sistema, e.escalada, e.reglas_activadas, e.version_modelo, "
                "e.version_diccionario, d.accion, d.ruta_final, d.decidido_en "
                "FROM evaluations e LEFT JOIN decisions d ON d.evaluation_id = e.id ORDER BY e.created_at"
            )
        )
        .mappings()
        .all()
    )
    cabecera = [
        "fecha", "codigo_paciente", "sede", "rol_operativo", *COLUMNAS, "probabilidad_ra", "ruta_base",
        "ruta_sistema", "escalada", "reglas", "decision", "ruta_final", "decidido_en", "version_modelo",
        "version_diccionario",
    ]
    filas = [
        [
            r["created_at"].isoformat(), r["codigo_paciente"], r["site_code"], r["cargo"],
            *[_valor(r["formulario"], ruta) for ruta, _ in COLUMNAS.values()],
            float(r["probabilidad_ra"]), r["ruta_base"], r["ruta_sistema"], int(r["escalada"]),
            ";".join(r["reglas_activadas"] or []), r["accion"], r["ruta_final"],
            r["decidido_en"].isoformat() if r["decidido_en"] else None,
            r["version_modelo"], r["version_diccionario"],
        ]
        for r in rows
    ]
    audit.log(db, "exportacion", user_id=user["id"], detalle={"tipo": "evaluaciones", "filas": len(filas)})
    return _csv("evaluaciones.csv", cabecera, filas)


@router.get("/auditoria.csv")
def exportar_auditoria(user: dict = Depends(current_investigator), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                "SELECT id, ts, evento, user_id, site_code, evaluation_id, detalle, prev_hash, hash "
                "FROM audit_log ORDER BY id"
            )
        )
        .mappings()
        .all()
    )
    cabecera = ["id", "ts", "evento", "user_id", "sede", "evaluacion_id", "detalle", "hash_previo", "hash"]
    filas = [
        [
            r["id"], r["ts"].isoformat(), r["evento"], r["user_id"], r["site_code"], r["evaluation_id"],
            json.dumps(r["detalle"], ensure_ascii=False), r["prev_hash"], r["hash"],
        ]
        for r in rows
    ]
    audit.log(db, "exportacion", user_id=user["id"], detalle={"tipo": "auditoria", "filas": len(filas)})
    return _csv("auditoria.csv", cabecera, filas)
