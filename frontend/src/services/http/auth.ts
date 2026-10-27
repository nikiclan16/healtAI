import { z } from 'zod'
import { SESSION_HOURS } from '@/config/app'
import type { AuthService } from '../interfaces'
import { httpJson } from './client'

/** PROVISIONAL: forma de la respuesta de POST /auth/login. Ajustar al contrato real. */
const LoginResponse = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  usuario: z.object({
    id: z.string(),
    nombre: z.string(),
    rol: z.enum(['evaluador', 'investigador']),
    cargo: z.string().default(''),
  }),
})

export const httpAuthService: AuthService = {
  async login({ usuario, password, sede }) {
    const raw = await httpJson('/auth/login', { method: 'POST', auth: false, body: { usuario, password, sede } })
    const r = LoginResponse.parse(raw)
    const ttlMs = (r.expires_in ?? SESSION_HOURS * 3600) * 1000
    return { token: r.access_token, expiresAt: Date.now() + ttlMs, user: r.usuario, sede }
  },
  async logout() {
    // El JWT es stateless; si el backend añade revocación, llamarla aquí.
  },
}
