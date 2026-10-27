import { z } from 'zod'
import type { ModelService } from '../interfaces'
import type { PredictResponse } from '../types'
import { httpJson } from './client'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ÚNICO LUGAR A AJUSTAR cuando llegue el contrato real de POST /predecir.  │
 * │ 1) `toRequestBody`: forma del JSON de entrada.                           │
 * │ 2) `RawPredict` + `toPredictResponse`: forma de la respuesta.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 * Todo lo de abajo es una SUPOSICIÓN razonable, no el contrato real.
 */

const RawPredict = z.object({
  probabilidad_ra: z.number().min(0).max(1),
  ruta_base: z.enum(['A', 'B']),
  confianza: z.enum(['Alta', 'Media', 'Baja']),
  retadores: z.object({ knn: z.number(), mlp: z.number(), consenso: z.number() }).nullish(),
  shap_top3: z
    .array(
      z.object({
        variable: z.string(),
        etiqueta: z.string().optional(),
        valor: z.number(),
        descripcion: z.string().optional(),
      }),
    )
    .max(3),
  version_modelo: z.string(),
})

function toPredictResponse(raw: unknown): PredictResponse {
  const r = RawPredict.parse(raw)
  return {
    probabilidadRA: r.probabilidad_ra,
    rutaBase: r.ruta_base,
    confianza: r.confianza,
    retadores: r.retadores ?? null,
    shapTop3: r.shap_top3.map((s) => ({
      variable: s.variable,
      etiqueta: s.etiqueta ?? s.variable,
      valor: s.valor,
      direccion: s.valor >= 0 ? 'riesgo' : 'protector',
      descripcion: s.descripcion ?? '',
    })),
    versionModelo: r.version_modelo,
  }
}

export const httpModelService: ModelService = {
  async predict(input, meta) {
    // `input` ya excluye Nivel_de_Riesgo (ver buildModelInput). `meta` es trazabilidad (RF01.2).
    const raw = await httpJson('/predecir', {
      method: 'POST',
      body: { ...input, sede: meta.sede, profesional_id: meta.profesionalId, codigo_paciente: meta.codigoPaciente },
    })
    return toPredictResponse(raw)
  },
  async health() {
    try {
      const raw = (await httpJson('/salud', { auth: false })) as { status?: string; version_modelo?: string }
      return { ok: raw.status === 'ok' || raw.status === undefined, versionModelo: raw.version_modelo }
    } catch (e) {
      return { ok: false, detalle: e instanceof Error ? e.message : 'Servicio no disponible' }
    }
  },
}
