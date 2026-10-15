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

  setStatus('syncing', 'Enviando configs…')
  try {
    const lsData = collectLocalStorage()
    const lsCount = Object.keys(lsData).length
    await set(ref(db, `${CLOUD_ROOT}/localStorage`), lsData)

    let idbCount = 0
    const sentKeys: string[] = []
    const skippedKeys: string[] = []
    const failedKeys: string[] = []
    for (const key of IDB_KEYS) {
      setStatus('syncing', `Enviando ${key}…`)
      try {
        const val = await loadPersisted(key)
        if (val === null) { skippedKeys.push(key); continue }
        const packed = JSON.stringify(val)
        await set(ref(db, `${CLOUD_ROOT}/indexedDB/${key}`), packed)
        idbCount++
        sentKeys.push(`${key}(${Math.round(packed.length / 1024)}kb)`)
      } catch (err) {
        failedKeys.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (idbCount === 0 && lsCount === 0) {
      setStatus('synced', 'Nenhum dado local para enviar')
      return
    }

    const now = new Date().toISOString()
    lastPushAt = now
    await set(ref(db, `${CLOUD_ROOT}/meta`), {
      updatedAt: now,
      device: navigator.userAgent.slice(0, 80),
    })

    let detail = `Enviado: ${lsCount} configs + ${idbCount} bases [${sentKeys.join(', ')}]`
    if (skippedKeys.length) detail += ` | Vazios: ${skippedKeys.join(',')}`
    if (failedKeys.length) detail += ` | Falhas: ${failedKeys.join('; ')}`
    setStatus('synced', detail)
  } catch (err) {
    setStatus('error', `Erro push: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function pullFromCloud(): Promise<boolean> {
  const db = getDb()
  if (!db) { setStatus('error', 'DB não inicializado'); return false }

  setStatus('syncing', 'Puxando configs…')
  _pulling = true
  try {
    const lsSnap = await get(ref(db, `${CLOUD_ROOT}/localStorage`))
    let lsCount = 0
    if (lsSnap.exists()) {
      const lsData = lsSnap.val() as Record<string, string>
      for (const [key, value] of Object.entries(lsData)) {
        if (key.startsWith(LS_PREFIX)) { localStorage.setItem(key, value); lsCount++ }
      }
    }

    let idbCount = 0
    const pulledKeys: string[] = []
    const emptyKeys: string[] = []
    const failedKeys: string[] = []
    for (const key of IDB_KEYS) {
      setStatus('syncing', `Puxando ${key}…`)
      try {
        const snap = await get(ref(db, `${CLOUD_ROOT}/indexedDB/${key}`))
        if (snap.exists()) {
          const raw = snap.val()
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          await savePersisted(key, parsed)
          idbCount++
          const size = typeof raw === 'string' ? Math.round(raw.length / 1024) : 0
          const baseLen = parsed?.base?.length ?? '?'
          pulledKeys.push(`${key}(${size}kb,${baseLen})`)
        } else {
          emptyKeys.push(key)
        }
      } catch (err) {
        failedKeys.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const metaSnap = await get(ref(db, `${CLOUD_ROOT}/meta`))
    const meta = metaSnap.exists() ? metaSnap.val() as { device?: string } : null
    const device = meta?.device?.slice(0, 30) ?? '?'
    let detail = `Recebido: ${lsCount} configs + ${idbCount} bases [${pulledKeys.join(',')}] de ${device}`
    if (emptyKeys.length) detail += ` | Vazios na nuvem: ${emptyKeys.join(',')}`
    if (failedKeys.length) detail += ` | Falhas: ${failedKeys.join('; ')}`
    setStatus('synced', detail)
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
  debounceTimer = setTimeout(() => {
    if (_pulling) return
    void pushToCloud()
  }, 2000)
}
