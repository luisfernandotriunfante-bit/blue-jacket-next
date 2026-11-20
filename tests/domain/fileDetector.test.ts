import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectFile } from '../../src/domain/fileDetector'
import { textFile, xlsxFile } from './helpers/files'
import { historySalesHeader, legacyCatalogContent } from '../../fixtures/domain/historyText'
import { internalRows as clientInternalRows } from '../../fixtures/domain/clientRows'
import { internalRows as productInternalRows } from '../../fixtures/domain/productRows'

test('detectFile: identifica vendas detalhadas do legado pelo cabecalho do .txt', async () => {
  const file = textFile('vendas-teste.txt', `${historySalesHeader}\nresto do conteudo`)
  const result = await detectFile(file)
  assert.deepEqual(result, { motor: 'historico', slot: 'sales' })
})

test('detectFile: identifica catalogo milenio pelo conteudo, nao pelo nome do arquivo', async () => {
  const file = textFile('qualquer-nome.txt', legacyCatalogContent)
  const result = await detectFile(file)
  assert.deepEqual(result, { motor: 'historico', slot: 'catalog' })
})

test('detectFile: identifica cadastro interno de clientes por posicao de coluna no xlsx', async () => {
  const file = xlsxFile('arquivo-qualquer.xlsx', { Sheet1: clientInternalRows })
  const result = await detectFile(file)
  assert.deepEqual(result, { motor: 'clientes', slot: 'internal' })
})

test('detectFile: identifica cadastro interno de produtos por posicao de coluna no xlsx', async () => {
  const file = xlsxFile('arquivo-qualquer.xlsx', { Sheet1: productInternalRows })
  const result = await detectFile(file)
  assert.deepEqual(result, { motor: 'produtos', slot: 'internal' })
})

test('detectFile: extensao desconhecida nao e reconhecida', async () => {
  const file = textFile('imagem.png', 'binario-fake')
  const result = await detectFile(file)
  assert.equal(result, null)
})
