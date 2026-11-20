import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processProductMotor } from '../../src/domain/productMotor'
import { xlsxFile } from './helpers/files'
import { internalRows, stockRows } from '../../fixtures/domain/productRows'

test('processProductMotor: normaliza preco em formato brasileiro (virgula decimal)', async () => {
  const file = xlsxFile('cadastro-produtos-teste.xlsx', { Produtos: internalRows })
  const result = await processProductMotor([file])
  const product = result.canonicalBase.find(p => p.internalCode === '100')
  assert.ok(product)
  assert.equal(product?.realCost, 2.5)
  assert.equal(product?.financialCost, 3)
})

test('processProductMotor: estoque atual sobrescreve saldo do cadastro interno', async () => {
  const internal = xlsxFile('cadastro-produtos-teste.xlsx', { Produtos: internalRows })
  const stock = xlsxFile('estoque-atual-teste.xlsx', { Estoque: stockRows })
  const result = await processProductMotor([internal, stock])
  const product = result.canonicalBase.find(p => p.internalCode === '100')
  assert.equal(product?.availableStock, 8)
  assert.equal(product?.status, 'active')
})

test('processProductMotor: produtos sem regra de agrupamento aparecem listados na auditoria, sem texto generico', async () => {
  const file = xlsxFile('cadastro-produtos-teste.xlsx', { Produtos: internalRows })
  const result = await processProductMotor([file])
  const item = result.audit.find(a => a.id === 'prod-group-review')
  assert.ok(item, 'produtos de teste nao batem com nenhuma regra de agrupamento, entao devem gerar o item de revisao')
  assert.match(item!.aiDetail ?? '', /100/)
  assert.notEqual(item!.aiDetail, 'Não inventar dados. Solicitar o arquivo ou a regra manual correspondente e registrar a decisão na auditoria.')
})

test('processProductMotor: sem arquivos reconheciveis, base fica vazia e audita a pendencia', async () => {
  const file = xlsxFile('arquivo-vazio.xlsx', { Sheet1: [['nada', 'aqui']] })
  const result = await processProductMotor([file])
  assert.equal(result.canonicalBase.length, 0)
  assert.ok(result.audit.some(item => item.id === 'prod-none'))
})
