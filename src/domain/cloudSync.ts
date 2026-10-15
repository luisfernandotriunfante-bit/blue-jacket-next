import { ref, set, get, onValue, type Unsubscribe } from 'firebase/database'
import { getDb, isFirebaseConfigured } from '../firebaseConfig'
import { loadPersisted, savePersisted } from './persistence'

const LS_PREFIX = 'rj-'
const CLOUD_ROOT = 'blue-jacket'
const RELOAD_TS_KEY = 'rj-cloud-reload-ts'

const IDB_KEYS = [
  'products', 'clients', 'movements', 'history', 'receipts',
  'product-indicators', 'client-indicators', 'movement-indicators',
  'history-indicators', 'receipt-indicators',
  'product-slots', 'client-slots', 'movement-slots', 'history-slots', 'receipt-slots',
  'uploaded-files',
]

type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'
type StatusListener = (s: SyncStatus) => void

let currentStatus: SyncStatus = 'off'
const statusListeners = new Set<StatusListener>()
let lastPushAt = ''
let _pulling = false

function setStatus(s: SyncStatus) {
  currentStatus = s
  statusListeners.forEach(fn => fn(s))
}

export function onSyncStatus(fn: StatusListener): () => void {
  statusListeners.add(fn)
  fn(currentStatus)
  return () => statusListeners.delete(fn)
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
  if (!db) return

  setStatus('syncing')
  try {
    const lsData = collectLocalStorage()
    await set(ref(db, `${CLOUD_ROOT}/localStorage`), lsData)

    const idbData: Record<string, unknown> = {}
    for (const key of IDB_KEYS) {
      try {
        const val = await loadPersisted(key)
        if (val !== null) idbData[key] = val
      } catch { /* skip */ }
    }
    await set(ref(db, `${CLOUD_ROOT}/indexedDB`), idbData)

    const now = new Date().toISOString()
    lastPushAt = now
    await set(ref(db, `${CLOUD_ROOT}/meta`), {
      updatedAt: now,
      device: navigator.userAgent.slice(0, 80),
    })

    setStatus('synced')
  } catch {
    setStatus('error')
  }
}

export async function pullFromCloud(): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  setStatus('syncing')
  _pulling = true
  try {
    const snap = await get(ref(db, CLOUD_ROOT))
    if (!snap.exists()) { setStatus('synced'); return false }

    const data = snap.val() as {
      localStorage?: Record<string, string>
      indexedDB?: Record<string, unknown>
    }

    if (data.localStorage) {
      for (const [key, value] of Object.entries(data.localStorage)) {
        if (key.startsWith(LS_PREFIX)) localStorage.setItem(key, value)
      }
    }

    if (data.indexedDB) {
      for (const [key, value] of Object.entries(data.indexedDB)) {
        await savePersisted(key, value)
      }
    }

    setStatus('synced')
    return true
  } catch {
    setStatus('error')
    return false
  } finally {
    _pulling = false
  }
}

export function safeReload(): void {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_TS_KEY) ?? '0')
    if (Date.now() - last < 8000) return
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()))
  } catch { return }
  window.location.reload()
}

export function initialPullAndReload(): void {
  const db = getDb()
  if (!db) return

  void pullFromCloud().then(pulled => {
    if (!pulled) return
    safeReload()
  })
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
