export type SourceArea = 'diario' | 'produtos' | 'clientes' | 'movimentacoes' | 'historico'

export type UploadedFile = {
  id: string
  name: string
  size: number
  area: SourceArea
  receivedAt: string
}

export type AuditItem = {
  id: string
  level: 'action' | 'attention' | 'ok'
  title: string
  instruction: string
  detail: string
  area: SourceArea
}
