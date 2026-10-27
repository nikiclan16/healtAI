import { SESSION_HOURS } from '@/config/app'
import { ApiError } from '../interfaces'
import type { AuthService } from '../interfaces'
import { MOCK_USERS } from './users'

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const mockAuthService: AuthService = {
  async login({ usuario, password, sede }) {
    await delay(300)
    const found = MOCK_USERS.find(
      (u) => u.usuario === usuario.trim().toLowerCase() && u.password === password,
    )
    if (!found) throw new ApiError('Usuario o contraseña incorrectos', 401)

    const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    return {
      // Token ficticio: no es un JWT firmado.
      token: `mock.${btoa(JSON.stringify({ sub: found.profile.id, exp: expiresAt }))}`,
      expiresAt,
      user: found.profile,
      sede,
    }
  },
  async logout() {
    await delay(50)
  },
}
