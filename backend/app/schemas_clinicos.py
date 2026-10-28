"""Contrato de datos del formulario clínico (RF02). Espejo de frontend/src/services/contract.ts.

`extra="forbid"` rechaza con HTTP 422 cualquier campo no definido: así el nivel de riesgo de
amputación (RF02.4) o un identificador de paciente (RNF01.2) no pueden colarse en una petición.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Tratamiento = Literal["dieta_ejercicio", "orales", "insulina", "orales_insulina", "ninguno"]


class _Estricto(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Comorbilidades(_Estricto):
    hipertension: bool
    cardiaca: bool
    obesidad: bool
    otra: bool


class AlertasProfesional(_Estricto):
    riesgo_suicida: bool
    deterioro_agudo: bool
    riesgo_urgente: bool


class ScreeningFormIn(_Estricto):
    v8_tiempo_diagnostico: int = Field(ge=0, le=80)
    v9_tratamiento: Tratamiento
    v11: Comorbilidades
    v12_percepcion_salud: int = Field(ge=1, le=5)
    v13_apoyo_familiar: int = Field(ge=1, le=5)
    v14_actividad_fisica: int = Field(ge=0, le=3)
    v15_calidad_sueno: int = Field(ge=1, le=5)
    who5_total: int = Field(ge=0, le=25)
    dass_depresion: int = Field(ge=0, le=21)
    dass_ansiedad: int = Field(ge=0, le=21)
    dass_estres: int = Field(ge=0, le=21)
    # Ítem 21 del DASS-21 (0–3). null = no evaluable (activa R1).
    dass_item21: int | None = Field(ge=0, le=3)
    alertas_profesional: AlertasProfesional


class DecisionIn(BaseModel):
    """Decisión humana final (RF06). El profesional y la fecha los fija el servidor."""

    model_config = ConfigDict(populate_by_name=True)

    accion: Literal["confirmar", "rechazar", "ajustar"]
    ruta_final: Literal["A", "B"] = Field(alias="rutaFinal")
    justificacion: str = Field(default="", max_length=2000)
