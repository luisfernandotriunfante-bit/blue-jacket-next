import type { AuditItem } from './types'

export type CanonicalHistory = {
  id: string
  competence: string
  closingDate: string
  sourceSystem: 'legado'
  customerCode: string
  productCode: string
  quantity: number
  salesValue: number
  discount: number
  netValue: number
  salesLines: number
  sources: string[]
}

export type HistoryIndicators = {
  competencies: number
  records: number
  salesLines: number
  firstCompetence?: string
  lastCompetence?: string
}

export type HistoryMotorResult = { canonicalBase: CanonicalHistory[]; audit: AuditItem[]; indicators: HistoryIndicators }

const saleLine = /^\s*(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\S+)\s+(\d+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/
const number = (value: string) => {
  const raw = value.trim()
  const normal = raw.includes(',') && raw.includes('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.')
  const result = Number(normal)
  return Number.isFinite(result) ? result : 0
}
const toDate = (value: string) => {
  const [day, month, year] = value.split('/').map(Number)
  return new Date(year, month - 1, day)
}
const competenceOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const dateIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const audit = (id: string, title: string, instruction: string, detail: string, level: AuditItem['level'] = 'ok'): AuditItem => ({ id, title, instruction, detail, level, area: 'historico' })

export async function processHistoryMotor(files: File[]): Promise<HistoryMotorResult> {
  const audits: AuditItem[] = []
  const base = new Map<string, CanonicalHistory>()
  const closing = new Map<string, string>()
  const seen = new Set<string>()
  let detailedFiles = 0
  let summaries = 0
  let duplicates = 0
  let sourceLines = 0

  for (const file of files) {
    const content = (await file.text()).replace(/\u0000/g, '')
    if (/compras\s+por\s+cliente/i.test(content)) {
      summaries++
      continue
    }
    if (!/vendas\s+\d{2}\/[A-Z]{3}\/\d{4}\s+a\s+\d{2}\/[A-Z]{3}\/\d{4}\s+analitico\s+detalhado/i.test(content)) {
      audits.push(audit(`history-layout-${crypto.randomUUID()}`, 'Um arquivo não foi reconhecido', 'Envie o relatório detalhado de vendas do legado.', 'O arquivo não contém o cabeçalho esperado para vendas detalhadas. Nenhum dado dele foi usado.', 'action'))
      continue
    }
    detailedFiles++
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(saleLine)
      if (!match) continue
      const signature = line.trim()
      if (seen.has(signature)) { duplicates++; continue }
      seen.add(signature)
      const [, dateText, invoice, series, productCode, quantityText, valueText, discountText, , , , customerCode] = match
      const date = toDate(dateText)
      const competence = competenceOf(date)
      const closingDate = dateIso(date)
      const key = `${competence}|${customerCode}|${productCode}`
      const quantity = number(quantityText)
      const salesValue = number(valueText)
      const discount = number(discountText)
      const existing = base.get(key)
      if (existing) {
        existing.quantity += quantity
        existing.salesValue += salesValue
        existing.discount += discount
        existing.netValue += salesValue - discount
        existing.salesLines++
      } else {
        base.set(key, { id: `LEGADO:${key}`, competence, closingDate, sourceSystem: 'legado', customerCode, productCode, quantity, salesValue, discount, netValue: salesValue - discount, salesLines: 1, sources: ['Vendas detalhadas do legado'] })
      }
      const oldClosing = closing.get(competence)
      if (!oldClosing || closingDate > oldClosing) closing.set(competence, closingDate)
      sourceLines++
      void invoice; void series
    }
  }

  const canonicalBase = [...base.values()].map(record => ({ ...record, closingDate: closing.get(record.competence) ?? record.closingDate })).sort((a, b) => a.competence.localeCompare(b.competence) || a.customerCode.localeCompare(b.customerCode) || a.productCode.localeCompare(b.productCode))
  const competencies = [...closing.keys()].sort()
  if (detailedFiles) audits.push(audit('history-sales-ready', 'Vendas históricas organizadas', `${competencies.length} competência(s) mensal(is) pronta(s) para uso.`, `${sourceLines.toLocaleString('pt-BR')} linhas de vendas foram consolidadas por cliente, produto e mês.`))
  if (summaries) audits.push(audit('history-summary-ready', 'Consolidado por cliente reconhecido', 'Use este relatório como conferência das vendas.', 'O consolidado não possui a data de cada venda. Por isso ele não entra na base mensal e não altera os valores consolidados.'))
  if (duplicates) audits.push(audit('history-duplicates', 'Linhas repetidas foram ignoradas', 'Confira os arquivos se a repetição não era esperada.', `${duplicates.toLocaleString('pt-BR')} linha(s) idêntica(s) não foram somadas duas vezes.`, 'attention'))
  if (competencies.length) audits.push(audit('history-closing-dates', 'Fechamentos mensais identificados', 'Confira a data de fechamento de cada competência antes de usar o histórico.', 'Cada competência usa a última data que aparece no relatório de vendas. Isso representa o último dia disponível no sistema legado.'))
  audits.push(audit('history-stock-missing', 'Faltam as fotografias mensais de estoque', 'Adicione os relatórios de posição de estoque de cada fechamento quando estiverem disponíveis.', 'Os arquivos recebidos têm vendas, mas não possuem saldos de estoque por mês. A base não cria nem estima esses saldos.', 'attention'))
  if (!canonicalBase.length) audits.push(audit('history-none', 'Nenhuma venda histórica foi encontrada', 'Envie os relatórios detalhados de vendas do legado.', 'Nenhuma linha de venda foi usada para criar a base mensal.', 'action'))
  return { canonicalBase, audit: audits, indicators: { competencies: competencies.length, records: canonicalBase.length, salesLines: sourceLines, firstCompetence: competencies[0], lastCompetence: competencies.at(-1) } }
}
