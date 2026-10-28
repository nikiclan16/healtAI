import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/features/auth/authStore'
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

  it('lista los roles operativos', async () => {
    const cargos = await mockAuthService.listCargos()
    expect(cargos.map((c) => c.code)).toContain('medico')
  })
})

describe('mockModelService', () => {
  it('informa su estado', async () => {
    expect((await mockModelService.health()).ok).toBe(true)
  })
})

describe('mockEvaluationService', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      session: {
        token: 't',
        expiresAt: Date.now() + 3_600_000,
        sede: 'BAQ',
        user: { id: 'u-001', nombre: 'Dr. Test', rol: 'evaluador', cargo: 'medico', cargoLabel: 'Médico' },
      },
    })
  })

  it('el tamizaje completo (Anexo E) devuelve la evaluación con reglas y ruta', async () => {
    const ev = await mockEvaluationService.submit(ANEXO_E)
    expect(ev.codigoPaciente).toMatch(/^PAC-\d{4}-0001$/)
    expect(ev.sede).toBe('BAQ')
    expect(ev.reglas.triggered.map((r) => r.code)).toEqual(['R2', 'R4', 'R5'])
    expect(ev.rutaSistema).toBe('A')
    expect(Object.keys(ev.entrada)).toHaveLength(15)
    expect(ev.prediccion.shapTop3).toHaveLength(3)
  })

  it('exige una sesión activa', async () => {
    useAuthStore.setState({ session: null })
    await expect(mockEvaluationService.submit(ANEXO_E)).rejects.toThrow(/sesión/)
  })

  it('genera códigos seudonimizados consecutivos', async () => {
    const a = await mockEvaluationService.submit(ANEXO_E)
    const b = await mockEvaluationService.submit(ANEXO_E)
    expect(Number(b.codigoPaciente.slice(-4))).toBe(Number(a.codigoPaciente.slice(-4)) + 1)
  })

  it('lista, consulta y registra la decisión humana', async () => {
    const created = await mockEvaluationService.submit(ANEXO_E)
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
