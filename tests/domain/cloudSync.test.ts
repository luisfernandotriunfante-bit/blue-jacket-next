import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs, uninstallBrowserStubs } from './helpers/browserStubs'

// src/firebaseConfig.ts lê import.meta.env (recurso do Vite). O loader em
// helpers/tsExtensionLoader.mjs troca isso por globalThis.__TEST_IMPORT_META_ENV__
// só para este processo de teste. Por isso os imports de firebaseConfig/cloudSync
// são dinâmicos: precisam vir depois de definirmos essa global, nunca antes.
globalThis.__TEST_IMPORT_META_ENV__ = {}

test('isFirebaseConfigured: sem nenhuma variavel VITE_FB_*, retorna false', async () => {
  const { isFirebaseConfigured } = await import('../../src/firebaseConfig.ts')
  assert.equal(isFirebaseConfigured(), false)
})

test('getDb: sem configuracao, retorna null em vez de tentar conectar', async () => {
  const { getDb } = await import('../../src/firebaseConfig.ts')
  assert.equal(getDb(), null)
})

test('pushToCloud: sem configuracao, nao tenta rede e marca status de erro', async () => {
  installBrowserStubs()
  try {
    const { pushToCloud, getSyncDetail } = await import('../../src/domain/cloudSync.ts')
    await pushToCloud()
    assert.equal(getSyncDetail(), 'DB não inicializado')
  } finally {
    uninstallBrowserStubs()
  }
})

test('pullFromCloud: sem configuracao, retorna false sem tentar rede', async () => {
  installBrowserStubs()
  try {
    const { pullFromCloud, getSyncDetail } = await import('../../src/domain/cloudSync.ts')
    const result = await pullFromCloud()
    assert.equal(result, false)
    assert.equal(getSyncDetail(), 'DB não inicializado')
  } finally {
    uninstallBrowserStubs()
  }
})

test('onSyncStatus: chama o listener imediatamente com o status atual', async () => {
  const { onSyncStatus } = await import('../../src/domain/cloudSync.ts')
  const seen: string[] = []
  const unsubscribe = onSyncStatus(status => seen.push(status))
  assert.ok(seen.length >= 1)
  unsubscribe()
})
