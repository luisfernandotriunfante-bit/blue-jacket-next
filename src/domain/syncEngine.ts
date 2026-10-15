import { loadPersisted, savePersisted } from './persistence'

export interface SyncBundle {
  version: 1
  createdAt: string
  device: string
  localStorage: Record<string, string>
  indexedDB: Record<string, unknown>
}

const LS_PREFIX = 'rj-'

const IDB_KEYS = [
  'produtos', 'clientes', 'historico', 'movimentacoes', 'recebimentos',
]

export async function exportBundle(): Promise<SyncBundle> {
  const lsData: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LS_PREFIX)) {
      lsData[key] = localStorage.getItem(key)!
    }
  }

  const idbData: Record<string, unknown> = {}
  for (const key of IDB_KEYS) {
    try {
      const val = await loadPersisted(key)
      if (val !== null) idbData[key] = val
    } catch { /* skip missing */ }
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    device: navigator.userAgent.slice(0, 80),
    localStorage: lsData,
    indexedDB: idbData,
  }
}

export async function importBundle(bundle: SyncBundle): Promise<{ lsKeys: number; idbKeys: number }> {
  let lsKeys = 0
  for (const [key, value] of Object.entries(bundle.localStorage)) {
    if (key.startsWith(LS_PREFIX)) {
      localStorage.setItem(key, value)
      lsKeys++
    }
  }

  let idbKeys = 0
  for (const [key, value] of Object.entries(bundle.indexedDB)) {
    await savePersisted(key, value)
    idbKeys++
  }

  window.dispatchEvent(new Event('rj-competencias-changed'))
  window.dispatchEvent(new Event('rj-active-comp-changed'))
  window.dispatchEvent(new Event('rj-markup-changed'))
  window.dispatchEvent(new Event('rj-covdays-changed'))
  window.dispatchEvent(new Event('rj-sellout-meta-changed'))
  window.dispatchEvent(new Event('rj-positiv-meta-changed'))

  return { lsKeys, idbKeys }
}

export function validateBundle(data: unknown): data is SyncBundle {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    obj.version === 1 &&
    typeof obj.createdAt === 'string' &&
    typeof obj.localStorage === 'object' &&
    obj.localStorage !== null &&
    typeof obj.indexedDB === 'object' &&
    obj.indexedDB !== null
  )
}

export function downloadBundle(bundle: SyncBundle): void {
  const json = JSON.stringify(bundle)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `blue-jacket-sync-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
