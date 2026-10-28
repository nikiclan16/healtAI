import { API_BASE_URL } from '@/config/app'
import { useAuthStore } from '@/features/auth/authStore'
import { ApiError, ApiValidationError } from '../interfaces'
import type { DownloadedFile } from '../types'

interface FastApiIssue {
  loc?: Array<string | number>
  msg?: string
}

interface RequestInitLite {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit
  auth?: boolean
}

async function send(path: string, init: RequestInitLite): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...init.headers }
  if (init.auth !== false) {
    const token = useAuthStore.getState().session?.token
    if (token) headers.Authorization = `Bearer ${token}`
  }
  try {
    return await fetch(`${API_BASE_URL}${path}`, { method: init.method ?? 'GET', headers, body: init.body })
  } catch {
    throw new ApiError('No hay conexión con el servidor')
  }
}

/** Devuelve el cuerpo JSON si la respuesta es correcta; si no, lanza el error que corresponde. */
async function unwrap(res: Response): Promise<unknown> {
  const payload: unknown = await res.json().catch(() => null)
  if (res.ok) return payload

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
  const msg = (payload as { detail?: string } | null)?.detail
  throw new ApiError(typeof msg === 'string' ? msg : `Error del servidor (${res.status})`, res.status)
}

/** Llamada JSON con Bearer token. Devuelve el cuerpo sin validar: cada adapter lo parsea. */
export async function httpJson(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<unknown> {
  const hasBody = init.body !== undefined
  return unwrap(
    await send(path, {
      method: init.method,
      auth: init.auth,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    }),
  )
}

/** Sube un archivo (multipart) en el campo `archivo` y devuelve el JSON de respuesta. */
export async function httpUpload(path: string, file: File): Promise<unknown> {
  const form = new FormData()
  form.append('archivo', file)
  return unwrap(await send(path, { method: 'POST', body: form }))
}

/** Descarga un archivo (CSV) con el token de la sesión. */
export async function httpDownload(path: string, fallbackName: string): Promise<DownloadedFile> {
  const res = await send(path, { headers: { Accept: 'text/csv' } })
  if (!res.ok) await unwrap(res)
  const match = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')
  return { blob: await res.blob(), filename: match?.[1] ?? fallbackName }
}
