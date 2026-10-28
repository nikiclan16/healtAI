/** Política mínima de contraseñas. Espejo de `password_problem` en backend/app/security.py. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres'
  if (new TextEncoder().encode(password).length > 72) return 'La contraseña no puede superar 72 bytes'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe combinar letras y números'
  return null
}
