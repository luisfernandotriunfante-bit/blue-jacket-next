import * as XLSX from 'xlsx'
import type { AuditItem } from './types'

export type CanonicalClient = {
  document: string
  winthorCode?: string
  legalName?: string
  tradeName?: string
  city?: string
  rcaCode?: string
  rcaName?: string
  supervisor?: string
  creditDueDate?: string
  commercialActivity?: string
  district?: string
  address?: string
  latitude?: string
  longitude?: string
  visitFrequency?: string
  visitDay?: string
  daysWithoutPurchase?: string
  representative?: string
  premiseSemester?: string
  channelType?: string
  premiseRange?: string
  premiseState?: string
  premiseCluster?: string
  premiseAverage12Months?: number
  premiseProfile?: string
  premiseNetwork?: string
  sources: string[]
}

export type ClientMotorResult = {
  canonicalBase: CanonicalClient[]
  audit: AuditItem[]
  indicators: { totalClients: number; internal: number; portfolio: number; premises: number; complete: number }
}

type Row = unknown[]
type SheetCandidate = { rows: Row[]; sheet: string }
const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (value: unknown) => { const result = String(value ?? '').trim(); return result || undefined }
const documentKey = (value: unknown) => String(value ?? '').replace(/\D/g, '')
const at = (row: Row, index: number) => row[index]
const hasDocument = (value: unknown) => { const d = documentKey(value); return d.length === 11 || d.length === 14 }

async function readRows(file: File): Promise<SheetCandidate[]> {
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true })
  return workbook.SheetNames.map(sheet => ({ sheet, rows: XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheet], { header: 1, defval: '', raw: false }) }))
}

function headerAt(rows: Row[], labels: Record<number, string>) {
  return rows.findIndex(row => Object.entries(labels).every(([index, label]) => norm(at(row, Number(index))) === label))
}

function nearbyLayoutWarning(rows: Row[], expected: Record<number, string>, title: string): AuditItem | null {
  const expectedLabels = new Set(Object.values(expected))
  const row = rows.slice(0, 12).find(candidate => candidate.some(cell => expectedLabels.has(norm(cell))))
  if (!row) return null
  const missing = Object.entries(expected).find(([index, label]) => norm(at(row, Number(index))) !== label)
  return { id: `layout-${title}-${Math.random()}`, level: 'action', title: 'O formato de um arquivo mudou', instruction: 'Use a versão habitual do relatório e envie novamente.', detail: missing ? `Encontramos um relatório parecido, mas a coluna “${missing[1]}” não está no lugar esperado. Nenhum dado desse arquivo foi usado.` : 'Nenhum dado desse arquivo foi usado.', aiDetail: missing ? `Fonte candidata: ${title}. Contrato de posição fixa violado. Esperado: coluna ${Number(missing[0]) + 1} com cabeçalho normalizado ${missing[1]}. Não processar essa fonte até que o contrato seja atualizado ou o arquivo seja corrigido.` : `Fonte candidata: ${title}. Nenhuma linha foi aceita.`, area: 'clientes' }
}

export async function processClientMotor(files: File[]): Promise<ClientMotorResult> {
  const audit: AuditItem[] = []
  const internal = new Map<string, Partial<CanonicalClient>>()
  const portfolio = new Map<string, Partial<CanonicalClient>>()
  const premises = new Map<string, Partial<CanonicalClient>>()
  const candidateWorkbooks = await Promise.all(files.map(async file => ({ file, sheets: await readRows(file) })))

  for (const { sheets } of candidateWorkbooks) {
    const hasPdvSheet = sheets.some(({ rows }) => headerAt(rows, { 0: 'semestrepremissa', 2: 'codcliente', 15: 'checkpdv' }) >= 0)
    for (const { rows } of sheets) {
      const internalHeader = headerAt(rows, { 0: 'codigo', 5: 'cpfcnpj', 10: 'codrca', 12: 'codsupervisor' })
      const portfolioHeader = headerAt(rows, { 0: 'codigocliente', 1: 'cnpj', 12: 'frequencia', 15: 'representante' })
      const pdvHeader = headerAt(rows, { 0: 'semestrepremissa', 2: 'codcliente', 15: 'checkpdv' })
      const fallbackStart = rows.findIndex(row => hasDocument(at(row, 1)) && text(at(row, 12)) && text(at(row, 13)) && text(at(row, 15)))

      if (internalHeader >= 0) {
        let accepted = 0
        for (const row of rows.slice(internalHeader + 1)) {
          const key = documentKey(at(row, 5)); if (!hasDocument(key)) continue
          if (internal.has(key)) continue
          internal.set(key, { document: key, winthorCode: text(at(row, 0)), legalName: text(at(row, 1)), tradeName: text(at(row, 2)), city: text(at(row, 6)), rcaCode: text(at(row, 10)), rcaName: text(at(row, 11)), supervisor: text(at(row, 13)), creditDueDate: text(at(row, 17)), sources: ['Cadastro interno'] }); accepted++
        }
        audit.push({ id: 'internal-ok', level: 'ok', title: 'Cadastro interno reconhecido', instruction: `${accepted.toLocaleString('pt-BR')} clientes prontos para juntar.`, detail: 'Os dados de identificação e referência comercial foram lidos.', area: 'clientes' }); continue
      }
      if (portfolioHeader >= 0 || fallbackStart >= 0) {
        const start = portfolioHeader >= 0 ? portfolioHeader + 1 : fallbackStart
        if (hasPdvSheet) { audit.push({ id: `portfolio-ignored-${audit.length}`, level: 'ok', title: 'Aba auxiliar ignorada', instruction: 'Nada precisa ser feito.', detail: 'A carteira dentro da Base de Premissas não alterou a base de clientes.', area: 'clientes' }); continue }
        let accepted = 0
        for (const row of rows.slice(start)) {
          const key = documentKey(at(row, 1)); if (!hasDocument(key)) continue
          if (portfolio.has(key)) continue
          portfolio.set(key, { document: key, winthorCode: text(at(row, 0)), legalName: text(at(row, 2)), tradeName: text(at(row, 3)), commercialActivity: text(at(row, 4)), city: text(at(row, 5)), district: text(at(row, 6)), address: text(at(row, 7)), latitude: text(at(row, 8)), longitude: text(at(row, 9)), visitFrequency: text(at(row, 12)), visitDay: text(at(row, 13)), daysWithoutPurchase: text(at(row, 14)), representative: text(at(row, 15)), rcaCode: text(at(row, 15)), sources: ['Carteira de clientes'] }); accepted++
        }
        audit.push({ id: `portfolio-ok-${audit.length}`, level: 'ok', title: 'Carteira de clientes reconhecida', instruction: `${accepted.toLocaleString('pt-BR')} clientes prontos para juntar.`, detail: 'Os dados de endereço, frequência e visita foram lidos.', area: 'clientes' }); continue
      }
      if (pdvHeader >= 0) {
        let accepted = 0
        for (const row of rows.slice(pdvHeader + 1)) {
          const key = documentKey(at(row, 2)); if (!hasDocument(key)) continue
          if (premises.has(key)) continue
          const average = Number(String(at(row, 10)).replace(',', '.'))
          premises.set(key, { document: key, winthorCode: text(at(row, 3)), legalName: text(at(row, 4)), premiseSemester: text(at(row, 0)), channelType: text(at(row, 1)), premiseRange: text(at(row, 5)), premiseState: text(at(row, 6)), city: text(at(row, 7)), premiseCluster: text(at(row, 9)), premiseAverage12Months: Number.isFinite(average) ? average : undefined, premiseProfile: text(at(row, 13)), premiseNetwork: text(at(row, 16)), sources: ['Premissas'] }); accepted++
        }
        audit.push({ id: 'premises-ok', level: 'ok', title: 'Premissas reconhecidas', instruction: `${accepted.toLocaleString('pt-BR')} clientes prontos para juntar.`, detail: 'Os dados de faixa, ambiente, perfil e rede foram lidos.', area: 'clientes' }); continue
      }
      const warning = nearbyLayoutWarning(rows, { 0: 'codigo', 5: 'cpfcnpj', 10: 'codrca' }, 'clientes') ?? nearbyLayoutWarning(rows, { 0: 'codigocliente', 1: 'cnpj', 15: 'representante' }, 'carteira') ?? nearbyLayoutWarning(rows, { 0: 'semestrepremissa', 2: 'codcliente', 15: 'checkpdv' }, 'premissas')
      if (warning) audit.push(warning)
    }
  }

  if (!internal.size && !portfolio.size && !premises.size) audit.push({ id: 'no-client-source', level: 'action', title: 'Nenhum arquivo de clientes foi reconhecido', instruction: 'Envie o cadastro interno, a carteira ou as premissas.', detail: 'O sistema não encontrou a estrutura esperada nos arquivos enviados. Nenhum dado foi usado.', area: 'clientes' })
  const allKeys = new Set([...internal.keys(), ...portfolio.keys(), ...premises.keys()])
  const canonicalBase = [...allKeys].map(document => {
    const current: CanonicalClient = { document, sources: [] }
    const merge = (input?: Partial<CanonicalClient>) => { if (!input) return; for (const [key, value] of Object.entries(input)) { if (key === 'sources') continue; if (value !== undefined && (current as Record<string, unknown>)[key] === undefined) (current as Record<string, unknown>)[key] = value }; for (const source of input.sources ?? []) if (!current.sources.includes(source)) current.sources.push(source) }
    const internalData = internal.get(document); const portfolioData = portfolio.get(document); const premisesData = premises.get(document)
    merge(internalData); merge(portfolioData); merge(premisesData)
    // Hierarquia padrão: 1203, Carteira e Premissas. RCA é a única exceção:
    // a Carteira define o responsável atual; o nome do 1203 não é preservado
    // para não associar um nome antigo ao código atual.
    current.rcaCode = portfolioData?.rcaCode
    delete current.rcaName
    return current
  }).sort((a, b) => a.document.localeCompare(b.document))
  const indicators = { totalClients: canonicalBase.length, internal: internal.size, portfolio: portfolio.size, premises: premises.size, complete: canonicalBase.filter(client => client.sources.length >= 3).length }
  audit.push({ id: 'client-base-ready', level: 'ok', title: 'Base de clientes criada', instruction: `${indicators.totalClients.toLocaleString('pt-BR')} clientes na base única.`, detail: 'A base reuniu todos os clientes encontrados, mesmo quando uma fonte não tinha todas as informações.', area: 'clientes' })
  return { canonicalBase, audit, indicators }
}
