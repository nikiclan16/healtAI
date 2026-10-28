import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, btnPrimary } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { services } from '@/services'
import type { Evaluation } from '@/services/types'

export function DashboardPage() {
  const session = useAuthStore((s) => s.session)!
  const [items, setItems] = useState<Evaluation[]>([])

  useEffect(() => {
    let cancelled = false
    services.evaluations.list().then((l) => !cancelled && setItems(l))
    return () => {
      cancelled = true
    }
  }, [])

  const mine = session.user.rol === 'evaluador' ? items.filter((e) => e.profesional.id === session.user.id) : items

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hola, {session.user.nombre}</h1>
          <p className="text-xs text-slate-500">Tamizaje de salud mental en pacientes con DM2 en riesgo de amputación</p>
        </div>
        <div className="flex items-center gap-3">
          {session.user.rol === 'evaluador' && (
            <Link to="/evaluacion/nueva" className={btnPrimary}>Nueva evaluación</Link>
          )}
        </div>
      </div>

      <Card title="Evaluaciones recientes">
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay evaluaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Paciente</th>
                  <th className="pr-4">Sede</th>
                  <th className="pr-4">Fecha</th>
                  <th className="pr-4">Ruta sugerida</th>
                  <th className="pr-4">Decisión</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.slice(0, 15).map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-mono">{e.codigoPaciente}</td>
                    <td className="pr-4">{e.sede}</td>
                    <td className="pr-4">{new Date(e.creadoEn).toLocaleString('es-CO')}</td>
                    <td className="pr-4"><Badge tone={e.rutaSistema === 'A' ? 'danger' : 'ok'}>Ruta {e.rutaSistema}</Badge></td>
                    <td className="pr-4">{e.decision ? `${e.decision.accion} → Ruta ${e.decision.rutaFinal}` : <Badge tone="warn">Pendiente</Badge>}</td>
                    <td><Link className="font-semibold text-cuc-blue hover:underline" to={`/evaluacion/${e.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
