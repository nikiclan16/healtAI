import type { BatchService } from '../interfaces'
import type { BatchResult } from '../types'
import { httpDownload, httpUpload } from './client'

export const httpBatchService: BatchService = {
  async upload(file) {
    return (await httpUpload('/lotes', file)) as BatchResult
  },
  template: () => httpDownload('/lotes/plantilla', 'plantilla_lote.csv'),
}
