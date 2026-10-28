import { z } from 'zod'
import type { EvaluationService } from '../interfaces'
import { ApiError } from '../interfaces'
import type { Evaluation } from '../types'
import { httpJson } from './client'

/** Valida lo esencial de la respuesta del servidor (POST/GET /evaluaciones). */
const EvaluationResponse = z
  .object({
    id: z.string(),
    creadoEn: z.string(),
    codigoPaciente: z.string(),
    sede: z.enum(['BAQ', 'RHA', 'VUP']),
    profesional: z.object({ id: z.string(), nombre: z.string() }),
    prediccion: z.object({
      probabilidadRA: z.number().min(0).max(1),
      rutaBase: z.enum(['A', 'B']),
      confianza: z.enum(['Alta', 'Media', 'Baja']).nullable(),
      shapTop3: z.array(z.object({ variable: z.string(), etiqueta: z.string(), valor: z.number() }).passthrough()),
      versionModelo: z.string(),
    }).passthrough(),
    reglas: z.object({ outcomes: z.array(z.object({ code: z.string() }).passthrough()), locked: z.boolean() }).passthrough(),
    rutaSistema: z.enum(['A', 'B']),
    escalada: z.boolean(),
    versiones: z.object({ app: z.string(), modelo: z.string(), diccionario: z.string() }),
  })
  .passthrough()

const parse = (raw: unknown) => EvaluationResponse.parse(raw) as unknown as Evaluation

export const httpEvaluationService: EvaluationService = {
  async submit(form) {
    return parse(await httpJson('/evaluaciones', { method: 'POST', body: form }))
  },
  async get(id) {
    try {
      return parse(await httpJson(`/evaluaciones/${encodeURIComponent(id)}`))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },
  async list() {
    return z.array(z.unknown()).parse(await httpJson('/evaluaciones')).map(parse)
  },
  async recordDecision(id, decision) {
    // El profesional y la fecha los fija el servidor a partir de la sesión.
    const body = { accion: decision.accion, rutaFinal: decision.rutaFinal, justificacion: decision.justificacion }
    return parse(await httpJson(`/evaluaciones/${encodeURIComponent(id)}/decision`, { method: 'POST', body }))
  },
}
