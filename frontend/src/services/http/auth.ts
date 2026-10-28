import { z } from 'zod'
import { SESSION_HOURS } from '@/config/app'
import type { AuthService } from '../interfaces'
import { httpJson } from './client'

/** Respuesta de POST /auth/login del backend (backend/app/schemas.py · TokenOut). */
const LoginResponse = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  debe_cambiar_password: z.boolean().optional(),
  usuario: z.object({
    id: z.string(),
    nombre: z.string(),
    rol: z.enum(['evaluador', 'investigador']),
    cargo: z.string().nullish(),
    cargo_label: z.string().nullish(),
  }),
})

const CargosResponse = z.array(z.object({ code: z.string(), label: z.string() }))

export const httpAuthService: AuthService = {
  async listCargos() {
    return CargosResponse.parse(await httpJson('/auth/cargos', { auth: false }))
  },
  async login({ usuario, password, cargo, sede }) {
    // El backend valida que el usuario tenga asignado el rol operativo (`cargo`) y la sede.
    const raw = await httpJson('/auth/login', { method: 'POST', auth: false, body: { usuario, password, cargo, sede } })
    const r = LoginResponse.parse(raw)
    const ttlMs = (r.expires_in ?? SESSION_HOURS * 3600) * 1000
    return {
      token: r.access_token,
      expiresAt: Date.now() + ttlMs,
      user: {
        id: r.usuario.id,
        nombre: r.usuario.nombre,
        rol: r.usuario.rol,
        cargo: r.usuario.cargo ?? cargo,
        cargoLabel: r.usuario.cargo_label ?? undefined,
      },
      sede,
      debeCambiarPassword: r.debe_cambiar_password ?? false,
    }
  },
  async logout() {
    // El JWT es stateless; si el backend añade revocación, llamarla aquí.
  },
  async changePassword(actual, nueva) {
    await httpJson('/auth/cambiar-password', { method: 'POST', body: { actual, nueva } })
  },
}
