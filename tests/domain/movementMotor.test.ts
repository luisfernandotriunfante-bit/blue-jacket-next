import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAbcMap, processMovementMotor } from '../../src/domain/movementMotor'
import type { CanonicalMovement } from '../../src/domain/movementMotor'
import { xlsxFile } from './helpers/files'
import { salesRows, cutsRows } from '../../fixtures/domain/movementRows'

function movement(partial: Partial<CanonicalMovement>): CanonicalMovement {
  return { id: 'x', movementType: 'venda_faturada', sources: [], ...partial }
}

test('computeAbcMap: concentra classe A nos produtos que somam 80% do volume', () => {
  const movements = [
    movement({ productCode: '1', quantity: 80 }),
    movement({ productCode: '2', quantity: 15 }),
    movement({ productCode: '3', quantity: 5 }),
  ]
  const abc = computeAbcMap(movements)
  assert.equal(abc.get('1'), 'A')
  assert.equal(abc.get('3'), 'C')
})

test('computeAbcMap: ignora devolucoes e movimentos sem quantidade', () => {
  const movements = [
    movement({ productCode: '1', quantity: 80 }),
    movement({ productCode: '3', quantity: 20 }),
    movement({ productCode: '2', quantity: 999, movementType: 'devolucao' }),
  ]
  const abc = computeAbcMap(movements)
  assert.equal(abc.has('2'), false)
  assert.equal(abc.get('1'), 'A')
})

test('processMovementMotor: separa vendas faturadas e a faturar pelo status', async () => {
  const file = xlsxFile('vendas-atuais-teste.xlsx', { Vendas: salesRows })
  const result = await processMovementMotor([file])
  assert.equal(result.indicators.sales, 2)
  assert.equal(result.indicators.toBill, 1)
})

test('processMovementMotor: corte sem venda correspondente lista cliente e produto na auditoria, sem texto generico', async () => {
  const file = xlsxFile('cortes-teste.xlsx', { Cortes: cutsRows })
  const result = await processMovementMotor([file])
  assert.equal(result.indicators.pendingRetyping, 1)
  const item = result.audit.find(a => a.id === 'move-cuts-ready')
  assert.ok(item)
  assert.match(item!.aiDetail ?? '', /cliente 1 \/ produto 100/)
  assert.notEqual(item!.aiDetail, 'Não inventar dados. Solicitar o arquivo ou a regra manual correspondente e registrar a decisão na auditoria.')
})
