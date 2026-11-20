class MemoryStorage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  key(index: number) { return [...this.store.keys()][index] ?? null }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
}

class MemoryWindow extends EventTarget {}

export function installBrowserStubs() {
  const g = globalThis as Record<string, unknown>
  g.localStorage = new MemoryStorage()
  g.window = new MemoryWindow()
}

export function uninstallBrowserStubs() {
  const g = globalThis as Record<string, unknown>
  delete g.localStorage
  delete g.window
}

type StoreRecord = Map<string, unknown>

class FakeObjectStore {
  private data: StoreRecord
  constructor(data: StoreRecord) { this.data = data }
  get(key: string) {
    const request: any = {}
    queueMicrotask(() => { request.result = this.data.get(key); request.onsuccess?.() })
    return request
  }
  put(value: unknown, key: string) {
    const request: any = {}
    queueMicrotask(() => { this.data.set(key, value); request.onsuccess?.() })
    return request
  }
  delete(key: string) {
    const request: any = {}
    queueMicrotask(() => { this.data.delete(key); request.onsuccess?.() })
    return request
  }
}

class FakeDatabase {
  stores = new Map<string, StoreRecord>()
  createObjectStore(name: string) { this.stores.set(name, new Map()); return this.objectStore(name) }
  transaction(name: string, _mode?: string) { return { objectStore: () => this.objectStore(name) } }
  objectStore(name: string) { return new FakeObjectStore(this.stores.get(name) ?? (this.stores.set(name, new Map()), this.stores.get(name)!)) }
}

export function installFakeIndexedDb() {
  const databases = new Map<string, FakeDatabase>()
  const g = globalThis as Record<string, unknown>
  g.indexedDB = {
    open(name: string, _version?: number) {
      const request: any = {}
      queueMicrotask(() => {
        const isNew = !databases.has(name)
        const db = databases.get(name) ?? new FakeDatabase()
        databases.set(name, db)
        request.result = db
        if (isNew) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
}

export function uninstallFakeIndexedDb() {
  delete (globalThis as Record<string, unknown>).indexedDB
}
