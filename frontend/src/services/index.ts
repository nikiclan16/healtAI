import { API_MODE } from '@/config/app'
import { httpAuthService } from './http/auth'
import { httpEvaluationService } from './http/evaluations'
import { httpModelService } from './http/model'
import type { Services } from './interfaces'
import { mockAuthService } from './mock/auth'
import { mockEvaluationService } from './mock/evaluations'
import { mockModelService } from './mock/model'

/** Las pantallas solo importan `services`; nunca hacen `fetch` directamente. */
export const services: Services =
  API_MODE === 'http'
    ? { auth: httpAuthService, model: httpModelService, evaluations: httpEvaluationService }
    : { auth: mockAuthService, model: mockModelService, evaluations: mockEvaluationService }

export * from './interfaces'
