import { beforeEach, describe, expect, it } from 'vitest'
import { buildModelInput } from '../contract'
import { ANEXO_E } from '../fixtures/anexoE'
import { mockAuthService } from './auth'
import { mockEvaluationService } from './evaluations'
import { mockModelService } from './model'
import { MOCK_USERS } from './users'

describe('mockAuthService', () => {
  const user = MOCK_USERS[0]

  it('inicia sesión con rol operativo, sede y vigencia de 8 h', async () => {
    const s = await mockAuthService.login({ usuario: user.usuario, password: user.password, cargo: 'medico', sede: 'RHA' })
    expect(s.sede).toBe('RHA')
    expect(s.user.cargo).toBe('medico')
    expect(s.user.rol).toBe('evaluador')
    const hours = (s.expiresAt - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(7.9)
    expect(hours).toBeLessThanOrEqual(8)
  })

  it('rechaza credenciales inválidas', async () => {
    await expect(mockAuthService.login({ usuario: user.usuario, password: 'x', cargo: 'medico', sede: 'BAQ' })).rejects.toThrow(/incorrectos/)
  })

  it('el servidor rechaza un rol operativo no asignado (no hay auto-promoción)', async () => {
    await expect(
      mockAuthService.login({ usuario: user.usuario, password: user.password, cargo: 'investigador', sede: 'BAQ' }),
    ).rejects.toThrow(/rol operativo/)
  })

  it('el investigador obtiene perfil RBAC de investigador', async () => {
    const inv = MOCK_USERS[2]
    const s = await mockAuthService.login({ usuario: inv.usuario, password: inv.password, cargo: 'investigador', sede: 'VUP' })
    expect(s.user.rol).toBe('investigador')
  })
})

describe('mockModelService', () => {
  it('devuelve probabilidad válida, ruta, confianza y Top 3 SHAP', async () => {
    const r = await mockModelService.predict(buildModelInput(ANEXO_E), { sede: 'BAQ', profesionalId: 'u', codigoPaciente: 'PAC-1' })
    expect(r.probabilidadRA).toBeGreaterThan(0)
    expect(r.probabilidadRA).toBeLessThan(1)
    expect(['A', 'B']).toContain(r.rutaBase)
    expect(r.shapTop3).toHaveLength(3)
    expect(r.versionModelo).toBe('v1.0.0')
  })
})

describe('mockEvaluationService', () => {
  beforeEach(() => localStorage.clear())

  it('crea, lista y registra la decisión humana', async () => {
    const input = buildModelInput(ANEXO_E)
    const prediccion = await mockModelService.predict(input, { sede: 'BAQ', profesionalId: 'u-001', codigoPaciente: 'PAC-1' })
    const created = await mockEvaluationService.create({
      codigoPaciente: 'PAC-1',
      sede: 'BAQ',
      profesional: { id: 'u-001', nombre: 'Test' },
      formulario: ANEXO_E,
      entrada: input,
      prediccion,
      reglas: {} as never,
      rutaSistema: 'A',
      escalada: false,
      versiones: { app: '0.1.0', modelo: 'v1.0.0', diccionario: 'v2.1' },
    })
    expect(await mockEvaluationService.list()).toHaveLength(1)

    const updated = await mockEvaluationService.recordDecision(created.id, {
      accion: 'confirmar',
      rutaFinal: 'A',
      justificacion: '',
      profesionalId: 'u-001',
      decididoEn: new Date().toISOString(),
    })
    expect(updated.decision?.rutaFinal).toBe('A')
    expect((await mockEvaluationService.get(created.id))?.decision).toBeDefined()
  })
})
