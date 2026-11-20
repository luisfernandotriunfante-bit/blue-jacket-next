import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs, uninstallBrowserStubs, installFakeIndexedDb, uninstallFakeIndexedDb } from './helpers/browserStubs'
import { exportBundle, importBundle, validateBundle } from '../../src/domain/syncEngine'
import { savePersisted } from '../../src/domain/persistence'

beforeEach(() => { installBrowserStubs(); installFakeIndexedDb() })
afterEach(() => { uninstallBrowserStubs(); uninstallFakeIndexedDb() })

test('validateBundle: aceita um pacote com o formato esperado', () => {
  const bundle = { version: 1, createdAt: '2026-01-01T00:00:00.000Z', device: 'teste', localStorage: {}, indexedDB: {} }
  assert.equal(validateBundle(bundle), true)
})

test('validateBundle: rejeita pacote sem indexedDB ou com versao diferente', () => {
  assert.equal(validateBundle({ version: 2, createdAt: 'x', localStorage: {}, indexedDB: {} }), false)
  assert.equal(validateBundle({ version: 1, createdAt: 'x', localStorage: {} }), false)
  assert.equal(validateBundle(null), false)
})

test('exportBundle + importBundle: exporta apenas chaves rj- e reimporta no destino', async () => {
  localStorage.setItem('rj-ativo', 'valor-teste')
  localStorage.setItem('outra-chave', 'nao-deve-ir')
  await savePersisted('produtos', { total: 3 })

  const bundle = await exportBundle()
  assert.deepEqual(Object.keys(bundle.localStorage), ['rj-ativo'])
  assert.ok('produtos' in bundle.indexedDB)

  localStorage.clear()
  const stats = await importBundle(bundle)
  assert.equal(stats.lsKeys, 1)
  assert.equal(localStorage.getItem('rj-ativo'), 'valor-teste')
})
