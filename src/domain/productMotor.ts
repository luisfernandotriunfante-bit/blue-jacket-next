import * as XLSX from 'xlsx'
import type { AuditItem } from './types'

export type CanonicalProduct = {
  id: string
  internalCode?: string
  manufacturerCode?: string
  ean?: string
  description?: string
  package?: string
  brand?: string
  category?: string
  subcategory?: string
  unitsPerBox?: number
  availableStock?: number
  totalStock?: number
  reservedStock?: number
  blockedStock?: number
  damagedStock?: number
  sellerPrice?: number
  inTransitQuantity?: number
  inTransitValue?: number
  status: 'active' | 'industry_only' | 'in_transit'
  sources: string[]
}
export type ProductIndicators = { total: number; active: number; industryOnly: number; inTransit: number; stockAuditDifferences: number }
export type ProductMotorResult = { canonicalBase: CanonicalProduct[]; audit: AuditItem[]; indicators: ProductIndicators }
type Row = unknown[]
type Sheet = { rows: Row[] }
const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (value: unknown) => { const result = String(value ?? '').trim(); return result || undefined }
const code = (value: unknown) => { const result = String(value ?? '').replace(/\.0$/, '').replace(/\s/g, '').replace(/^0+(?=\d)/, ''); return result || undefined }
const number = (value: unknown) => { const raw = String(value ?? '').trim(); const normalized = raw.includes(',') && raw.includes('.') ? (raw.lastIndexOf(',') < raw.lastIndexOf('.') ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.')) : raw.replace(',', '.'); const result = Number(normalized); return Number.isFinite(result) ? result : undefined }
const rowsFrom = async (file: File): Promise<Sheet[]> => { const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); return book.SheetNames.map(name => ({ rows: XLSX.utils.sheet_to_json<Row>(book.Sheets[name], { header: 1, defval: '', raw: false }) })) }
const headerAt = (rows: Row[], expected: Record<number, string>) => rows.findIndex(row => Object.entries(expected).every(([index, label]) => norm(row[Number(index)]) === label))
const audit = (id: string, title: string, instruction: string, detail: string, level: AuditItem['level'] = 'ok'): AuditItem => ({ id, title, instruction, detail, level, area: 'produtos' })

export async function processProductMotor(files: File[]): Promise<ProductMotorResult> {
  const results: AuditItem[] = []
  const internal = new Map<string, Partial<CanonicalProduct>>()
  const industry = new Map<string, Partial<CanonicalProduct>>()
  const stock = new Map<string, Partial<CanonicalProduct>>()
  const prices = new Map<string, Partial<CanonicalProduct>>()
  const transit = new Map<string, Partial<CanonicalProduct>>()
  const check105 = new Map<string, number>()
  for (const file of files) for (const { rows } of await rowsFrom(file)) {
    const h286 = headerAt(rows, { 1: 'codigo', 2: 'descricao', 25: 'codbarras', 26: 'codfabricante' })
    const hIndustry = headerAt(rows, { 8: 'sku', 9: 'descricaopadrao', 10: 'ean', 17: 'uncx' })
    const h1118 = headerAt(rows, { 0: 'codigo', 1: 'descricao', 5: 'disponivel', 10: 'estoque', 16: 'codfabricante' })
    const h8011 = headerAt(rows, { 2: 'codprod', 3: 'descricao', 6: 'ean', 10: 'preco' })
    const hCart = headerAt(rows, { 0: 'orderdate', 4: 'material', 5: 'description', 6: 'orderqty', 7: 'billqty' })
    const h105 = headerAt(rows, { 1: 'codigo', 2: 'descricao', 6: 'qtestoque', 23: 'codfab' })
    if (h286 >= 0) { let count = 0; for (const row of rows.slice(h286 + 1)) { const key = code(row[1]); if (!key || internal.has(key)) continue; internal.set(key, { id: `WINTHOR:${key}`, internalCode: key, description: text(row[2]), package: text(row[3]), ean: code(row[25]), manufacturerCode: code(row[26]), brand: text(row[42]), sources: ['Cadastro interno'] }); count++ } results.push(audit('prod-internal', 'Cadastro de produtos reconhecido', `${count.toLocaleString('pt-BR')} itens prontos para juntar.`, 'Os dados internos de produtos foram lidos.')); continue }
    if (hIndustry >= 0) { let count = 0; for (const row of rows.slice(hIndustry + 1)) { const sku = code(row[8]); const ean = code(row[10]); const key = sku ?? ean; if (!key || industry.has(key)) continue; industry.set(key, { id: `INDUSTRIA:${key}`, manufacturerCode: sku, ean, description: text(row[9]), category: text(row[39]), subcategory: text(row[40]), brand: text(row[41]), unitsPerBox: number(row[17]), sources: ['Lista da indústria'] }); count++ } results.push(audit('prod-industry', 'Lista da indústria reconhecida', `${count.toLocaleString('pt-BR')} itens prontos para juntar.`, 'Os dados de identificação, categoria e embalagem foram lidos.')); continue }
    if (h1118 >= 0) { let count = 0; for (const row of rows.slice(h1118 + 1)) { const key = code(row[0]); if (!key || stock.has(key)) continue; stock.set(key, { internalCode: key, description: text(row[1]), package: text(row[2]), availableStock: number(row[5]), totalStock: number(row[10]), reservedStock: number(row[11]), blockedStock: number(row[12]), damagedStock: number(row[13]), manufacturerCode: code(row[16]), sources: ['Estoque atual'] }); count++ } results.push(audit('prod-stock', 'Estoque atual reconhecido', `${count.toLocaleString('pt-BR')} saldos prontos para juntar.`, 'Os saldos atuais foram lidos.')); continue }
    if (h8011 >= 0) { let count = 0; for (const row of rows.slice(h8011 + 1)) { const key = code(row[2]); if (!key || prices.has(key)) continue; prices.set(key, { internalCode: key, description: text(row[3]), ean: code(row[6]), sellerPrice: number(row[10]), sources: ['Preço de venda'] }); count++ } results.push(audit('prod-price', 'Preço de venda reconhecido', `${count.toLocaleString('pt-BR')} preços prontos para juntar.`, 'O preço padrão do vendedor foi lido.')); continue }
    if (hCart >= 0) { let count = 0; for (const row of rows.slice(hCart + 1)) { const key = code(row[4]); const ordered = number(row[6]) ?? 0; const billed = number(row[7]) ?? 0; const pending = Math.max(0, ordered - billed); if (!key || pending <= 0) continue; const existing = transit.get(key); transit.set(key, { id: `TRANSITO:${key}`, manufacturerCode: key, description: text(row[5]), inTransitQuantity: (existing?.inTransitQuantity ?? 0) + pending, inTransitValue: (existing?.inTransitValue ?? 0) + ((number(row[8]) ?? 0) * pending / Math.max(ordered, 1)), sources: ['Carteira em trânsito'] }); count++ } results.push(audit('prod-transit', 'Carteira da indústria reconhecida', `${count.toLocaleString('pt-BR')} itens em trânsito identificados.`, 'Esses itens não aumentaram o estoque disponível.')); continue }
    if (h105 >= 0) { for (const row of rows.slice(h105 + 1)) { const key = code(row[1]); if (key) check105.set(key, number(row[6]) ?? 0) } results.push(audit('prod-105', 'Conferência de estoque reconhecida', 'O saldo será comparado com o estoque atual.', 'Essa fonte não altera a base de produtos.')); continue }
  }
  const products = new Map<string, CanonicalProduct>()
  const byManufacturer = new Map<string, string>(); const byEan = new Map<string, string>()
  const ensure = (key: string, seed?: Partial<CanonicalProduct>) => { let product = products.get(key); if (!product) { product = { id: seed?.id ?? `PRODUTO:${key}`, status: 'industry_only', sources: [], ...seed }; products.set(key, product) } return product }
  const merge = (product: CanonicalProduct, source?: Partial<CanonicalProduct>) => { if (!source) return; for (const [field, value] of Object.entries(source)) if (field !== 'id' && field !== 'sources' && value !== undefined && (product as Record<string, unknown>)[field] === undefined) (product as Record<string, unknown>)[field] = value; for (const origin of source.sources ?? []) if (!product.sources.includes(origin)) product.sources.push(origin) }
  for (const [key, source] of internal) { const product = ensure(`WINTHOR:${key}`, source); product.status = 'active'; if (source.manufacturerCode) byManufacturer.set(source.manufacturerCode, product.id); if (source.ean) byEan.set(source.ean, product.id) }
  const resolve = (source: Partial<CanonicalProduct>, fallback: string) => byManufacturer.get(source.manufacturerCode ?? '') ?? byEan.get(source.ean ?? '') ?? fallback
  for (const [key, source] of industry) { const product = ensure(resolve(source, `INDUSTRIA:${key}`), source); merge(product, source); if (source.manufacturerCode) byManufacturer.set(source.manufacturerCode, product.id); if (source.ean) byEan.set(source.ean, product.id) }
  for (const [key, source] of stock) { const product = ensure(`WINTHOR:${key}`, source); merge(product, source); product.status = 'active'; if (source.manufacturerCode) byManufacturer.set(source.manufacturerCode, product.id) }
  for (const [key, source] of prices) { const product = ensure(`WINTHOR:${key}`, source); merge(product, source) }
  for (const [key, source] of transit) { const product = ensure(resolve(source, `TRANSITO:${key}`), source); merge(product, source); if (product.status !== 'active') product.status = 'in_transit' }
  const canonicalBase = [...products.values()].sort((a, b) => (a.description ?? '').localeCompare(b.description ?? ''))
  let differences = 0; for (const [key, value] of check105) if (stock.has(key) && Math.abs((stock.get(key)?.totalStock ?? 0) - value) > .01) differences++
  if (differences) results.push(audit('prod-stock-diff', 'Há diferenças na conferência de estoque', 'Revise o estoque antes de usar os saldos.', `${differences.toLocaleString('pt-BR')} itens possuem saldo diferente entre os dois relatórios.`, 'attention'))
  if (!canonicalBase.length) results.push(audit('prod-none', 'Nenhum arquivo de produtos foi reconhecido', 'Envie os arquivos do Motor de Produtos.', 'Nenhum dado foi usado.', 'action'))
  const indicators = { total: canonicalBase.length, active: canonicalBase.filter(product => product.status === 'active').length, industryOnly: canonicalBase.filter(product => product.status === 'industry_only').length, inTransit: canonicalBase.filter(product => product.inTransitQuantity).length, stockAuditDifferences: differences }
  results.push(audit('prod-base-ready', 'Base de produtos criada', `${indicators.total.toLocaleString('pt-BR')} produtos na base única.`, 'Itens em trânsito não foram incluídos no estoque disponível.'))
  return { canonicalBase, audit: results, indicators }
}
