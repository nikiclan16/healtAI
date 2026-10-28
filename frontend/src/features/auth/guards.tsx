import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/services/types'
import { isSessionValid, useAuthStore } from './authStore'

/** Sin sesión vigente no se accede a nada; con contraseña temporal solo se puede cambiarla. */
export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()
  if (!isSessionValid(session)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (session.debeCambiarPassword && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />
  }
  return <Outlet />
}

/** Restricción por rol (RBAC en la interfaz; la autoridad real está en el backend). */
export function RequireRole({ role }: { role: Role }) {
  const session = useAuthStore((s) => s.session)
  if (!isSessionValid(session) || session.user.rol !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
