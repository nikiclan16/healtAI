/** Código estable de un rol a partir de su nombre: 'Fisioterapia Cardíaca' → 'fisioterapia_cardiaca'. */
export function slugifyCode(label: string): string {
  const ascii = label.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  let slug = ascii.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!slug || !/^[a-z]/.test(slug)) slug = `rol_${slug}`
  return slug.slice(0, 32).replace(/_+$/, '')
}

const LETTERS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'

/** Contraseña inicial aleatoria (sin caracteres ambiguos) que siempre mezcla letras y números. */
export function generatePassword(length = 14): string {
  const alphabet = LETTERS + DIGITS
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint32Array(length))
    const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) return password
  }
}

/** Mensaje legible a partir del cuerpo de error de FastAPI (texto o lista de validaciones). */
export function errorMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: unknown; loc?: unknown }) => {
        const msg = String(d?.msg ?? 'Valor inválido').replace(/^Value error, /, '')
        const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body').join('.') : ''
        return field ? `${field}: ${msg}` : msg
      })
      .join(' · ')
  }
  return `Error del servidor (${status})`
}

export const PERFIL_LABEL = {
  evaluador: 'Evaluador',
  investigador: 'Investigador',
  admin: 'Administrador',
} as const
