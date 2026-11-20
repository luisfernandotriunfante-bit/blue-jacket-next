import type { AuditItem } from './types'
import type { CanonicalProduct } from './productMotor'

export type CanonicalHistory = {
  id: string
  date: string
  competence: string
  sourceSystem: 'legado'
  customerCode: string
  productCode: string
  winthorCode?: string
  sellerCode?: string
  invoiceNumber?: string
  quantity: number
  salesValue: number
  discount: number
  netValue: number
  sources: string[]
}

export type HistoryIndicators = {
  records: number
  competencies: number
  salesLines: number
  firstDate?: string
  lastDate?: string
}

export type HistoryMotorResult = { canonicalBase: CanonicalHistory[]; audit: AuditItem[]; indicators: HistoryIndicators }

// Grupo [13] = código RCA (vendedor) com zeros à esquerda, ex: 0701
// Grupo [12] = CNPJ do cliente
// Grupo [11] = CNPJ da empresa (constante, ignorado)
const saleLine = /^\s*(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(\S+)\s+(\S+)\s+([\d.,-]+)\s+([\d.,-]+)\s+([\d.,-]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/
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
const audit = (id: string, title: string, instruction: string, detail: string, level: AuditItem['level'] = 'ok', aiDetail?: string): AuditItem => ({ id, title, instruction, detail, level, aiDetail, area: 'historico' })

async function parseLegacyCatalog(file: File): Promise<Map<string, string>> {
  const content = (await file.text()).replace(/\u0000/g, '')
  const map = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const codeMatch = line.match(/^(\d{8})\s/)
    if (!codeMatch) continue
    const eanMatch = line.match(/\b(\d{13})\b/)
    if (!eanMatch) continue
    map.set(codeMatch[1], eanMatch[1])
  }
  return map
}

export async function processHistoryMotor(files: File[], options?: { catalogFile?: File; productBase?: CanonicalProduct[] }): Promise<HistoryMotorResult> {
  const audits: AuditItem[] = []
  const base: CanonicalHistory[] = []
  const seen = new Set<string>()
  const competenceSet = new Set<string>()
  let detailedFiles = 0
  let duplicates = 0
  let firstDate: string | undefined
  let lastDate: string | undefined
  let catalogHits = 0
  let prefixHits = 0
  const unmatchedCodes = new Set<string>()

  const legacyToEan = options?.catalogFile ? await parseLegacyCatalog(options.catalogFile) : new Map<string, string>()
  const eanToWinthor = new Map<string, string>()
  if (options?.productBase) {
    for (const product of options.productBase) {
      if (product.ean && product.internalCode) eanToWinthor.set(product.ean, product.internalCode)
    }
  }

  for (const file of files) {
    const content = (await file.text()).replace(/\u0000/g, '')
    if (!/vendas\s+\d{2}\/[A-Z]{3}\/\d{4}\s+a\s+\d{2}\/[A-Z]{3}\/\d{4}\s+analitico\s+detalhado/i.test(content)) {
      audits.push(audit(`history-layout-${crypto.randomUUID()}`, 'Um arquivo não foi reconhecido', 'Envie o relatório detalhado de vendas do legado.', 'O arquivo não contém o cabeçalho esperado para vendas detalhadas. Nenhum dado dele foi usado.', 'action', `O arquivo "${file.name}" não contém a linha "VENDAS <data> a <data> ANALITICO DETALHADO" esperada no início do relatório de vendas detalhadas do legado. Pedir ao usuário o relatório de vendas detalhadas gerado pelo sistema legado, sem edições.`))
      continue
    }
    detailedFiles++
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(saleLine)
      if (!match) continue
      const signature = line.trim()
      if (seen.has(signature)) { duplicates++; continue }
      seen.add(signature)
      const [, dateText, invoiceRaw, , productCode, quantityText, valueText, discountText, , , , , customerCode, sellerCode] = match
      const date = toDate(dateText)
      const dateStr = dateIso(date)
      const competence = competenceOf(date)
      const quantity = number(quantityText)
      const salesValue = number(valueText)
      const discount = number(discountText)
      const invoice = invoiceRaw.replace(/^0+(?=\d)/, '') || invoiceRaw

      let winthorCode: string | undefined
      if (legacyToEan.size > 0) {
        const ean = legacyToEan.get(productCode)
        if (ean) {
          const fromCatalog = eanToWinthor.get(ean)
          if (fromCatalog) { winthorCode = fromCatalog; catalogHits++ }
        }
      }
      if (!winthorCode && productCode.startsWith('111') && productCode.length === 8) {
        winthorCode = productCode.slice(3).replace(/^0+(?=\d)/, '') || productCode.slice(3)
        prefixHits++
      }
      if (!winthorCode) unmatchedCodes.add(legacyToEan.get(productCode) ?? productCode)

      competenceSet.add(competence)
      if (!firstDate || dateStr < firstDate) firstDate = dateStr
      if (!lastDate || dateStr > lastDate) lastDate = dateStr
      base.push({
        id: `LEGADO:${dateStr}:${invoice}:${productCode}:${customerCode}`,
        date: dateStr,
        competence,
        sourceSystem: 'legado',
        customerCode,
        productCode,
        winthorCode,
        sellerCode: sellerCode || undefined,
        invoiceNumber: invoice,
        quantity,
        salesValue,
        discount,
        netValue: salesValue - discount,
        sources: ['Vendas detalhadas do legado'],
      })
    }
  }

  const canonicalBase = base.sort((a, b) => a.date.localeCompare(b.date) || a.customerCode.localeCompare(b.customerCode) || a.productCode.localeCompare(b.productCode))
  const competencies = [...competenceSet].sort()
  if (detailedFiles) audits.push(audit('history-sales-ready', 'Vendas históricas organizadas', `${competencies.length} competência(s) — ${canonicalBase.length.toLocaleString('pt-BR')} linhas individuais.`, `Cada linha de venda foi mantida com data exata, CNPJ do cliente e código do vendedor.`))
  if (duplicates) audits.push(audit('history-duplicates', 'Linhas repetidas foram ignoradas', 'Confira os arquivos se a repetição não era esperada.', `${duplicates.toLocaleString('pt-BR')} linha(s) idêntica(s) não foram duplicadas.`, 'attention', `${duplicates.toLocaleString('pt-BR')} linha(s) com o mesmo texto exato apareceram mais de uma vez nos arquivos de vendas do legado enviados — provável reenvio do mesmo arquivo ou sobreposição de período entre dois arquivos. As duplicatas já foram descartadas automaticamente; conferir se os arquivos enviados cobrem períodos diferentes.`))
  if (legacyToEan.size > 0) {
    const unmatched = canonicalBase.length - catalogHits - prefixHits
    const sample = [...unmatchedCodes].slice(0, 20)
    const more = unmatchedCodes.size > sample.length ? ` e mais ${(unmatchedCodes.size - sample.length).toLocaleString('pt-BR')} código(s)` : ''
    audits.push(audit(
      'history-catalog-match',
      'De-para Milênio aplicado',
      `${legacyToEan.size.toLocaleString('pt-BR')} itens no catálogo. ${catalogHits.toLocaleString('pt-BR')} via EAN, ${prefixHits.toLocaleString('pt-BR')} via prefixo 111.`,
      unmatched > 0
        ? `${unmatched.toLocaleString('pt-BR')} linha(s) sem código Winthor correspondente.`
        : 'Todas as linhas de venda foram associadas a um código Winthor.',
      unmatched > 0 ? 'attention' : 'ok',
      unmatched > 0
        ? `Código(s) de origem (EAN quando disponível no catálogo Milênio, senão o código do legado) sem produto Winthor correspondente: ${sample.join(', ')}${more}. Conferir esses códigos no catálogo Milênio (relação complementar) ou adicionar o EAN correspondente na base de produtos.`
        : undefined
    ))
  }
  audits.push(audit('history-stock-missing', 'Faltam as fotografias mensais de estoque', 'Adicione os relatórios de posição de estoque de cada fechamento quando estiverem disponíveis.', 'Os arquivos recebidos têm vendas, mas não possuem saldos de estoque por mês.', 'attention', 'O motor de histórico não recebe nem rastreia relatórios de posição de estoque mensal; esse dado não existe na base atual, então não há como listar quais meses faltam. Pedir ao usuário um relatório de fechamento de estoque por mês (um arquivo por mês, com o mês identificável no nome) para que esse controle possa ser implementado.'))
  if (!canonicalBase.length) audits.push(audit('history-none', 'Nenhuma venda histórica foi encontrada', 'Envie os relatórios detalhados de vendas do legado.', 'Nenhuma linha de venda foi usada para criar a base.', 'action', 'Nenhuma linha bateu com o padrão de vendas detalhadas do legado (data, pedido, produto, quantidade, valor, desconto, cliente, vendedor) em nenhum arquivo enviado. Pedir ao usuário o relatório "Vendas <período> Analítico Detalhado" do sistema legado.'))
  return { canonicalBase, audit: audits, indicators: { records: canonicalBase.length, competencies: competencies.length, salesLines: canonicalBase.length, firstDate, lastDate } }
}
