import { DISCLAIMER } from '@/config/app'

/** RF05.3 — advertencia médica obligatoria, visible en toda pantalla autenticada y en el PDF. */
export function Disclaimer() {
  return (
    <div role="note" className="border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
      {DISCLAIMER}
    </div>
  )
}
