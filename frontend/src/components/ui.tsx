import type { ReactNode } from 'react'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-cuc-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cuc-blue focus:ring-2 focus:ring-cuc-blue/30'

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i aria-hidden="true" className={`fa-solid fa-${name} ${className}`} />
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>}
      {children}
    </section>
  )
}

export function Field({ label, hint, error, right, children }: { label: string; hint?: string; error?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-700">{label}</label>
        {right}
      </div>
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">
          {error}
        </p>
      )}
    </div>
  )
}

type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger'
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-100 text-cuc-blue',
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
}
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

/**
 * Deslizador. Mientras `value` sea `undefined` se muestra atenuado ("sin responder"):
 * evita que un valor por defecto pase como respuesta clínica. Se confirma al interactuar.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  label,
  accent = 'accent-cuc-blue',
}: {
  value: number | undefined
  onChange: (v: number) => void
  min: number
  max: number
  label: string
  accent?: string
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value ?? min}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onChange(Number(e.currentTarget.value))}
      className={`w-full ${accent} ${value === undefined ? 'opacity-40' : ''}`}
    />
  )
}

export function NumSelect({
  value,
  onChange,
  options,
  label,
  placeholder = 'Seleccione…',
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  options: { value: number; label: string }[]
  label: string
  placeholder?: string
}) {
  return (
    <select
      aria-label={label}
      value={value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className={`${inputClass} cursor-pointer`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Notificación modal del sistema (igual que el mockup). */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-cuc-navy p-4 text-white">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="circle-info" className="text-blue-400" />
            <span>{title}</span>
          </h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-300 hover:text-white">
            <Icon name="xmark" />
          </button>
        </div>
        <div className="space-y-3 p-5 text-xs text-slate-700">{children}</div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-cuc-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
