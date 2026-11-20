import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage'
import { getStorageInstance } from '../firebaseConfig'

export type StorageMotor = 'produtos' | 'clientes' | 'historico' | 'movimentacoes' | 'recebimentos'

export type RestoredSlotFile = { name: string; file: File }

// Abstração mínima sobre o SDK do Storage: permite trocar por um cliente
// falso nos testes (sem rede) e mantém a lógica de caminho/degradação igual
// nos dois casos.
export interface StorageClient {
  upload(path: string, file: File): Promise<void>
  download(path: string): Promise<{ bytes: ArrayBuffer; name: string } | null>
  remove(path: string): Promise<void>
  list(prefix: string): Promise<string[]>
}

export function sanitizeStorageName(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const safe = withoutAccents.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'arquivo'
}

export function storagePathFor(motor: StorageMotor, slot: string, fileName: string): string {
  return `${motor}/${slot}/${sanitizeStorageName(fileName)}`
}

function firebaseStorageClient(): StorageClient | null {
  const storage = getStorageInstance()
  if (!storage) return null
  return {
    async upload(path, file) {
      await uploadBytes(ref(storage, path), file)
    },
    async download(path) {
      try {
        const bytes = await getBytes(ref(storage, path))
        return { bytes, name: path.split('/').pop() ?? path }
      } catch {
        return null
      }
    },
    async remove(path) {
      try { await deleteObject(ref(storage, path)) } catch { /* pode já não existir */ }
    },
    async list(prefix) {
      try {
        const result = await listAll(ref(storage, prefix))
        return result.items.map(item => item.fullPath)
      } catch {
        return []
      }
    },
  }
}

// Sem Firebase/Storage configurado (ou sem permissão), as funções abaixo
// degradam para no-op: não quebram a tela e não apagam nada local.
export async function saveSlotFile(motor: StorageMotor, slot: string, file: File, client: StorageClient | null = firebaseStorageClient()): Promise<void> {
  if (!client) return
  const path = storagePathFor(motor, slot, file.name)
  try { await client.upload(path, file) } catch { /* degrada sem quebrar a tela */ }
}

export async function removeSlotFile(motor: StorageMotor, slot: string, fileName: string, client: StorageClient | null = firebaseStorageClient()): Promise<void> {
  if (!client) return
  const path = storagePathFor(motor, slot, fileName)
  try { await client.remove(path) } catch { /* degrada sem quebrar a tela */ }
}

// Devolve os arquivos guardados de um motor, agrupados por slot (a chave é o
// segundo segmento do caminho: <motor>/<slot>/<nome>). Quem chama (App.tsx)
// casa cada RestoredSlotFile pelo nome/tamanho com o metadado já restaurado
// do slot, para saber a qual UploadedFile.id ele pertence.
export async function restoreMotorFiles(motor: StorageMotor, client: StorageClient | null = firebaseStorageClient()): Promise<Record<string, RestoredSlotFile[]>> {
  if (!client) return {}
  const result: Record<string, RestoredSlotFile[]> = {}
  try {
    const paths = await client.list(`${motor}/`)
    for (const path of paths) {
      const slot = path.split('/')[1]
      if (!slot) continue
      const downloaded = await client.download(path)
      if (!downloaded) continue
      const file = new File([downloaded.bytes], downloaded.name)
      if (!result[slot]) result[slot] = []
      result[slot].push({ name: downloaded.name, file })
    }
  } catch { /* degrada sem quebrar a tela */ }
  return result
}
