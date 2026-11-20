import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processHistoryMotor } from '../../src/domain/historyMotor'
import { textFile } from './helpers/files'
import { historySalesContent, legacyCatalogContent } from '../../fixtures/domain/historyText'

test('processHistoryMotor: calcula valor liquido como venda menos desconto', async () => {
  const file = textFile('vendas-legado-teste.txt', historySalesContent)
  const result = await processHistoryMotor([file])
  assert.equal(result.canonicalBase.length, 2)
  const first = result.canonicalBase.find(r => r.productCode === '11100100')
  assert.equal(first?.salesValue, 9)
  assert.equal(first?.discount, 0)
  assert.equal(first?.netValue, 9)
})

test('processHistoryMotor: usa o catalogo milenio para achar o codigo winthor pelo EAN', async () => {
  const sales = textFile('vendas-legado-teste.txt', historySalesContent)
  const catalog = textFile('catalogo-milenio-teste.txt', legacyCatalogContent)
  const result = await processHistoryMotor([sales], { catalogFile: catalog })
  const first = result.canonicalBase.find(r => r.productCode === '11100100')
  assert.equal(first?.winthorCode, '100')
})

test('processHistoryMotor: arquivo sem o cabecalho esperado nao gera linhas e fica em auditoria', async () => {
  const file = textFile('arquivo-errado-teste.txt', 'conteudo qualquer sem o cabecalho de vendas')
  const result = await processHistoryMotor([file])
  assert.equal(result.canonicalBase.length, 0)
  assert.ok(result.audit.some(item => item.level === 'action'))
})
