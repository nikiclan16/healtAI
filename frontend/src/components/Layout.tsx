import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { API_MODE, APP_NAME, CONVENIO, MODEL_CARD, SITES } from '@/config/app'
import { useAuthStore } from '@/features/auth/authStore'
import { useSessionExpiry } from '@/features/auth/useSessionExpiry'
import { services } from '@/services'
import type { HealthStatus } from '@/services/types'
import { Disclaimer } from './Disclaimer'
import { Icon } from './ui'
import { VersionBadge } from './VersionBadge'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'bg-cuc-blue text-white' : 'text-slate-300 hover:text-white'}`

/** Cabecera institucional + franja informativa + pie. Envuelve el login y la app autenticada. */
export function Layout() {
  const session = useAuthStore((s) => s.session)
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()
  const minutesLeft = useSessionExpiry()
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    services.model.health().then((h) => !cancelled && setHealth(h))
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    await services.auth.logout()
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {import.meta.env.DEV && API_MODE === 'mock' && (
        <div className="no-print bg-amber-400 px-4 py-1 text-center text-xs font-bold text-slate-900">
          MODO DEMO — datos simulados. No ingrese información real de pacientes.
        </div>
      )}

      <header className="no-print sticky top-0 z-40 border-b-4 border-cuc-blue bg-cuc-navy text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-cuc-navy shadow-sm">CUC</span>
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold tracking-tight sm:text-lg">Plataforma Predictiva IA DM2</span>
                <span className="rounded-full bg-cuc-blue px-2 py-0.5 font-mono text-xs font-medium text-blue-100">Convenio {CONVENIO}</span>
              </span>
              <span className="hidden text-xs text-slate-300 sm:block">Detección temprana de trastornos mentales en pacientes con DM2 en riesgo de amputación</span>
            </span>
          </Link>

          {session && (
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex items-center gap-1" aria-label="Principal">
                <NavLink to="/" end className={navClass}>Inicio</NavLink>
                {session.user.rol === 'evaluador' && <NavLink to="/evaluacion/nueva" className={navClass}>Nueva evaluación</NavLink>}
                <NavLink to="/integracion" className={navClass}>API y lotes</NavLink>
                {session.user.rol === 'investigador' && <NavLink to="/investigador" className={navClass}>Panel investigador</NavLink>}
              </nav>
              <div className="text-right text-xs">
                <div className="font-semibold">{session.user.nombre}</div>
                <div className="text-slate-300">{session.user.cargoLabel ?? session.user.cargo}</div>
              </div>
              <Link to="/cambiar-password" className="text-xs font-semibold text-slate-300 hover:text-white">Contraseña</Link>
              <button onClick={logout} className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="no-print border-b border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-semibold text-cuc-navy">
              <Icon name="location-dot" className="text-cuc-blue" />
              <span>Sede Activa: {session ? SITES[session.sede].nombre : 'sin seleccionar'}</span>
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span>
              <span className="text-slate-500">Modelo Seleccionado: </span>
              <strong className="font-mono text-slate-800">{MODEL_CARD.nombre.replace('Regresión Logística', 'RegLog')} ({MODEL_CARD.descripcion})</strong>
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="text-slate-500">Motor de Reglas: </span>
              <strong className="text-emerald-700">R1-R5 Activo (Salud Mental)</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <VersionBadge className="text-slate-500" />
            {health === null ? (
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">Verificando API…</span>
            ) : health.ok ? (
              <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                API Online
              </span>
            ) : (
              <span title={health.detalle} className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-600" />
                API no disponible
              </span>
            )}
          </div>
        </div>
      </div>

      {minutesLeft !== null && minutesLeft <= 10 && (
        <div role="status" className="no-print bg-red-600 px-4 py-1 text-center text-xs font-semibold text-white">
          Su sesión expira en {minutesLeft} min. Guarde su trabajo.
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <Disclaimer />
      <footer className="bg-cuc-navy px-4 py-4 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-medium text-white">Universidad de la Costa - CUC | Barranquilla, Colombia</p>
            <p className="text-[11px] text-slate-400">Convenio {CONVENIO} · Convocatoria MinCiencias 963 de 2025 · {APP_NAME}</p>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            <VersionBadge />
            <div>TRIPOD+AI Statement Compliant · Ley 1581 de 2012</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
