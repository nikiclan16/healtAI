import { describe, expect, it } from 'vitest'
import { passwordProblem } from './passwordPolicy'

describe('passwordProblem', () => {
  it('acepta una contraseña con letras, números y 10+ caracteres', () => {
    expect(passwordProblem('Clave-segura-2')).toBeNull()
  })

  it.each([
    ['corta1A', /al menos 10/],
    ['soloLetrasAqui', /letras y números/],
    ['12345678901', /letras y números/],
    ['a1'.repeat(40), /72 bytes/],
  ])('rechaza %s', (password, mensaje) => {
    expect(passwordProblem(password)).toMatch(mensaje)
  })
})
