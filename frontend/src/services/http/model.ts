import type { ModelService } from '../interfaces'
import type { PredictResponse } from '../types'
import { httpJson } from './client'

interface SaludResponse {
  status?: string
  version_modelo?: string | null
  modelo?: { estado?: string; motivo?: string; placeholder?: boolean }
}

/** Estado del servicio (RF03.3). La inferencia la hace el backend dentro de POST /evaluaciones. */
export const httpModelService: ModelService = {
  async health() {
    try {
      const raw = (await httpJson('/salud', { auth: false })) as SaludResponse
      const ok = raw.status === 'ok'
      return {
        ok,
        versionModelo: raw.version_modelo ?? undefined,
        detalle: ok
          ? raw.modelo?.placeholder
            ? 'Modelo de prueba (no clínico)'
            : undefined
          : (raw.modelo?.motivo ?? 'Servicio degradado'),
      }
    } catch (e) {
      return { ok: false, detalle: e instanceof Error ? e.message : 'Servicio no disponible' }
    }
  },
  async predict(form) {
    return (await httpJson('/predecir', { method: 'POST', body: form })) as PredictResponse
  },
}
