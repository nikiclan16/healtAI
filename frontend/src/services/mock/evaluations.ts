import { APP_VERSION, DICTIONARY_VERSION } from '@/config/app'
import { useAuthStore } from '@/features/auth/authStore'
import { evaluateRules, resolveRoute } from '@/rules'
import { buildModelInput } from '../contract'
import type { EvaluationService } from '../interfaces'
import { ApiError } from '../interfaces'
import type { Evaluation } from '../types'
import { delay } from './auth'
import { mockPredict } from './model'

const KEY = 'healthai.mock.evaluations.v3'

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

/** Solo desarrollo: replica en el navegador lo que el backend hace en POST /evaluaciones. */
export const mockEvaluationService: EvaluationService = {
  async submit(form) {
    const session = useAuthStore.getState().session
    if (!session) throw new ApiError('No hay una sesión activa', 401)

    const entrada = buildModelInput(form)
    const prediccion = await mockPredict(entrada)
    const reglas = evaluateRules({
      who5Total: form.who5_total,
      dass: { depresion: form.dass_depresion, ansiedad: form.dass_ansiedad, estres: form.dass_estres },
      item21: form.dass_item21,
      v13ApoyoFamiliar: form.v13_apoyo_familiar,
      v14ActividadFisica: form.v14_actividad_fisica,
      v15CalidadSueno: form.v15_calidad_sueno,
      alertasProfesional: form.alertas_profesional,
    })
    const { finalRoute, escalated } = resolveRoute(prediccion.rutaBase, reglas)

    const existing = readAll()
    const now = new Date()
    const created: Evaluation = {
      id: crypto.randomUUID(),
      creadoEn: now.toISOString(),
      codigoPaciente: nextPatientCode(existing, now),
      sede: session.sede,
      profesional: { id: session.user.id, nombre: session.user.nombre },
      formulario: form,
      entrada: { ...entrada },
      prediccion,
      reglas,
      rutaSistema: finalRoute,
      escalada: escalated,
      versiones: { app: APP_VERSION, modelo: prediccion.versionModelo, diccionario: DICTIONARY_VERSION },
    }
    await delay(100)
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
