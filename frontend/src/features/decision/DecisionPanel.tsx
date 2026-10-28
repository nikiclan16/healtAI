import { useState } from 'react'
import { Icon, Modal, inputClass } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { services } from '@/services'
import type { Decision, Evaluation, RouteCode } from '@/services/types'

const CHOICES: { route: RouteCode; title: string; sub: string; on: string; icon: string }[] = [
  { route: 'A', title: 'Confirmar Ruta A (Salud Mental)', sub: 'Canalizar a Psicología / Psiquiatría', on: 'border-red-500 bg-red-50 text-red-900 font-bold shadow-sm', icon: 'text-red-600' },
  { route: 'B', title: 'Asignar Ruta B (Psicoeducación)', sub: 'Seguimiento programado habitual', on: 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-sm', icon: 'text-emerald-600' },
]

/** RF06 — supervisión humana: la decisión final del profesional es la etiqueta de referencia. */
export function DecisionPanel({ evaluation, onSaved }: { evaluation: Evaluation; onSaved: (e: Evaluation) => void }) {
  const session = useAuthStore((s) => s.session)!
  const suggested = evaluation.rutaSistema
  const locked = evaluation.reglas.locked
  const saved = evaluation.decision

  const [choice, setChoice] = useState<RouteCode | null>(saved?.rutaFinal ?? null)
  const [notes, setNotes] = useState(saved?.justificacion ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ title: string; body: React.ReactNode } | null>(null)

  const differs = choice !== null && choice !== suggested
  // La regla de seguridad no se puede degradar a Ruta B desde el software.
  const blocked = locked && choice === 'B'

  async function save() {
    if (choice === null) {
      setModal({
        title: 'Validación Requerida',
        body: <p className="text-amber-700">Por favor seleccione si confirma la <strong>Ruta A</strong> o <strong>Ruta B</strong> antes de registrar la decisión en el sistema de auditoría.</p>,
      })
      return
    }
    if (blocked) return
    if (differs && notes.trim().length < 10) {
      setError('Al diferir de la ruta sugerida, la justificación clínica es obligatoria (mínimo 10 caracteres).')
      return
    }
    setBusy(true)
    setError(null)
    const decision: Decision = {
      accion: differs ? 'rechazar' : 'confirmar',
      rutaFinal: choice,
      justificacion: notes.trim(),
      profesionalId: session.user.id,
      decididoEn: new Date().toISOString(),
    }
    try {
      const updated = await services.evaluations.recordDecision(evaluation.id, decision)
      onSaved(updated)
      setModal({
        title: 'Decisión Registrada en Auditoría',
        body: (
          <>
            <p>Se guardó exitosamente la validación clínica de <strong>{session.user.nombre}</strong> para el paciente <strong>{evaluation.codigoPaciente}</strong>.</p>
            <p>Ruta Final Validada: <strong className="text-cuc-blue">Ruta {choice}</strong></p>
            <p className="text-[11px] text-slate-500">Este registro retroalimenta la cola de telemetría para el monitoreo continuo de Concept Drift.</p>
          </>
        ),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la decisión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-cuc-blue">Requisito Funcional 06</span>
        <h2 className="text-xl font-bold text-slate-900">Decisión Humana (Human-in-the-Loop), Auditoría & Reporte Clínico</h2>
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cuc-navy text-xs text-white"><Icon name="user-check" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supervisión Profesional (Human-in-the-Loop)</h3>
              <p className="text-xs text-slate-500">Cierre de tamizaje con validación médica y firma electrónica de auditoría</p>
            </div>
          </div>
          <span className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[11px] text-cuc-blue">Trazabilidad Activa</span>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <span className="block font-bold text-slate-800">Dictamen del Evaluador para este Paciente: <span className="font-normal text-slate-500">(ruta sugerida por el sistema: Ruta {suggested})</span></span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Dictamen del evaluador">
            {CHOICES.map((c) => {
              const selected = choice === c.route
              const disabled = Boolean(saved) || (locked && c.route === 'B')
              return (
                <button
                  key={c.route}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setChoice(c.route)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? c.on : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <div>
                    <div className="text-xs font-bold">{c.title}</div>
                    <div className="text-[10px] text-slate-500">{c.sub}</div>
                  </div>
                  <Icon name="circle-check" className={`text-base ${c.icon}`} />
                </button>
              )
            })}
          </div>

          {locked && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-[11px] font-medium text-red-700">
              La regla de seguridad está activa (riesgo reportado): la asignación a Ruta A no puede degradarse desde el software.
            </p>
          )}

          <div>
            <label htmlFor="notes" className="mb-1 block text-[11px] font-semibold text-slate-700">Notas Clínicas y Justificación:</label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              disabled={Boolean(saved)}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escriba aquí consideraciones clínicas relevantes (ej. Paciente refiere alta angustia por indicación quirúrgica)..."
              className={`${inputClass} bg-white p-2.5`}
            />
          </div>

          {saved && (
            <p className="rounded-lg bg-emerald-50 p-3 text-[11px] text-emerald-800">
              <Icon name="circle-check" className="mr-1" />
              Decisión registrada: <strong>Ruta {saved.rutaFinal}</strong> · {new Date(saved.decididoEn).toLocaleString('es-CO')}
            </p>
          )}
          {error && <p role="alert" className="text-[11px] font-medium text-cuc-alert">{error}</p>}
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || Boolean(saved) || blocked}
            className="flex items-center gap-2 rounded-lg bg-cuc-navy px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="floppy-disk" />
            <span>{busy ? 'Guardando…' : 'Registrar en Base Auditada (Concept Drift Feed)'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cuc-blue hover:text-cuc-blue"
          >
            <Icon name="file-pdf" className="text-red-600" />
            <span>Descargar Informe Clínico Completo (PDF)</span>
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
          <Icon name="triangle-exclamation" className="mt-0.5 text-amber-600" />
          <div>
            <strong>Aviso Médico Institucional:</strong> Este prototipo de estratificación biopsicosocial y enrutamiento en salud mental no predice desenlaces de amputación futura ni emite diagnósticos clínicos autónomos. Su función es servir de soporte para la toma de decisiones asistenciales en atención primaria.
          </div>
        </div>
      </div>

      <Modal open={modal !== null} title={modal?.title ?? ''} onClose={() => setModal(null)}>
        {modal?.body}
      </Modal>
    </div>
  )
}
