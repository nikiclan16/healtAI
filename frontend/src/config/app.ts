import type { Role, SiteCode } from '@/services/types'

export const APP_NAME = 'healthAI'
export const APP_VERSION = '0.1.0'
export const MODEL_VERSION = 'v1.0.0'
export const DICTIONARY_VERSION = 'v2.1'
export const CONVENIO = '112721-224-2025'

/** Duración de la sesión: un turno de atención. */
export const SESSION_HOURS = 8

export const API_MODE: 'mock' | 'http' = import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock'
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** RF05.3 — debe mostrarse en toda pantalla de reporte. */
export const DISCLAIMER =
  'Herramienta de apoyo a la toma de decisiones clínicas. Las recomendaciones automatizadas no reemplazan el juicio profesional ni constituyen diagnóstico clínico.'

export const SITES: Record<SiteCode, { code: SiteCode; ciudad: string; nombre: string }> = {
  BAQ: { code: 'BAQ', ciudad: 'Barranquilla', nombre: 'CAP Barranquilla' },
  RHA: { code: 'RHA', ciudad: 'Riohacha', nombre: 'CAP Riohacha' },
  VUP: { code: 'VUP', ciudad: 'Valledupar', nombre: 'CAP Valledupar' },
}

export const ROLE_LABEL: Record<Role, string> = {
  evaluador: 'Profesional de la salud / Evaluador',
  investigador: 'Investigador / Administrador',
}
