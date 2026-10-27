import type { ReactNode } from 'react'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-cuc-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cuc-blue focus:ring-2 focus:ring-cuc-blue/30'

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>}
      {children}
    </section>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
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

interface Option<T> {
  value: T
  label: string
}

/** Grupo de opciones tipo radio (escalas Likert / ordinales). */
export function OptionGroup<T extends number>({
  value,
  onChange,
  options,
  label,
  columns,
}: {
  value: T | undefined
  onChange: (v: T) => void
  options: Option<T>[]
  label: string
  columns?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns ?? 'grid-cols-2 sm:grid-cols-5'}`}>
      {options.map((o) => {
        const selected = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
              selected
                ? 'border-cuc-blue bg-cuc-light font-bold text-cuc-blue'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="font-mono">{o.value}</span> · {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Casilla binaria 0/1 del contrato de datos. */
export function BinaryCheck({ label, value, onChange }: { label: string; value: 0 | 1 | undefined; onChange: (v: 0 | 1) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={value === 1}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        className="h-4 w-4 rounded border-slate-300 text-cuc-blue"
      />
      {label}
    </label>
  )
}
