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
 * Los servicios simulados solo se enlazan en desarrollo (`import.meta.env.DEV`): en producción
 * se eliminan del paquete, junto con los usuarios de prueba.
 */
export const services: Services = {
  auth: import.meta.env.DEV && AUTH_MODE === 'mock' ? mockAuthService : httpAuthService,
  model: import.meta.env.DEV && API_MODE === 'mock' ? mockModelService : httpModelService,
  evaluations: import.meta.env.DEV && API_MODE === 'mock' ? mockEvaluationService : httpEvaluationService,
}

export * from './interfaces'
