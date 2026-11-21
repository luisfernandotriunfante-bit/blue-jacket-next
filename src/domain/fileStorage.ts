import { ref, set, get, remove as removeRef } from 'firebase/database'
import { getDb } from '../firebaseConfig'

export type StorageMotor = 'produtos' | 'clientes' | 'historico' | 'movimentacoes' | 'recebimentos'

export type RestoredSlotFile = { name: string; file: File }

export type SaveResult = { ok: true } | { ok: false; error: string }

// Mesmo banco e mesmo prefixo usados por cloudSync.ts (CLOUD_ROOT = 'blue-jacket'),
// numa sub-árvore própria para não colidir com o que cloudSync.ts já guarda ali.
const CLOUD_ROOT = 'blue-jacket'
const FILES_ROOT = `${CLOUD_ROOT}/arquivos`

// Limite documentado do Realtime Database para o valor de uma única string:
// 10 MB (https://firebase.google.com/docs/database/usage/limits, "Maximum
// size of a string"). O conteúdo é guardado em base64, que infla o tamanho
// em ~4/3. Uso 7 MiB de arquivo cru como limite: em base64 vira ~9,33 MiB,
// com folga de ~700 KB abaixo do limite de 10 MB antes de qualquer outro
// campo (name/size) do mesmo registro.
export const MAX_RAW_FILE_BYTES = 7 * 1024 * 1024

// Abstração mínima sobre o acesso ao banco: permite trocar por um cliente
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

// Chaves do Realtime Database não podem conter ".", "$", "#", "[", "]", "/"
// nem caracteres de controle (mesma documentação do limite de tamanho). O
// sanitizeStorageName já remove os outros símbolos; só falta tirar o ponto,
// que ele preserva de propósito (fica bom para nome de arquivo/caminho).
export function sanitizeDatabaseKey(name: string): string {
  return sanitizeStorageName(name).replace(/\./g, '-')
}

export function databasePathFor(motor: StorageMotor, slot: string, fileName: string): string {
  return `${FILES_ROOT}/${motor}/${slot}/${sanitizeDatabaseKey(fileName)}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

type StoredFileRecord = { name?: string; size: number; content: string }

function isStoredFileRecord(value: unknown): value is StoredFileRecord {
  return !!value && typeof value === 'object' && typeof (value as StoredFileRecord).content === 'string'
}

// Registros gravados antes do campo "name" existir não o têm: nesse caso (só
// nesse), cai para o nome derivado do caminho, como acontecia na versão
// anterior (Storage). Não apaga nem corrige o registro antigo, só evita
// devolver um nome vazio.
export function parseStoredRecord(path: string, record: StoredFileRecord): { bytes: ArrayBuffer; name: string } {
  const name = record.name || (path.split('/').pop() ?? path)
  return { bytes: base64ToArrayBuffer(record.content), name }
}

function realtimeDatabaseClient(): StorageClient | null {
  const db = getDb()
  if (!db) return null
  return {
    async upload(path, file) {
      const bytes = await file.arrayBuffer()
      const record: StoredFileRecord = { name: file.name, size: file.size, content: arrayBufferToBase64(bytes) }
      await set(ref(db, path), record)
    },
    async download(path) {
      try {
        const snapshot = await get(ref(db, path))
        if (!snapshot.exists()) return null
        return parseStoredRecord(path, snapshot.val() as StoredFileRecord)
      } catch {
        return null
      }
    },
    async remove(path) {
      try { await removeRef(ref(db, path)) } catch { /* pode já não existir */ }
    },
    async list(prefix) {
      try {
        const snapshot = await get(ref(db, prefix))
        if (!snapshot.exists()) return []
        const paths: string[] = []
        const walk = (value: unknown, path: string) => {
          if (isStoredFileRecord(value)) { paths.push(path); return }
          if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) walk(child, `${path}/${key}`)
          }
        }
        walk(snapshot.val(), prefix)
        return paths
      } catch {
        return []
      }
    },
  }
}

// Sem Realtime Database configurado (ou sem permissão), as funções abaixo
// degradam para no-op: não lançam exceção, não quebram a tela e não apagam
// nada local.
export async function saveSlotFile(motor: StorageMotor, slot: string, file: File, client: StorageClient | null = realtimeDatabaseClient()): Promise<SaveResult> {
  if (file.size > MAX_RAW_FILE_BYTES) {
    const limitMb = (MAX_RAW_FILE_BYTES / (1024 * 1024)).toFixed(0)
    const fileMb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, error: `O arquivo "${file.name}" tem ${fileMb} MB, acima do limite de ${limitMb} MB por arquivo guardado no Realtime Database. Ele não foi salvo; nada foi apagado.` }
  }
  if (!client) return { ok: true }
  const path = databasePathFor(motor, slot, file.name)
  try {
    await client.upload(path, file)
    return { ok: true }
  } catch {
    return { ok: false, error: `Não foi possível salvar "${file.name}" agora. Nada foi apagado; tente novamente.` }
  }
}

export async function removeSlotFile(motor: StorageMotor, slot: string, fileName: string, client: StorageClient | null = realtimeDatabaseClient()): Promise<void> {
  if (!client) return
  const path = databasePathFor(motor, slot, fileName)
  try { await client.remove(path) } catch { /* degrada sem quebrar a tela */ }
}

// Devolve os arquivos guardados de um motor, agrupados por slot. Quem chama
// (App.tsx) casa cada RestoredSlotFile pelo nome/tamanho com o metadado já
// restaurado do slot, para saber a qual UploadedFile.id ele pertence.
export async function restoreMotorFiles(motor: StorageMotor, client: StorageClient | null = realtimeDatabaseClient()): Promise<Record<string, RestoredSlotFile[]>> {
  if (!client) return {}
  const result: Record<string, RestoredSlotFile[]> = {}
  const motorRoot = `${FILES_ROOT}/${motor}`
  try {
    const paths = await client.list(motorRoot)
    for (const path of paths) {
      const rest = path.startsWith(`${motorRoot}/`) ? path.slice(motorRoot.length + 1) : path
      const slot = rest.split('/')[0]
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
