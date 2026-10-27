import type { EvaluationService } from '../interfaces'
import { ApiError } from '../interfaces'
import type { Evaluation } from '../types'
import { delay } from './auth'

const KEY = 'healthai.mock.evaluations'

function readAll(): Evaluation[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Evaluation[]) : []
  } catch {
    return []
  }
}

function writeAll(items: Evaluation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    throw new ApiError('No se pudo guardar la evaluación en el almacenamiento local')
  }
}

export const mockEvaluationService: EvaluationService = {
  async create(evaluation) {
    await delay(100)
    const created: Evaluation = {
      ...evaluation,
      id: crypto.randomUUID(),
      creadoEn: new Date().toISOString(),
    }
    writeAll([created, ...readAll()])
    return created
  },
  async get(id) {
    return readAll().find((e) => e.id === id) ?? null
  },
  async list() {
    return readAll()
  },
  async recordDecision(id, decision) {
    await delay(100)
    const all = readAll()
    const idx = all.findIndex((e) => e.id === id)
    if (idx === -1) throw new ApiError('Evaluación no encontrada', 404)
    const updated: Evaluation = { ...all[idx], decision }
    all[idx] = updated
    writeAll(all)
    return updated
  },
}
