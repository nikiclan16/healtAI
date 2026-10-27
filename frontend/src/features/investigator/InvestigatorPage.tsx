import { Card } from '@/components/ui'

/** Placeholder (fase 2): métricas globales, PSI/KS y descarga de auditoría (RF01.1, RNF04.2). */
export function InvestigatorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Panel del investigador</h1>
      <Card title="Pendiente de backend">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>Métricas globales por sede (BAQ, RHA, VUP).</li>
          <li>Telemetría de Data Drift: PSI y Kolmogorov-Smirnov por variable.</li>
          <li>Concordancia modelo vs. profesional (Concept Drift).</li>
          <li>Descarga de la bitácora de auditoría.</li>
        </ul>
      </Card>
    </div>
  )
}
