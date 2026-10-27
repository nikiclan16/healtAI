import { APP_VERSION, DICTIONARY_VERSION, MODEL_VERSION } from '@/config/app'

/** RNF04.1 — versiones visibles en cabecera y pie. */
export function VersionBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`font-mono text-[11px] ${className}`}>
      sistema v{APP_VERSION} · modelo {MODEL_VERSION} · diccionario {DICTIONARY_VERSION}
    </span>
  )
}
