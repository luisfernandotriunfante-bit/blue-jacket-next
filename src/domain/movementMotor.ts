import * as XLSX from 'xlsx'
import type { AuditItem } from './types'

export type MovementType = 'venda_faturada' | 'a_faturar' | 'devolucao' | 'bonificacao' | 'corte' | 'entrada'
export type CanonicalMovement = {
  id: string
  movementDate?: string
  movementType: MovementType
  orderId?: string
  invoiceNumber?: string
  customerCode?: string
  customerDocument?: string
  customerName?: string
  productCode?: string
  manufacturerCode?: string
  description?: string
  quantity?: number
  value?: number
  orderStatus?: string
  saleType?: string
  seller?: string
  supplierCode?: string
  supplierName?: string
  unitPrice?: number
  currentFinancialCost?: number
  needsRetyping?: boolean
  sources: string[]
}

export type MovementIndicators = { sales: number; toBill: number; returns: number; bonuses: number; cuts: number; pendingRetyping: number; receiptItems: number }
export type MovementMotorResult = { canonicalBase: CanonicalMovement[]; audit: AuditItem[]; indicators: MovementIndicators }
type Row = unknown[]
const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (value: unknown) => { const result = String(value ?? '').trim(); return result || undefined }
const code = (value: unknown) => { const result = String(value ?? '').replace(/\.0$/, '').replace(/\s/g, '').replace(/^0+(?=\d)/, ''); return result || undefined }
const number = (value: unknown) => { const raw = String(value ?? '').trim(); const normal = raw.includes(',') && raw.includes('.') ? (raw.lastIndexOf(',') < raw.lastIndexOf('.') ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.')) : raw.replace(',', '.'); const result = Number(normal); return Number.isFinite(result) ? result : undefined }
const date = (value: unknown) => { const raw = String(value ?? '').trim(); const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined }
const rowsFrom = async (file: File) => { const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); return book.SheetNames.map(name => XLSX.utils.sheet_to_json<Row>(book.Sheets[name], { header: 1, defval: '', raw: false })) }
const audit = (id: string, title: string, instruction: string, detail: string, level: AuditItem['level'] = 'ok'): AuditItem => ({ id, title, instruction, detail, level, area: 'movimentacoes' })

export async function processMovementMotor(files: File[]): Promise<MovementMotorResult> {
  const rows: Row[][] = []; for (const file of files) rows.push(...await rowsFrom(file))
  const audits: AuditItem[] = []; const movements: CanonicalMovement[] = []; const saleKeys = new Set<string>(); const cuts: CanonicalMovement[] = []
  let salesFound = 0, cutsFound = 0, entriesFound = 0
  for (const sheet of rows) {
    const salesHeader = sheet.find(row => norm(row[2]) === 'datamovimento' && norm(row[3]) === 'codcliente' && norm(row[24]) === 'codprodwinthor')
    if (salesHeader) {
      const index = (label: string) => salesHeader.findIndex(value => norm(value) === norm(label))
      const needed = ['DATA MOVIMENTO', 'COD. CLIENTE', 'CODPROD. WINTHOR', 'STATUS PEDIDO', 'TIPO VENDA']
      if (needed.some(label => index(label) < 0)) { audits.push(audit('move-sales-layout', 'O relatório de vendas mudou', 'Envie o relatório de vendas no formato habitual.', 'As colunas necessárias não foram encontradas nas posições esperadas. Nenhuma venda foi usada.', 'action')); continue }
      for (const row of sheet.slice(sheet.indexOf(salesHeader) + 1)) {
        const movementDate = date(row[index('DATA MOVIMENTO')]); const customerCode = code(row[index('COD. CLIENTE')]); const productCode = code(row[index('CODPROD. WINTHOR')])
        if (!movementDate || !customerCode || !productCode) continue
        const saleType = text(row[index('TIPO VENDA')])?.toUpperCase(); const orderStatus = text(row[index('STATUS PEDIDO')])?.toUpperCase()
        const movementType: MovementType = saleType === 'DEVOLUCAO' ? 'devolucao' : saleType === 'BONIFICACAO' ? 'bonificacao' : orderStatus === 'A FATURAR' ? 'a_faturar' : 'venda_faturada'
        const orderId = code(row[index('NUMERO PED. WINTHOR')]); const key = `${customerCode}|${productCode}`; saleKeys.add(key)
        movements.push({ id: `ATUAL:VENDA:${movementDate}:${orderId ?? ''}:${customerCode}:${productCode}:${movements.length}`, movementDate, movementType, orderId, invoiceNumber: code(row[index('NUMERO NOTA FISCAL')]), customerCode, customerDocument: code(row[index('CNPJ/CPF CLIENTE')]), customerName: text(row[index('NOME CLIENTE')]), productCode, manufacturerCode: code(row[index('CODIGO FABRICANTE')]), description: text(row[index('DESCRICAO PRODUTO')]), quantity: number(row[index('UNIDADES VENDIDAS')]), value: number(row[index('VALOR NOTA R$')]), orderStatus, saleType, seller: text(row[index('VENDEDOR')]), sources: ['Vendas atuais'] }); salesFound++
      }
      continue
    }
    if (sheet.some(row => norm(row[0]).includes('consultarcortedemercadorias'))) {
      let customerCode: string | undefined; let customerName: string | undefined
      for (const row of sheet) {
        if (norm(row[1]) === 'cliente') { customerCode = code(row[2]); customerName = text(row[4]); continue }
        const movementDate = date(row[0]); const orderId = code(row[1]); const productCode = code(row[2]); if (!movementDate || !orderId || !productCode || !customerCode) continue
        const record: CanonicalMovement = { id: `ATUAL:CORTE:${movementDate}:${orderId}:${customerCode}:${productCode}`, movementDate, movementType: 'corte', orderId, customerCode, customerName, productCode, description: text(row[3]), quantity: number(row[10]), value: number(row[12]), unitPrice: number(row[11]), needsRetyping: !saleKeys.has(`${customerCode}|${productCode}`), sources: ['Cortes por cliente'] }
        cuts.push(record); movements.push(record); cutsFound++
      }
      continue
    }
    if (sheet.some(row => norm(row[0]).includes('relentradademercadoria'))) {
      let receipt: Partial<CanonicalMovement> = {}
      for (let position = 0; position < sheet.length; position++) {
        const row = sheet[position]
        if (norm(row[0]) === 'dtentrada' && norm(row[4]) === 'notafiscal') { const head = sheet[position + 1] ?? []; receipt = { movementDate: date(head[0]), invoiceNumber: code(head[4]), supplierCode: code(head[11]), supplierName: text(head[12]), value: number(head[21]), sources: ['Entradas atuais'] }; continue }
        if (norm(row[4]) !== 'codigo' || norm(row[5]) !== 'produto') continue
        for (position++; position < sheet.length; position++) {
          const item = sheet[position]; if (norm(item[0]) === 'dtentrada' || norm(item[4]) === 'cpagar') { position--; break }
          const productCode = code(item[4]); if (!productCode || !receipt.movementDate) continue
          movements.push({ id: `ATUAL:ENTRADA:${receipt.invoiceNumber ?? ''}:${productCode}:${movements.length}`, movementDate: receipt.movementDate, movementType: 'entrada', invoiceNumber: receipt.invoiceNumber, productCode, description: text(item[5]), quantity: number(item[15]), unitPrice: number(item[17]), currentFinancialCost: number(item[20]), supplierCode: receipt.supplierCode, supplierName: receipt.supplierName, value: receipt.value, sources: ['Entradas atuais'] }); entriesFound++
        }
      }
      continue
    }
    if (sheet.length) audits.push(audit(`move-layout-${crypto.randomUUID()}`, 'Um arquivo não foi reconhecido', 'Confira o relatório e envie novamente.', 'O conteúdo não corresponde a vendas, cortes ou entradas no formato esperado. Nenhum dado foi usado.', 'action'))
  }
  const pendingRetyping = cuts.filter(cut => cut.needsRetyping).length
  if (salesFound) audits.push(audit('move-sales-ready', 'Vendas atuais organizadas', `${salesFound.toLocaleString('pt-BR')} movimentações foram lidas.`, 'Vendas faturadas, a faturar, devoluções e bonificações foram mantidas separadamente.'))
  if (cutsFound) audits.push(audit('move-cuts-ready', 'Cortes por cliente organizados', `${pendingRetyping.toLocaleString('pt-BR')} item(ns) precisam de confirmação para redigitação.`, 'O sistema comparou cliente e produto dos cortes com as vendas atuais. Itens sem correspondência ficaram destacados para revisão.', pendingRetyping ? 'attention' : 'ok'))
  if (entriesFound) audits.push(audit('move-entries-ready', 'Entradas por nota organizadas', `${entriesFound.toLocaleString('pt-BR')} item(ns) de nota foram lidos.`, 'Cada item mantém a nota, fornecedor, data de entrada e custo financeiro atual.'))
  if (!movements.length) audits.push(audit('move-none', 'Nenhuma movimentação foi encontrada', 'Envie os relatórios de vendas, cortes ou entradas atuais.', 'Nenhum dado foi usado para criar a base de movimentações.', 'action'))
  const indicators = { sales: movements.filter(m => m.movementType === 'venda_faturada').length, toBill: movements.filter(m => m.movementType === 'a_faturar').length, returns: movements.filter(m => m.movementType === 'devolucao').length, bonuses: movements.filter(m => m.movementType === 'bonificacao').length, cuts: cutsFound, pendingRetyping, receiptItems: entriesFound }
  return { canonicalBase: movements.sort((a, b) => (a.movementDate ?? '').localeCompare(b.movementDate ?? '')), audit: audits, indicators }
}
