import { API_BASE_URL } from '@/config/app'
import { useAuthStore } from '@/features/auth/authStore'
import { ApiError, ApiValidationError } from '../interfaces'

interface FastApiIssue {
  loc?: Array<string | number>
  msg?: string
}

/** Llamada JSON con Bearer token. Devuelve el cuerpo sin validar: cada adapter lo parsea. */
export async function httpJson(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.auth !== false) {
    const token = useAuthStore.getState().session?.token
    if (token) headers.Authorization = `Bearer ${token}`
  }

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

  if (res.status === 422) {
    const detail = (payload as { detail?: FastApiIssue[] | string } | null)?.detail
    // 422 con texto: regla de negocio rechazada por el servidor (p. ej. regla de seguridad).
    if (typeof detail === 'string') throw new ApiError(detail, 422)
    throw new ApiValidationError(
      (detail ?? []).map((d) => ({ campo: (d.loc ?? []).slice(1).join('.'), mensaje: d.msg ?? 'Valor inválido' })),
    )
  }
  if (res.status === 401) {
    useAuthStore.getState().clear()
    throw new ApiError('Sesión expirada o no autorizada', 401)
  }
  if (!res.ok) {
    const msg = (payload as { detail?: string } | null)?.detail
    throw new ApiError(typeof msg === 'string' ? msg : `Error del servidor (${res.status})`, res.status)
  }
  return payload
}
