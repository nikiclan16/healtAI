import { useState } from 'react'
import { Badge, Card, Field, btnPrimary, inputClass } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { services } from '@/services'
import type { Decision, DecisionAction, Evaluation, RouteCode } from '@/services/types'

const ACTIONS: { value: DecisionAction; label: string }[] = [
  { value: 'confirmar', label: 'Confirmar la ruta sugerida' },
  { value: 'rechazar', label: 'Rechazar (asignar la otra ruta)' },
  { value: 'ajustar', label: 'Ajustar la ruta' },
]

/** RF06 — supervisión humana: la decisión final del profesional es la etiqueta de referencia. */
export function DecisionPanel({ evaluation, onSaved }: { evaluation: Evaluation; onSaved: (e: Evaluation) => void }) {
  const session = useAuthStore((s) => s.session)!
  const suggested = evaluation.rutaSistema
  const locked = evaluation.reglas.locked
  const other: RouteCode = suggested === 'A' ? 'B' : 'A'

  const [accion, setAccion] = useState<DecisionAction>('confirmar')
  const [adjusted, setAdjusted] = useState<RouteCode>(other)
  const [just, setJust] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rutaFinal: RouteCode = accion === 'confirmar' ? suggested : accion === 'rechazar' ? other : adjusted
  const needsReason = accion !== 'confirmar'
  // La regla de seguridad no se puede degradar a Ruta B desde el software.
  const blocked = locked && rutaFinal === 'B'
  const invalid = blocked || (needsReason && just.trim().length < 10)

  if (evaluation.decision) {
    const d = evaluation.decision
    return (
      <Card title="Decisión del profesional">
        <p className="text-sm">
          <Badge tone="ok">Registrada</Badge>{' '}
          <strong>{d.accion}</strong> → <strong>Ruta {d.rutaFinal}</strong> · {new Date(d.decididoEn).toLocaleString('es-CO')}
        </p>
        {d.justificacion && <p className="mt-2 text-xs text-slate-600">Justificación: {d.justificacion}</p>}
      </Card>
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    const decision: Decision = {
      accion,
      rutaFinal,
      justificacion: just.trim(),
      profesionalId: session.user.id,
      decididoEn: new Date().toISOString(),
    }
    try {
      onSaved(await services.evaluations.recordDecision(evaluation.id, decision))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la decisión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Decisión del profesional" className="no-print">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Acción" className="grid gap-2 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <label key={a.value} className={`cursor-pointer rounded-lg border p-3 text-xs ${accion === a.value ? 'border-cuc-blue bg-cuc-light font-bold text-cuc-blue' : 'border-slate-200'}`}>
              <input type="radio" name="accion" className="mr-2" checked={accion === a.value} onChange={() => setAccion(a.value)} />
              {a.label}
            </label>
          ))}
        </div>

        {accion === 'ajustar' && (
          <div role="radiogroup" aria-label="Ruta final" className="flex gap-4 text-sm">
            {(['A', 'B'] as const).map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input type="radio" name="ruta" checked={adjusted === r} onChange={() => setAdjusted(r)} /> Ruta {r}
              </label>
            ))}
          </div>
        )}

        <p className="text-sm">Ruta final a registrar: <Badge tone={rutaFinal === 'A' ? 'danger' : 'ok'}>Ruta {rutaFinal}</Badge></p>

        {blocked && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
            La regla de seguridad está activa (riesgo reportado): la asignación a Ruta A no puede degradarse desde el software.
          </p>
        )}

        {needsReason && (
          <Field label="Justificación clínica (mínimo 10 caracteres)">
            <textarea rows={3} className={inputClass} value={just} onChange={(e) => setJust(e.target.value)} />
          </Field>
        )}

        {error && <p role="alert" className="text-xs font-medium text-cuc-alert">{error}</p>}
        <button type="button" className={btnPrimary} disabled={invalid || busy} onClick={() => void save()}>
          {busy ? 'Guardando…' : 'Registrar decisión'}
        </button>
      </div>
    </Card>
  )
}
