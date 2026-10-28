import { API_MODE, AUTH_MODE } from '@/config/app'
import { httpAuthService } from './http/auth'
import { httpEvaluationService } from './http/evaluations'
import { httpModelService } from './http/model'
import type { Services } from './interfaces'
import { mockAuthService } from './mock/auth'
import { mockEvaluationService } from './mock/evaluations'
import { mockModelService } from './mock/model'

/**
 * Las pantallas solo importan `services`; nunca hacen `fetch` directamente.
 * La autenticación puede ser real (`VITE_AUTH_MODE=http`) aunque el resto siga simulado.
 */
export const services: Services = {
  auth: AUTH_MODE === 'http' ? httpAuthService : mockAuthService,
  model: API_MODE === 'http' ? httpModelService : mockModelService,
  evaluations: API_MODE === 'http' ? httpEvaluationService : mockEvaluationService,
}

export * from './interfaces'
