import type { UploadedFile } from '../../src/domain/types'

export const sampleUploadedFiles: UploadedFile[] = [
  { id: '1', name: 'produtos-teste.xlsx', size: 100, area: 'produtos', receivedAt: '2026-01-05T10:00:00.000Z' },
  { id: '2', name: 'clientes-teste.xlsx', size: 200, area: 'clientes', receivedAt: '2026-01-05T10:00:00.000Z' },
  { id: '3', name: 'clientes-teste-2.xlsx', size: 150, area: 'clientes', receivedAt: '2026-01-06T10:00:00.000Z' },
]
