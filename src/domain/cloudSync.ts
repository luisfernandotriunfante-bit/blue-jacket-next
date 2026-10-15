import { ref, set, get, onValue, type Unsubscribe } from 'firebase/database'
import { getDb, isFirebaseConfigured } from '../firebaseConfig'
import { loadPersisted, savePersisted } from './persistence'

const LS_PREFIX = 'rj-'
const CLOUD_ROOT = 'blue-jacket'

const IDB_KEYS = [
  'produtos', 'clientes', 'historico', 'movimentacoes', 'recebimentos',
]

type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'
type StatusListener = (s: SyncStatus) => void

let currentStatus: SyncStatus = 'off'
let currentDetail = ''
const statusListeners = new Set<StatusListener>()
let lastPushAt = ''
let _pulling = false

function setStatus(s: SyncStatus, detail?: string) {
  currentStatus = s
  if (detail !== undefined) currentDetail = detail
  statusListeners.forEach(fn => fn(s))
}

export function getSyncDetail(): string { return currentDetail }

export function onSyncStatus(fn: StatusListener): () => void {
  statusListeners.add(fn)
  fn(currentStatus)
  return () => statusListeners.delete(fn)
}

function cleanForFirebase(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj))
}

function collectLocalStorage(): Record<string, string> {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LS_PREFIX)) data[key] = localStorage.getItem(key)!
  }
  return data
}

export async function pushToCloud(): Promise<void> {
  const db = getDb()
  if (!db) { setStatus('error', 'DB não inicializado'); return }

  setStatus('syncing', 'Enviando…')
  try {
    const lsData = collectLocalStorage()
    const lsCount = Object.keys(lsData).length
    await set(ref(db, `${CLOUD_ROOT}/localStorage`), lsData)

    const idbData: Record<string, unknown> = {}
    for (const key of IDB_KEYS) {
      try {
        const val = await loadPersisted(key)
        if (val !== null) idbData[key] = cleanForFirebase(val)
      } catch { /* skip */ }
    }
    const idbCount = Object.keys(idbData).length
    await set(ref(db, `${CLOUD_ROOT}/indexedDB`), idbData)

    const now = new Date().toISOString()
    lastPushAt = now
    await set(ref(db, `${CLOUD_ROOT}/meta`), {
      updatedAt: now,
      device: navigator.userAgent.slice(0, 80),
    })

    setStatus('synced', `Enviado: ${lsCount} configs + ${idbCount} bases`)
  } catch (err) {
    setStatus('error', `Erro push: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function pullFromCloud(): Promise<boolean> {
  const db = getDb()
  if (!db) { setStatus('error', 'DB não inicializado'); return false }

  setStatus('syncing', 'Puxando da nuvem…')
  _pulling = true
  try {
    const snap = await get(ref(db, CLOUD_ROOT))
    if (!snap.exists()) { setStatus('synced', 'Nuvem vazia'); return false }

    const data = snap.val() as {
      localStorage?: Record<string, string>
      indexedDB?: Record<string, unknown>
      meta?: { updatedAt?: string; device?: string }
    }

    let lsCount = 0
    if (data.localStorage) {
      for (const [key, value] of Object.entries(data.localStorage)) {
        if (key.startsWith(LS_PREFIX)) { localStorage.setItem(key, value); lsCount++ }
      }
    }

    let idbCount = 0
    const idbKeys: string[] = []
    if (data.indexedDB) {
      for (const [key, value] of Object.entries(data.indexedDB)) {
        await savePersisted(key, value)
        idbCount++
        idbKeys.push(key)
      }
    }

    const device = data.meta?.device?.slice(0, 30) ?? '?'
    setStatus('synced', `Recebido: ${lsCount} configs + ${idbCount} bases [${idbKeys.join(',')}] de ${device}`)
    return lsCount > 0 || idbCount > 0
  } catch (err) {
    setStatus('error', `Erro pull: ${err instanceof Error ? err.message : String(err)}`)
    return false
  } finally {
    _pulling = false
  }
}

let unsubscribe: Unsubscribe | null = null

export function listenForChanges(onUpdate: () => void): () => void {
  const db = getDb()
  if (!db) return () => {}

  if (unsubscribe) unsubscribe()

  let firstCall = true
  unsubscribe = onValue(ref(db, `${CLOUD_ROOT}/meta`), async (_snap) => {
    if (firstCall) { firstCall = false; return }
    const meta = _snap.val() as { updatedAt?: string } | null
    if (meta?.updatedAt && meta.updatedAt === lastPushAt) return
    await pullFromCloud()
    onUpdate()
  })

  return () => { if (unsubscribe) { unsubscribe(); unsubscribe = null } }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function schedulePush(): void {
  if (!isFirebaseConfigured() || _pulling) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void pushToCloud(), 2000)
}
