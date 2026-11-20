import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStorageName, storagePathFor, saveSlotFile, removeSlotFile, restoreMotorFiles } from '../../src/domain/fileStorage'
import { textFile } from './helpers/files'
import { createFakeStorageClient } from './helpers/fakeStorageClient'
import { sampleCadastroContent, sampleCadastroContentV2, sampleCarteiraContent } from '../../fixtures/domain/storageFiles'

test('sanitizeStorageName: remove acentos, espacos e caracteres invalidos de caminho', () => {
  const result = sanitizeStorageName('Relação Carteira clientes (1).xlsx')
  assert.match(result, /^[a-zA-Z0-9._-]+$/)
  assert.match(result, /Relacao/)
  assert.match(result, /\.xlsx$/)
})

test('sanitizeStorageName: nome vazio ou só com caracteres invalidos vira um nome padrao', () => {
  assert.equal(sanitizeStorageName('***'), 'arquivo')
})

test('storagePathFor: monta o caminho motor/slot/nome-seguro', () => {
  assert.equal(storagePathFor('clientes', 'portfolio', 'Carteira Clientes.xlsx'), 'clientes/portfolio/Carteira-Clientes.xlsx')
})

test('saveSlotFile + restoreMotorFiles: round-trip para clientes com SDK falso (sem rede)', async () => {
  const client = createFakeStorageClient()
  const file = textFile('cadastro-clientes.csv', sampleCadastroContent)
  await saveSlotFile('clientes', 'internal', file, client)
  const restored = await restoreMotorFiles('clientes', client)
  assert.equal(restored.internal?.length, 1)
  assert.equal(restored.internal?.[0].name, 'cadastro-clientes.csv')
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContent)
})

test('saveSlotFile + restoreMotorFiles: round-trip para produtos com SDK falso (sem rede)', async () => {
  const client = createFakeStorageClient()
  const file = textFile('cadastro-produtos.csv', sampleCadastroContent)
  await saveSlotFile('produtos', 'internal', file, client)
  const restored = await restoreMotorFiles('produtos', client)
  assert.equal(restored.internal?.length, 1)
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContent)
})

test('saveSlotFile: reenviar o mesmo slot substitui o conteudo anterior', async () => {
  const client = createFakeStorageClient()
  const first = textFile('cadastro-clientes.csv', sampleCadastroContent)
  const second = textFile('cadastro-clientes.csv', sampleCadastroContentV2)
  await saveSlotFile('clientes', 'internal', first, client)
  await saveSlotFile('clientes', 'internal', second, client)
  assert.equal(client.store.size, 1, 'deve ocupar só um caminho no Storage, nao acumular versoes')
  const restored = await restoreMotorFiles('clientes', client)
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContentV2)
})

test('removeSlotFile: remove o arquivo guardado daquele slot', async () => {
  const client = createFakeStorageClient()
  const file = textFile('carteira.csv', sampleCarteiraContent)
  await saveSlotFile('clientes', 'portfolio', file, client)
  await removeSlotFile('clientes', 'portfolio', 'carteira.csv', client)
  const restored = await restoreMotorFiles('clientes', client)
  assert.equal(restored.portfolio, undefined)
})

test('restoreMotorFiles: slots de lista guardam varios arquivos distintos', async () => {
  const client = createFakeStorageClient()
  await saveSlotFile('movimentacoes', 'sales', textFile('vendas-01.csv', 'a'), client)
  await saveSlotFile('movimentacoes', 'sales', textFile('vendas-02.csv', 'b'), client)
  const restored = await restoreMotorFiles('movimentacoes', client)
  assert.equal(restored.sales?.length, 2)
})

test('degradacao sem Firebase configurado: nada quebra e nada e apagado', async () => {
  const file = textFile('qualquer.csv', 'x')
  await assert.doesNotReject(saveSlotFile('clientes', 'internal', file))
  await assert.doesNotReject(removeSlotFile('clientes', 'internal', 'qualquer.csv'))
  const restored = await restoreMotorFiles('clientes')
  assert.deepEqual(restored, {})
})
