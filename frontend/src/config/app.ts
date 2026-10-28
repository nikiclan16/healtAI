import type { Cargo, Role, SiteCode } from '@/services/types'

export const APP_NAME = 'healthAI'
export const APP_VERSION = '0.1.0'
export const MODEL_VERSION = 'v1.0.0'
export const DICTIONARY_VERSION = 'v2.1'
export const CONVENIO = '112721-224-2025'

/** Duración de la sesión: un turno de atención. */
export const SESSION_HOURS = 8

/**
 * El modo simulado (`mock`) existe SOLO para desarrollo local. En una compilación de producción
 * se usa siempre el backend real, aunque alguien defina VITE_API_MODE=mock: nunca se muestran
 * predicciones ni autenticación simuladas a un usuario real.
 */
export const API_MODE: 'mock' | 'http' = import.meta.env.DEV && import.meta.env.VITE_API_MODE !== 'http' ? 'mock' : 'http'
/** En desarrollo permite usar autenticación real mientras el modelo y las evaluaciones siguen simulados. */
export const AUTH_MODE: 'mock' | 'http' = !import.meta.env.DEV
  ? 'http'
  : import.meta.env.VITE_AUTH_MODE === 'http'
    ? 'http'
    : import.meta.env.VITE_AUTH_MODE === 'mock'
      ? 'mock'
      : API_MODE
/** Producción: mismo origen por defecto (la API detrás del mismo dominio) o `VITE_API_BASE_URL`. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

/** RF05.3 — debe mostrarse en toda pantalla de reporte. */
export const DISCLAIMER =
  'Herramienta de apoyo a la toma de decisiones clínicas. Las recomendaciones automatizadas no reemplazan el juicio profesional ni constituyen diagnóstico clínico.'

export const SITES: Record<SiteCode, { code: SiteCode; ciudad: string; centro: string; nombre: string }> = {
  BAQ: { code: 'BAQ', ciudad: 'Barranquilla', centro: 'CAP Metropolitano', nombre: 'CAP Barranquilla (Sede Norte)' },
  RHA: { code: 'RHA', ciudad: 'Riohacha', centro: 'CAP Comunitario', nombre: 'CAP Riohacha (Sede Guajira)' },
  VUP: { code: 'VUP', ciudad: 'Valledupar', centro: 'CAP Integral', nombre: 'CAP Valledupar (Sede Cesar)' },
}

/** Roles operativos del portal de acceso y el perfil RBAC al que corresponden. */
export const CARGOS: Record<Cargo, { label: string; rol: Role }> = {
  medico: { label: 'Médico de Atención Primaria', rol: 'evaluador' },
  psicologo: { label: 'Psicólogo Clínico', rol: 'evaluador' },
  enfermeria: { label: 'Enfermería Especializada', rol: 'evaluador' },
  investigador: { label: 'Investigador CUC (Auditor)', rol: 'investigador' },
}

/** Ficha del artefacto productivo (Documento Técnico). */
export const MODEL_CARD = {
  nombre: 'Regresión Logística L2 (S2)',
  descripcion: 'S2: Clínicas + WHO-5',
  detalles: ['Regularización C: 0.01 (Moda)', 'Balanced Acc (LOOCV): 67.8%', 'Sensibilidad RA: 80.0%'],
}
