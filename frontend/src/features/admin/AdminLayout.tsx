import { useEffect } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { CONVENIO } from '@/config/app'
import { Icon } from '@/components/ui'
import { VersionBadge } from '@/components/VersionBadge'
import { isAdminSessionValid, useAdminStore } from './adminStore'

/** Marco del área de administración (login incluido). Separado del flujo clínico. */
export function AdminLayout() {
  const session = useAdminStore((s) => s.session)
  const clear = useAdminStore((s) => s.clear)
  const navigate = useNavigate()

  // Cierra la sesión de administración al expirar el token.
  useEffect(() => {
    if (!isAdminSessionValid(session)) return
    const id = setTimeout(() => {
      clear()
      navigate('/admin/login', { replace: true, state: { expired: true } })
    }, Math.max(session.expiresAt - Date.now(), 0))
    return () => clearTimeout(id)
  }, [session, clear, navigate])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-4 border-cuc-blue bg-cuc-navy text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/admin" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-cuc-navy">CUC</span>
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold sm:text-lg">Administración · healthAI</span>
                <span className="rounded-full bg-cuc-alert px-2 py-0.5 text-[11px] font-semibold">Acceso restringido</span>
              </span>
              <span className="font-mono text-[11px] text-slate-300">Convenio {CONVENIO}</span>
            </span>
          </Link>
          {isAdminSessionValid(session) && (
            <div className="flex items-center gap-3 text-xs">
              <div className="text-right">
                <div className="font-semibold">{session.user.nombre}</div>
                <div className="text-slate-300">Administrador</div>
              </div>
              <button
                onClick={() => {
                  clear()
                  navigate('/admin/login', { replace: true })
                }}
                className="rounded-md border border-white/30 px-3 py-1.5 font-semibold hover:bg-white/10"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="bg-cuc-navy px-4 py-3 text-center text-xs text-slate-300">
        <p className="font-medium text-white">Universidad de la Costa - CUC | Gestión de usuarios y roles</p>
        <VersionBadge className="text-slate-400" />
        <p className="mt-1 text-[11px] text-slate-400"><Icon name="lock" className="mr-1" />Las acciones de administración quedan registradas en la bitácora de auditoría.</p>
      </footer>
    </div>
  )
}

/** Solo deja pasar con una sesión de administración vigente. */
export function RequireAdmin() {
  const session = useAdminStore((s) => s.session)
  if (!isAdminSessionValid(session)) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
