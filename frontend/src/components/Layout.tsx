import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { API_MODE, APP_NAME, CONVENIO, ROLE_LABEL, SITES } from '@/config/app'
import { useAuthStore } from '@/features/auth/authStore'
import { useSessionExpiry } from '@/features/auth/useSessionExpiry'
import { services } from '@/services'
import { Disclaimer } from './Disclaimer'
import { VersionBadge } from './VersionBadge'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'bg-cuc-blue text-white' : 'text-slate-300 hover:text-white'}`

export function Layout() {
  const session = useAuthStore((s) => s.session)
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()
  const minutesLeft = useSessionExpiry()

  async function logout() {
    await services.auth.logout()
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {API_MODE === 'mock' && (
        <div className="no-print bg-amber-400 px-4 py-1 text-center text-xs font-bold text-slate-900">
          MODO DEMO — datos simulados. No ingrese información real de pacientes.
        </div>
      )}

      <header className="no-print border-b-4 border-cuc-blue bg-cuc-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-cuc-navy">CUC</span>
            <span>
              <span className="block text-base font-bold leading-tight">{APP_NAME} · Plataforma Predictiva IA DM2</span>
              <span className="block font-mono text-[11px] text-slate-300">Convenio {CONVENIO}</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Principal">
            <NavLink to="/" end className={navClass}>Inicio</NavLink>
            {session?.user.rol === 'evaluador' && <NavLink to="/evaluacion/nueva" className={navClass}>Nueva evaluación</NavLink>}
            {session?.user.rol === 'investigador' && <NavLink to="/investigador" className={navClass}>Panel investigador</NavLink>}
          </nav>
          {session && (
            <div className="flex items-center gap-3 text-xs">
              <div className="text-right">
                <div className="font-semibold">{session.user.nombre}</div>
                <div className="text-slate-300">{ROLE_LABEL[session.user.rol]} · {SITES[session.sede].nombre}</div>
              </div>
              <button onClick={logout} className="rounded-md border border-white/30 px-3 py-1.5 font-semibold hover:bg-white/10">
                Salir
              </button>
            </div>
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-1 text-center text-slate-300">
          <VersionBadge />
        </div>
      </header>

      {minutesLeft !== null && minutesLeft <= 10 && (
        <div role="status" className="no-print bg-red-600 px-4 py-1 text-center text-xs font-semibold text-white">
          Su sesión expira en {minutesLeft} min. Guarde su trabajo.
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <Disclaimer />
      <footer className="bg-cuc-navy px-4 py-3 text-center text-xs text-slate-300">
        <p className="font-medium text-white">Universidad de la Costa — CUC · Barranquilla, Colombia</p>
        <VersionBadge className="text-slate-400" />
        <p className="mt-1 text-[11px] text-slate-400">Ley 1581 de 2012 · Resolución 8430 de 1993</p>
      </footer>
    </div>
  )
}
