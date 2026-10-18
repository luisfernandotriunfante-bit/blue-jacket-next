const databaseName = 'red-jacket'
const storeName = 'motor-state'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadPersisted<T>(key: string): Promise<T | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

let onSaveHook: (() => void) | null = null
export function setOnSaveHook(fn: (() => void) | null): void { onSaveHook = fn }

export async function savePersisted<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
    request.onsuccess = () => { resolve(); onSaveHook?.() }
    request.onerror = () => reject(request.error)
  })
}

const CHUNK_SIZE = 5000

export async function saveChunked<T>(key: string, arr: T[]): Promise<void> {
  const db = await openDatabase()
  const chunkCount = Math.max(1, Math.ceil(arr.length / CHUNK_SIZE))
  const putOne = (k: string, v: unknown) => new Promise<void>((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(v, k)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  const delOne = (k: string) => new Promise<void>((resolve) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(k)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
  await putOne(`${key}:manifest`, { chunks: chunkCount, total: arr.length })
  for (let i = 0; i < chunkCount; i++)
    await putOne(`${key}:chunk:${i}`, arr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
  for (let i = chunkCount; i < chunkCount + 100; i++) {
    const test = await new Promise<unknown>((resolve) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(`${key}:chunk:${i}`)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
    if (test === undefined) break
    await delOne(`${key}:chunk:${i}`)
  }
  onSaveHook?.()
}

export async function loadChunked<T>(key: string): Promise<T[] | null> {
  const db = await openDatabase()
  const manifest = await new Promise<{ chunks: number; total: number } | undefined>((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(`${key}:manifest`)
    req.onsuccess = () => resolve(req.result as { chunks: number; total: number } | undefined)
    req.onerror = () => reject(req.error)
  })
  if (!manifest) return null
  const result: T[] = []
  for (let i = 0; i < manifest.chunks; i++) {
    const chunk = await new Promise<T[]>((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(`${key}:chunk:${i}`)
      req.onsuccess = () => resolve((req.result as T[] | undefined) ?? [])
      req.onerror = () => reject(req.error)
    })
    result.push(...chunk)
  }
  return result
}
