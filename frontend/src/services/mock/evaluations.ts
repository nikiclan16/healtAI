import type { EvaluationService } from '../interfaces'
import { ApiError } from '../interfaces'
import type { Evaluation } from '../types'
import { delay } from './auth'

const KEY = 'healthai.mock.evaluations.v2'

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

/**
 * Código seudonimizado consecutivo por año (PAC-AAAA-NNNN). En modo `http` lo genera el
 * servidor; el profesional nunca escribe ni ve datos identificables (RNF01.2).
 */
function nextPatientCode(existing: Evaluation[], now: Date): string {
  const year = now.getFullYear()
  const prefix = `PAC-${year}-`
  const last = existing
    .filter((e) => e.codigoPaciente.startsWith(prefix))
    .reduce((max, e) => Math.max(max, Number(e.codigoPaciente.slice(prefix.length))), 0)
  return `${prefix}${String(last + 1).padStart(4, '0')}`
}

export const mockEvaluationService: EvaluationService = {
  async create(evaluation) {
    await delay(100)
    const existing = readAll()
    const now = new Date()
    const created: Evaluation = {
      ...evaluation,
      id: crypto.randomUUID(),
      creadoEn: now.toISOString(),
      codigoPaciente: nextPatientCode(existing, now),
    }
    writeAll([created, ...existing])
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
