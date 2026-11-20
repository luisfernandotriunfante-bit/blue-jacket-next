import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normNfKey, groupReceiptsByInvoice, computeDailyReceiptRate, processReceiptMotor } from '../../src/domain/receiptMotor'
import type { CanonicalReceipt } from '../../src/domain/receiptMotor'
import { textFile, xlsxFile } from './helpers/files'
import { legacyReceiptContent } from '../../fixtures/domain/receiptText'
import { transitRowsValueFound, transitRowsNoValueColumn, transitRowsValueZeroed } from '../../fixtures/domain/receiptTransitRows'

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

test('processReceiptMotor: carteira com coluna de valor em outra posicao (cabecalho Valor) le o valor certo, sem aviso', async () => {
  const file = xlsxFile('carteira-teste.xlsx', { Carteira: transitRowsValueFound })
  const result = await processReceiptMotor([file])
  const item = result.canonicalBase.find(r => r.status === 'em_transito')
  assert.equal(item?.value, 250.5)
  assert.equal(item?.quantity, 5)
  assert.ok(!result.audit.some(a => a.id === 'receipt-transit-value-missing'))
})

test('processReceiptMotor: carteira sem coluna de valor gera aviso action, quantidade continua', async () => {
  const file = xlsxFile('carteira-teste.xlsx', { Carteira: transitRowsNoValueColumn })
  const result = await processReceiptMotor([file])
  const item = result.canonicalBase.find(r => r.status === 'em_transito')
  assert.equal(item?.quantity, 5)
  assert.equal(item?.value, 0)
  const warning = result.audit.find(a => a.id === 'receipt-transit-value-missing')
  assert.ok(warning, 'deve avisar que a coluna de valor nao foi encontrada')
  assert.equal(warning!.level, 'action')
  assert.match(warning!.detail, /carteira-teste\.xlsx/)
})

test('processReceiptMotor: carteira com valores zerados (coluna encontrada) gera o mesmo aviso', async () => {
  const file = xlsxFile('carteira-teste.xlsx', { Carteira: transitRowsValueZeroed })
  const result = await processReceiptMotor([file])
  const item = result.canonicalBase.find(r => r.status === 'em_transito')
  assert.equal(item?.quantity, 5)
  assert.equal(item?.value, 0)
  const warning = result.audit.find(a => a.id === 'receipt-transit-value-missing')
  assert.ok(warning, 'deve avisar mesmo com a coluna encontrada, pois os valores vieram zerados')
  assert.equal(warning!.level, 'action')
})
