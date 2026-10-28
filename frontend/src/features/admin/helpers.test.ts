import { describe, expect, it } from 'vitest'
import { errorMessage, generatePassword, slugifyCode } from './helpers'

describe('slugifyCode', () => {
  it.each([
    ['Trabajo Social', 'trabajo_social'],
    ['Fisioterapia Cardíaca', 'fisioterapia_cardiaca'],
    ['  Médico   General  ', 'medico_general'],
    ['123 Ruta', 'rol_123_ruta'],
  ])('%s → %s', (label, code) => {
    expect(slugifyCode(label)).toBe(code)
  })

  it('siempre produce un código válido para el backend', () => {
    for (const label of ['Ab Cd', 'Nutrición y Dietética', 'Ñandú', 'x'.repeat(80), '###']) {
      expect(slugifyCode(label)).toMatch(/^[a-z][a-z0-9_]{2,31}$/)
    }
  })
})

describe('generatePassword', () => {
  it('cumple la política: ≥ 10 caracteres con letras y números', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword()
      expect(p.length).toBeGreaterThanOrEqual(10)
      expect(p).toMatch(/[A-Za-z]/)
      expect(p).toMatch(/\d/)
    }
  })

  it('no repite contraseñas', () => {
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20)
  })
})

describe('errorMessage', () => {
  it('usa el detalle de texto', () => {
    expect(errorMessage({ detail: 'Ya existe un usuario con ese correo' }, 409)).toBe('Ya existe un usuario con ese correo')
  })

  it('traduce validaciones de FastAPI sin el prefijo técnico', () => {
    const payload = {
      detail: [{ loc: ['body', 'password'], msg: 'Value error, La contraseña debe tener al menos 10 caracteres' }],
    }
    expect(errorMessage(payload, 422)).toBe('password: La contraseña debe tener al menos 10 caracteres')
  })

  it('cae a un mensaje genérico', () => {
    expect(errorMessage(null, 500)).toBe('Error del servidor (500)')
  })
})
