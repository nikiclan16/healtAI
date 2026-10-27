import { describe, expect, it } from 'vitest'
import { ANEXO_E } from '@/services/fixtures/anexoE'
import { dassLevel, evaluateRules, resolveRoute } from '@/rules'
import type { RulesInput } from '@/rules'

/** Entrada "sana": ninguna regla se dispara. */
const healthy = (): RulesInput => ({
  dassItems: Array.from({ length: 21 }, () => 0),
  who5Items: [4, 4, 4, 4, 4], // 20/25 = 80 %
  v13ApoyoFamiliar: 5,
  v14ActividadFisica: 3,
  v15CalidadSueno: 5,
  alertasProfesional: { riesgo_suicida: false, deterioro_agudo: false, riesgo_urgente: false },
})

const codes = (input: RulesInput) => evaluateRules(input).triggered.map((o) => o.code)

describe('dassLevel (cortes por subescala)', () => {
  it.each([
    ['depresion', 4, 'normal'],
    ['depresion', 5, 'leve'],
    ['depresion', 7, 'moderado'],
    ['depresion', 11, 'severo'],
    ['depresion', 14, 'extremo'],
    ['ansiedad', 3, 'normal'],
    ['ansiedad', 8, 'severo'],
    ['ansiedad', 10, 'extremo'],
    ['estres', 12, 'moderado'],
    ['estres', 13, 'severo'],
    ['estres', 17, 'extremo'],
  ] as const)('%s %i → %s', (scale, score, level) => {
    expect(dassLevel(scale, score)).toBe(level)
  })
})

describe('evaluateRules', () => {
  it('no dispara reglas en un perfil sin riesgo', () => {
    const r = evaluateRules(healthy())
    expect(r.triggered).toHaveLength(0)
    expect(r.escalates).toBe(false)
    expect(r.locked).toBe(false)
  })

  it('R1: ítem 21 ≥ 2', () => {
    const input = healthy()
    const items = [...input.dassItems]
    items[20] = 2
    expect(codes({ ...input, dassItems: items })).toContain('R1')
  })

  it('R1: ítem 21 = 1 no la dispara', () => {
    const items = [...healthy().dassItems]
    items[20] = 1
    expect(codes({ ...healthy(), dassItems: items })).not.toContain('R1')
  })

  it('R1: ítem 21 no evaluable (null) la dispara y marca alerta suicida', () => {
    const items = [...healthy().dassItems]
    items[20] = null
    const r = evaluateRules({ ...healthy(), dassItems: items })
    expect(r.triggered.map((o) => o.code)).toContain('R1')
    expect(r.suicideAlert).toBe(true)
    expect(r.scores.depresionIncompleta).toBe(true)
  })

  it('R2: ansiedad severa (8)', () => {
    const items = Array.from({ length: 21 }, () => 0)
    // ansiedad: ítems 2,4,7,9,15,19,20 → total 8
    ;[2, 4, 7, 9].forEach((n) => (items[n - 1] = 2))
    expect(codes({ ...healthy(), dassItems: items })).toContain('R2')
  })

  it('R3: WHO-5 bruto 7 (28 %) la dispara; 8 (32 %) no', () => {
    expect(codes({ ...healthy(), who5Items: [2, 2, 1, 1, 1] })).toContain('R3')
    expect(codes({ ...healthy(), who5Items: [2, 2, 2, 1, 1] })).not.toContain('R3')
  })

  it('R5: exactamente 2 marcadores no alcanza; 3 sí', () => {
    const two = { ...healthy(), v15CalidadSueno: 2, v13ApoyoFamiliar: 2 }
    expect(codes(two)).not.toContain('R5')
    const three = { ...two, v14ActividadFisica: 0 }
    expect(codes(three)).toContain('R5')
  })

  it('regla de seguridad: cualquier alerta del profesional bloquea y escala', () => {
    const r = evaluateRules({
      ...healthy(),
      alertasProfesional: { riesgo_suicida: false, deterioro_agudo: true, riesgo_urgente: false },
    })
    expect(r.locked).toBe(true)
    expect(r.escalates).toBe(true)
    expect(r.triggered.map((o) => o.code)).toEqual(['SEG'])
  })

  it('Caso Anexo E: dispara R2, R4 y R5 (no R1 ni R3)', () => {
    const f = ANEXO_E
    const r = evaluateRules({
      dassItems: f.dass21_items,
      who5Items: f.who5_items,
      v13ApoyoFamiliar: f.v13_apoyo_familiar,
      v14ActividadFisica: f.v14_actividad_fisica,
      v15CalidadSueno: f.v15_calidad_sueno,
      alertasProfesional: f.alertas_profesional,
    })
    expect(r.scores).toMatchObject({ depresion: 9, ansiedad: 8, estres: 12 })
    expect(r.who5Total).toBe(8)
    expect(r.who5Percent).toBe(32)
    expect(r.triggered.map((o) => o.code)).toEqual(['R2', 'R4', 'R5'])
  })
})

describe('resolveRoute', () => {
  it('escala de B a A cuando hay reglas disparadas', () => {
    expect(resolveRoute('B', { escalates: true })).toEqual({ finalRoute: 'A', escalated: true })
  })
  it('mantiene A sin marcar escalamiento', () => {
    expect(resolveRoute('A', { escalates: true })).toEqual({ finalRoute: 'A', escalated: false })
  })
  it('respeta B si no hay reglas', () => {
    expect(resolveRoute('B', { escalates: false })).toEqual({ finalRoute: 'B', escalated: false })
  })
})
