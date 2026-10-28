import type { InvestigatorService } from '../interfaces'
import type { InvestigatorMetrics } from '../types'
import { httpDownload, httpJson } from './client'

export const httpInvestigatorService: InvestigatorService = {
  async metrics() {
    return (await httpJson('/investigador/metricas')) as InvestigatorMetrics
  },
  exportEvaluations: () => httpDownload('/investigador/evaluaciones.csv', 'evaluaciones.csv'),
  exportAudit: () => httpDownload('/investigador/auditoria.csv', 'auditoria.csv'),
}
