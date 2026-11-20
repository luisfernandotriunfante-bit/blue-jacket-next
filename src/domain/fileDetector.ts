import * as XLSX from 'xlsx'

type Row = unknown[]
const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Acha a linha de cabeçalho pela PRESENÇA dos rótulos em qualquer coluna da
// linha, não por posição fixa. Isso é o que permite reconhecer um arquivo
// mesmo quando as colunas foram reordenadas na fonte (Winthor, indústria etc.).
const anchorsAt = (rows: Row[], labels: string[]) => {
  const wanted = labels.map(norm)
  return rows.findIndex(row => {
    const cells = row.map(cell => norm(cell))
    return wanted.every(label => cells.includes(label))
  })
}

export type FileDetection =
  | { motor: 'produtos'; slot: 'internal' | 'industry' | 'stock' | 'price' | 'subbrands' | 'sortiment' }
  | { motor: 'clientes'; slot: 'internal' | 'portfolio' | 'route' | 'premises' }
  | { motor: 'movimentacoes'; slot: 'sales' | 'cuts' }
  | { motor: 'historico'; slot: 'sales' | 'catalog' }
  | { motor: 'recebimentos'; slot: 'legacy' | 'current' | 'portfolio' }
  | null

export async function detectFile(file: File): Promise<FileDetection> {
  try {
    if (file.name.toLowerCase().endsWith('.txt')) {
      const content = (await file.text()).replace(/\u0000/g, '')
      if (/vendas\s+\d{2}\/[A-Z]{3}\/\d{4}\s+a\s+\d{2}\/[A-Z]{3}\/\d{4}\s+analitico\s+detalhado/i.test(content))
        return { motor: 'historico', slot: 'sales' }
      if (/RELACAO\s+COMPLEMENTAR\s+-\s+CADASTRO\s+DE\s+ITENS/i.test(content) && /MILENIO/i.test(content))
        return { motor: 'historico', slot: 'catalog' }
      if (/relacao\s+de\s+notas\s+fiscais/i.test(content))
        return { motor: 'recebimentos', slot: 'legacy' }
      return null
    }

    if (!file.name.toLowerCase().match(/\.xlsx?$/)) return null

    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    for (const sheetName of book.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Row>(book.Sheets[sheetName], { header: 1, defval: '', raw: false })
      if (anchorsAt(rows, ['codigo', 'descricao', 'codbarras', 'codfabricante']) >= 0)
        return { motor: 'produtos', slot: 'internal' }
      if (anchorsAt(rows, ['sku', 'descricaopadrao', 'ean', 'uncx']) >= 0)
        return { motor: 'produtos', slot: 'industry' }
      if (anchorsAt(rows, ['codigo', 'descricao', 'disponivel', 'estoque', 'codfabricante']) >= 0)
        return { motor: 'produtos', slot: 'stock' }
      if (anchorsAt(rows, ['codprod', 'descricao', 'ean', 'preco']) >= 0)
        return { motor: 'produtos', slot: 'price' }
      if (anchorsAt(rows, ['nomedistribuidor', 'subbrands', 'codigodoprodutoean13']) >= 0)
        return { motor: 'produtos', slot: 'subbrands' }
      if (anchorsAt(rows, ['materialsap', 'st', 'lifestage']) >= 0)
        return { motor: 'produtos', slot: 'sortiment' }
      if (rows.some(row => { const n = (row as unknown[]).map(c => norm(c)); return n.includes('categoriamaster') && n.some(v => v === 'hiper' || v === 'hipermercado') }))
        return { motor: 'produtos', slot: 'sortiment' }
      if (anchorsAt(rows, ['datamovimento', 'codcliente', 'codprodwinthor']) >= 0)
        return { motor: 'movimentacoes', slot: 'sales' }
      if (rows.some(row => row.some(cell => norm(cell).includes('consultarcortedemercadorias'))))
        return { motor: 'movimentacoes', slot: 'cuts' }
      if (rows.some(row => row.some(cell => norm(cell).includes('relentradademercadoria'))))
        return { motor: 'recebimentos', slot: 'current' }
      if (anchorsAt(rows, ['orderdate', 'material', 'orderqty']) >= 0)
        return { motor: 'recebimentos', slot: 'portfolio' }
      if (anchorsAt(rows, ['codigo', 'cpfcnpj', 'codrca', 'codsupervisor']) >= 0)
        return { motor: 'clientes', slot: 'internal' }
      if (anchorsAt(rows, ['codigocliente', 'cnpj', 'recorrencia', 'diadasemana']) >= 0)
        return { motor: 'clientes', slot: 'route' }
      if (anchorsAt(rows, ['cnpj', 'frequencia', 'representante']) >= 0)
        return { motor: 'clientes', slot: 'portfolio' }
      if (anchorsAt(rows, ['semestrepremissa', 'codcliente', 'checkpdv']) >= 0)
        return { motor: 'clientes', slot: 'premises' }
    }
  } catch { /* arquivo ilegível vai para não reconhecido */ }
  return null
}
