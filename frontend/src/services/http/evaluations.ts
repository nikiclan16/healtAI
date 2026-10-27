import type { EvaluationService } from '../interfaces'
import type { Evaluation } from '../types'
import { httpJson } from './client'

/** PROVISIONAL: endpoints /evaluaciones por definir con el backend (bitácora RNF01.3). */
export const httpEvaluationService: EvaluationService = {
  async create(evaluation) {
    return (await httpJson('/evaluaciones', { method: 'POST', body: evaluation })) as Evaluation
  },
  async get(id) {
    return (await httpJson(`/evaluaciones/${encodeURIComponent(id)}`)) as Evaluation | null
  },
  async list() {
    return (await httpJson('/evaluaciones')) as Evaluation[]
  },
  async recordDecision(id, decision) {
    return (await httpJson(`/evaluaciones/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: decision,
    })) as Evaluation
  },
}
