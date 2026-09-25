import * as XLSX from 'xlsx'

type Row = unknown[]
const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const headerAt = (rows: Row[], expected: Record<number, string>) =>
  rows.findIndex(row => Object.entries(expected).every(([index, label]) => norm(row[Number(index)]) === label))

export type FileDetection =
  | { motor: 'produtos'; slot: 'internal' | 'industry' | 'stock' | 'price' | 'sortiment' }
  | { motor: 'clientes'; slot: 'internal' | 'portfolio' | 'premises' }
  | { motor: 'movimentacoes'; slot: 'sales' | 'cuts' }
  | { motor: 'historico'; slot: 'sales' | 'summary' }
  | { motor: 'recebimentos'; slot: 'legacy' | 'current' | 'portfolio' }
  | null

export async function detectFile(file: File): Promise<FileDetection> {
  try {
    if (file.name.toLowerCase().endsWith('.txt')) {
      const content = (await file.text()).replace(/\u0000/g, '')
      if (/vendas\s+\d{2}\/[A-Z]{3}\/\d{4}\s+a\s+\d{2}\/[A-Z]{3}\/\d{4}\s+analitico\s+detalhado/i.test(content))
        return { motor: 'historico', slot: 'sales' }
      if (/compras\s+por\s+cliente/i.test(content))
        return { motor: 'historico', slot: 'summary' }
      if (/relacao\s+de\s+notas\s+fiscais/i.test(content))
        return { motor: 'recebimentos', slot: 'legacy' }
      return null
    }

    if (!file.name.toLowerCase().match(/\.xlsx?$/)) return null

    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    for (const sheetName of book.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Row>(book.Sheets[sheetName], { header: 1, defval: '', raw: false })
      if (headerAt(rows, { 1: 'codigo', 2: 'descricao', 25: 'codbarras', 26: 'codfabricante' }) >= 0)
        return { motor: 'produtos', slot: 'internal' }
      if (headerAt(rows, { 8: 'sku', 9: 'descricaopadrao', 10: 'ean', 17: 'uncx' }) >= 0)
        return { motor: 'produtos', slot: 'industry' }
      if (headerAt(rows, { 0: 'codigo', 1: 'descricao', 5: 'disponivel', 10: 'estoque', 16: 'codfabricante' }) >= 0)
        return { motor: 'produtos', slot: 'stock' }
      if (headerAt(rows, { 2: 'codprod', 3: 'descricao', 6: 'ean', 10: 'preco' }) >= 0)
        return { motor: 'produtos', slot: 'price' }
      if (headerAt(rows, { 0: 'materialsap', 16: 'st', 18: 'lifestage' }) >= 0)
        return { motor: 'produtos', slot: 'sortiment' }
      if (rows.some(row => norm(row[2]) === 'datamovimento' && norm(row[3]) === 'codcliente' && norm(row[24]) === 'codprodwinthor'))
        return { motor: 'movimentacoes', slot: 'sales' }
      if (rows.some(row => norm(row[0]).includes('consultarcortedemercadorias')))
        return { motor: 'movimentacoes', slot: 'cuts' }
      if (rows.some(row => norm(row[0]).includes('relentradademercadoria')))
        return { motor: 'recebimentos', slot: 'current' }
      if (rows.some(row => norm(row[0]) === 'orderdate' && norm(row[4]) === 'material' && norm(row[6]) === 'orderqty'))
        return { motor: 'recebimentos', slot: 'portfolio' }
      if (headerAt(rows, { 0: 'codigo', 5: 'cpfcnpj', 10: 'codrca', 12: 'codsupervisor' }) >= 0)
        return { motor: 'clientes', slot: 'internal' }
      if (headerAt(rows, { 0: 'codigocliente', 1: 'cnpj', 12: 'frequencia', 15: 'representante' }) >= 0)
        return { motor: 'clientes', slot: 'portfolio' }
      if (headerAt(rows, { 0: 'semestrepremissa', 2: 'codcliente', 15: 'checkpdv' }) >= 0)
        return { motor: 'clientes', slot: 'premises' }
    }
  } catch { /* arquivo ilegível vai para não reconhecido */ }
  return null
}
