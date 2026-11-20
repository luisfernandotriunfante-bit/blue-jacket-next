import type { StorageClient } from '../../../src/domain/fileStorage'

export type FakeStorageClient = StorageClient & {
  store: Map<string, { bytes: ArrayBuffer; name: string }>
}

export function createFakeStorageClient(): FakeStorageClient {
  const store = new Map<string, { bytes: ArrayBuffer; name: string }>()
  return {
    store,
    async upload(path, file) {
      const bytes = await file.arrayBuffer()
      store.set(path, { bytes, name: file.name })
    },
    async download(path) {
      const entry = store.get(path)
      return entry ? { ...entry } : null
    },
    async remove(path) {
      store.delete(path)
    },
    async list(prefix) {
      return [...store.keys()].filter(path => path.startsWith(prefix))
    },
  }
}
