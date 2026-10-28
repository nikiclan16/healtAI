import { API_BASE_URL } from '@/config/app'
import { ApiError } from '@/services/interfaces'
import { useAdminStore } from './adminStore'
import { errorMessage } from './helpers'

export type Perfil = 'evaluador' | 'investigador' | 'admin'
export type PerfilCargo = 'evaluador' | 'investigador'

export interface AdminUser {
  id: string
  email: string
  nombre: string
  rol: Perfil
  activo: boolean
  bloqueado: boolean
  cargos: string[]
  sedes: string[]
  created_at: string
  last_login_at: string | null
}

export interface AdminRole {
  code: string
  label: string
  rol: PerfilCargo
  activo: boolean
  usuarios: number
}

export interface AdminSite {
  code: string
  ciudad: string
  centro: string
  nombre: string
}

export interface NewUser {
  email: string
  nombre: string
  password: string
  rol: Perfil
  cargos: string[]
  sedes: string[]
}

export interface UserChanges {
  nombre?: string
  activo?: boolean
  password?: string
  cargos?: string[]
  sedes?: string[]
}

interface AdminLoginResponse {
  access_token: string
  expires_in: number
  usuario: { id: string; nombre: string }
}

/** Cliente de la API de administración. No tiene modo simulado: requiere el backend. */
async function request<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const authed = init.auth !== false
  const token = useAdminStore.getState().session?.token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (authed && token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor')
  }

  const payload: unknown = await res.json().catch(() => null)
  if (res.status === 401 && authed) {
    useAdminStore.getState().clear()
    throw new ApiError('Su sesión de administración expiró. Ingrese nuevamente.', 401)
  }
  if (!res.ok) throw new ApiError(errorMessage(payload, res.status), res.status)
  return payload as T
}

export const adminApi = {
  login: (usuario: string, password: string) =>
    request<AdminLoginResponse>('/admin/auth/login', { method: 'POST', auth: false, body: { usuario, password } }),
  sedes: () => request<AdminSite[]>('/admin/sedes'),
  roles: () => request<AdminRole[]>('/admin/roles'),
  createRole: (body: { label: string; rol: PerfilCargo }) => request<AdminRole>('/admin/roles', { method: 'POST', body }),
  patchRole: (code: string, body: { label?: string; activo?: boolean }) =>
    request<AdminRole>(`/admin/roles/${encodeURIComponent(code)}`, { method: 'PATCH', body }),
  users: (q?: string) => request<AdminUser[]>(`/admin/usuarios${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createUser: (body: NewUser) => request<AdminUser>('/admin/usuarios', { method: 'POST', body }),
  patchUser: (id: string, body: UserChanges) =>
    request<AdminUser>(`/admin/usuarios/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
}
