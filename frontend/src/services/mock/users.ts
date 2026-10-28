import type { Cargo } from '../types'

/**
 * SOLO DEMO. Usuarios ficticios para el modo `mock`; no hay seguridad real en el navegador.
 * La autenticación real y el RBAC viven en el backend (modo `http`), que valida el rol operativo.
 */
export const MOCK_USERS: ReadonlyArray<{ usuario: string; password: string; id: string; nombre: string; cargos: Cargo[] }> = [
  { usuario: 'evaluador@cuc.test', password: 'demo1234', id: 'u-001', nombre: 'Dr. Alejandro Restrepo', cargos: ['medico', 'enfermeria'] },
  { usuario: 'psicologa@cuc.test', password: 'demo1234', id: 'u-002', nombre: 'Psic. Laura Mendoza', cargos: ['psicologo'] },
  { usuario: 'investigador@cuc.test', password: 'demo1234', id: 'u-900', nombre: 'Investigador CUC', cargos: ['investigador'] },
]
