import type { UserProfile } from '../types'

/**
 * SOLO DEMO. Usuarios ficticios para el modo `mock`; no hay seguridad real en el navegador.
 * La autenticación real y el RBAC viven en el backend (modo `http`).
 */
export const MOCK_USERS: ReadonlyArray<{ usuario: string; password: string; profile: UserProfile }> = [
  {
    usuario: 'evaluador@cuc.test',
    password: 'demo1234',
    profile: { id: 'u-001', nombre: 'Dr. Alejandro Restrepo', rol: 'evaluador', cargo: 'Médico de atención primaria' },
  },
  {
    usuario: 'psicologa@cuc.test',
    password: 'demo1234',
    profile: { id: 'u-002', nombre: 'Psic. Laura Mendoza', rol: 'evaluador', cargo: 'Psicóloga clínica' },
  },
  {
    usuario: 'investigador@cuc.test',
    password: 'demo1234',
    profile: { id: 'u-900', nombre: 'Investigador CUC', rol: 'investigador', cargo: 'Investigador (auditor)' },
  },
]
