import { CARGOS, SESSION_HOURS } from '@/config/app'
import { ApiError } from '../interfaces'
import type { AuthService } from '../interfaces'
import { MOCK_USERS } from './users'

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const mockAuthService: AuthService = {
  async listCargos() {
    return Object.entries(CARGOS).map(([code, c]) => ({ code, label: c.label }))
  },
  async login({ usuario, password, cargo, sede }) {
    await delay(300)
    const found = MOCK_USERS.find(
      (u) => u.usuario === usuario.trim().toLowerCase() && u.password === password,
    )
    if (!found) throw new ApiError('Usuario o contraseña incorrectos', 401)
    // El servidor valida que el usuario tenga asignado el rol operativo elegido.
    if (!found.cargos.includes(cargo)) {
      throw new ApiError('El usuario no tiene asignado el rol operativo seleccionado', 403)
    }

    const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    return {
      // Token ficticio: no es un JWT firmado.
      token: `mock.${btoa(JSON.stringify({ sub: found.id, exp: expiresAt }))}`,
      expiresAt,
      user: { id: found.id, nombre: found.nombre, rol: CARGOS[cargo].rol, cargo, cargoLabel: CARGOS[cargo].label },
      sede,
    }
  },
  async logout() {
    await delay(50)
  },
  async changePassword(actual) {
    await delay(200)
    if (!MOCK_USERS.some((u) => u.password === actual)) throw new ApiError('La contraseña actual no es correcta', 400)
  },
}
