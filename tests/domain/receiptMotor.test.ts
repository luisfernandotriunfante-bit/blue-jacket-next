import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normNfKey, groupReceiptsByInvoice, computeDailyReceiptRate, processReceiptMotor } from '../../src/domain/receiptMotor'
import type { CanonicalReceipt } from '../../src/domain/receiptMotor'
import { textFile } from './helpers/files'
import { legacyReceiptContent } from '../../fixtures/domain/receiptText'

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
