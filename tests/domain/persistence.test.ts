import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeIndexedDb, uninstallFakeIndexedDb } from './helpers/browserStubs'
import { loadPersisted, savePersisted, saveChunked, loadChunked } from '../../src/domain/persistence'

beforeEach(() => installFakeIndexedDb())
afterEach(() => uninstallFakeIndexedDb())

test('savePersisted + loadPersisted: grava e recupera o mesmo valor pela chave', async () => {
  await savePersisted('produtos', { total: 2 })
  const loaded = await loadPersisted<{ total: number }>('produtos')
  assert.deepEqual(loaded, { total: 2 })
})

test('loadPersisted: chave inexistente retorna null, nunca inventa dado', async () => {
  const loaded = await loadPersisted('clientes')
  assert.equal(loaded, null)
})

test('saveChunked + loadChunked: reconstroi a lista original a partir dos pedacos', async () => {
  const items = Array.from({ length: 12001 }, (_, i) => ({ id: i }))
  await saveChunked('historico', items)
  const loaded = await loadChunked<{ id: number }>('historico')
  assert.equal(loaded?.length, items.length)
  assert.deepEqual(loaded?.[12000], { id: 12000 })
})
