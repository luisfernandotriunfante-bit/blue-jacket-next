import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normNfKey, groupReceiptsByInvoice, computeDailyReceiptRate, computeTransitBalance, processReceiptMotor } from '../../src/domain/receiptMotor'
import type { CanonicalReceipt } from '../../src/domain/receiptMotor'
import { textFile, xlsxFile } from './helpers/files'
import { legacyReceiptContent } from '../../fixtures/domain/receiptText'
import { industryPortfolioRows, industryPortfolioRowsShifted, transitBalanceCarteiraRows, entradas218BlocosRows } from '../../fixtures/domain/receiptRows'

test('normNfKey: remove zeros a esquerda, asteriscos e sufixo apos o hifen', () => {
  assert.equal(normNfKey('*000123-A'), '123')
  assert.equal(normNfKey('000456'), '456')
})

function receipt(partial: Partial<CanonicalReceipt>): CanonicalReceipt {
  return { id: 'x', status: 'recebida', system: 'legado', sources: [], ...partial }
}

test('groupReceiptsByInvoice: nota ja recebida some do transito em aberto', () => {
  const base: CanonicalReceipt[] = [
    receipt({ invoice: '100', status: 'recebida', entryDate: '2026-01-05' }),
    receipt({ invoice: '100', status: 'em_transito', entryDate: '2026-01-01' }),
    receipt({ invoice: '200', status: 'em_transito', entryDate: '2026-01-02' }),
  ]
  const { receivedGroups, openTransitGroups } = groupReceiptsByInvoice(base)
  assert.equal(receivedGroups.length, 1)
  assert.equal(openTransitGroups.length, 1)
  assert.equal(openTransitGroups[0].invoice, '200')
})

test('computeDailyReceiptRate: divide a quantidade recebida nos ultimos 12 meses por 365', () => {
  const recent = new Date().toISOString().slice(0, 10)
  const base: CanonicalReceipt[] = [receipt({ productCode: 'P1', quantity: 365, entryDate: recent })]
  const rate = computeDailyReceiptRate(base)
  assert.equal(rate.get('P1'), 1)
})

test('processReceiptMotor: reconhece a relacao de notas do legado e preserva o CNPJ do fornecedor', async () => {
  const file = textFile('notas-legado-teste.txt', legacyReceiptContent)
  const result = await processReceiptMotor([file])
  assert.equal(result.indicators.legacyNotes, 2)
  const note = result.canonicalBase.find(r => r.invoice === '123')
  assert.equal(note?.supplierDocument, '00011122233344')
  assert.equal(note?.value, 1000)
})

test('processReceiptMotor: carteira da industria le data americana, nota fiscal e valor pelo rotulo (nao por deslocamento)', async () => {
  const file = xlsxFile('carteira-industria-teste.xlsx', { Data: industryPortfolioRows })
  const result = await processReceiptMotor([file])
  assert.equal(result.indicators.inTransit, 2)
  const semNota = result.canonicalBase.find(r => r.productCode === 'BR03494A')
  assert.equal(semNota?.entryDate, '2026-11-03')
  assert.equal(semNota?.invoice, undefined)
  assert.equal(semNota?.value, 19740.67)
  const comNota = result.canonicalBase.find(r => r.productCode === '61054413')
  assert.equal(comNota?.entryDate, '2026-10-06')
  assert.equal(comNota?.invoice, '2974638')
  assert.equal(comNota?.value, 146110.06)
})

test('processReceiptMotor: carteira da industria com colunas em posicoes diferentes produz os mesmos registros', async () => {
  const original = await processReceiptMotor([xlsxFile('carteira-industria-teste.xlsx', { Data: industryPortfolioRows })])
  const shifted = await processReceiptMotor([xlsxFile('carteira-industria-teste.xlsx', { Data: industryPortfolioRowsShifted })])
  assert.deepEqual(shifted.canonicalBase.map(r => ({ ...r, id: undefined })), original.canonicalBase.map(r => ({ ...r, id: undefined })))
})

test('processReceiptMotor: 218 le Nota Fiscal e Vl. Total pelo rotulo de cada bloco, mesmo em posicoes diferentes entre blocos', async () => {
  const file = xlsxFile('218-entrega-de-notas-teste.xls', { Dados: entradas218BlocosRows })
  const result = await processReceiptMotor([file])
  const bloco1 = result.canonicalBase.find(r => r.invoice === '2974638')
  const bloco2 = result.canonicalBase.find(r => r.invoice === '3000000')
  assert.ok(bloco1, 'bloco 1 (Nota Fiscal na coluna 2, Vl. Total na coluna 12) deve ser lido')
  assert.equal(bloco1?.value, 1200)
  assert.ok(bloco2, 'bloco 2 (Nota Fiscal na coluna 4, Vl. Total na coluna 21) deve ser lido')
  assert.equal(bloco2?.value, 300)
})

test('processReceiptMotor: carteira em transito abate as notas que casam com a 218; nota sem par gera aviso e nao abate', async () => {
  const carteira = xlsxFile('carteira-teste.xlsx', { Dados: transitBalanceCarteiraRows })
  const notas218 = xlsxFile('218-entrega-de-notas-teste.xls', { Dados: entradas218BlocosRows })
  const result = await processReceiptMotor([carteira, notas218])

  // Total M da carteira: 1.000,00 + 500,00 = 1.500,00.
  // Nota "2974638" casa com o bloco 1 da 218 (Vl. Total 1.200,00) e abate.
  // Nota "7777777" nao tem par na 218 e nao abate.
  // Esperado: 1.500,00 - 1.200,00 = 300,00.
  assert.equal(result.indicators.transitBalance, 300)

  const warning = result.audit.find(a => a.id === 'receipt-transit-unmatched-invoice')
  assert.ok(warning, 'deve avisar sobre a nota sem par na 218')
  assert.equal(warning!.level, 'attention')
  assert.match(warning!.detail, /7777777/)
  assert.doesNotMatch(warning!.detail, /2974638/)
})

test('computeTransitBalance: linha da carteira sem nota continua no total, sem abatimento e sem aviso', () => {
  const base: CanonicalReceipt[] = [
    { id: 'x1', status: 'em_transito', system: 'industria', value: 500, sources: [] }, // sem invoice
  ]
  const result = computeTransitBalance(base)
  assert.equal(result.total, 500)
  assert.deepEqual(result.unmatchedInvoices, [])
  assert.deepEqual(result.matchedInvoices, [])
})
