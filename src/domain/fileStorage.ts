import { ref, set, get, remove as removeRef } from 'firebase/database'
import { getDb } from '../firebaseConfig'

export type StorageMotor = 'produtos' | 'clientes' | 'historico' | 'movimentacoes' | 'recebimentos'

export type RestoredSlotFile = { name: string; file: File }

export type SaveResult = { ok: true } | { ok: false; error: string }

// Mesmo banco e mesmo prefixo usados por cloudSync.ts (CLOUD_ROOT = 'blue-jacket'),
// numa sub-árvore própria para não colidir com o que cloudSync.ts já guarda ali.
const CLOUD_ROOT = 'blue-jacket'
const FILES_ROOT = `${CLOUD_ROOT}/arquivos`
// Partes ficam numa árvore IRMÃ da dos registros (não uma sub-árvore dela):
// um set() no caminho do registro substitui o nó inteiro, então se as partes
// fossem filhas do próprio caminho do registro, gravar o registro por último
// apagaria as partes que acabamos de escrever.
const PARTS_ROOT = `${CLOUD_ROOT}/arquivos-partes`

// Limites documentados do Realtime Database (https://firebase.google.com/docs/database/usage/limits):
// "Maximum size of a string" = 10 MB; "Maximum write request size" = 16 MB
// pelo SDK (256 MB só pela REST API). Um arquivo grande gravado como UM set()
// só, com todas as partes dentro do mesmo registro, vira uma única escrita
// que pode passar de 16 MB e ser recusada pelo banco — foi o que aconteceu
// com os arquivos de Histórico de 67,5 MB e 42,6 MB (base64 de ~90 MB e
// ~56,8 MB nessa única escrita). Por isso cada parte agora é um set()
// separado, nunca passando de MAX_PART_BYTES em base64.
// Em base64 (~4/3 do tamanho cru), 5 MiB crus viram ~6,67 MiB por escrita —
// bem abaixo tanto do limite de 10 MB por string quanto do de 16 MB por
// escrita do SDK.
export const MAX_PART_BYTES = 5 * 1024 * 1024

// Teto de segurança por arquivo (independente do limite por escrita: com
// partição, o arquivo pode crescer sem esbarrar nele). Ver o relato do PR
// para a conta de quanto cabe no 1 GB grátis do Realtime Database.
export const MAX_TOTAL_FILE_BYTES = 200 * 1024 * 1024

// Abstração mínima sobre o acesso ao banco: permite trocar por um cliente
// falso nos testes (sem rede) e mantém a lógica de caminho/degradação igual
// nos dois casos.
export interface StorageClient {
  upload(path: string, file: File): Promise<void>
  download(path: string): Promise<{ bytes: ArrayBuffer; name: string } | null>
  remove(path: string): Promise<void>
  list(prefix: string): Promise<string[]>
}

// Abstração de mais baixo nível, uma escrita/leitura/remoção por vez — é o
// que permite testar a orquestração de partes (uma escrita por parte, com
// desfazimento se alguma falhar) sem precisar de rede nem do SDK do Firebase.
export interface RawDbClient {
  write(path: string, value: unknown): Promise<void>
  read(path: string): Promise<unknown>
  remove(path: string): Promise<void>
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

function partsRootFor(path: string): string {
  return path.startsWith(`${FILES_ROOT}/`) ? `${PARTS_ROOT}/${path.slice(FILES_ROOT.length + 1)}` : `${PARTS_ROOT}/${path}`
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

// Pedaços de até MAX_PART_BYTES crus (~6,67 MiB em base64 cada), para que
// cada parte caiba com folga numa única escrita do Realtime Database.
export function encodeFileParts(bytes: ArrayBuffer): string[] {
  const view = new Uint8Array(bytes)
  const parts: string[] = []
  for (let offset = 0; offset < view.length; offset += MAX_PART_BYTES) {
    const chunk = view.slice(offset, offset + MAX_PART_BYTES)
    parts.push(arrayBufferToBase64(chunk.buffer))
  }
  return parts
}

// Junta os pedaços (já lidos, cada um uma string base64) na ordem em que
// foram gravados e devolve os bytes originais, byte a byte.
export function combineParts(parts: string[]): ArrayBuffer {
  const chunks = parts.map(part => new Uint8Array(base64ToArrayBuffer(part)))
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
  return combined.buffer
}

type StoredFileRecord = { name?: string; size: number; parts?: number; content?: string | Record<string, string> }

function isStoredFileRecord(value: unknown): value is StoredFileRecord {
  return !!value && typeof value === 'object' && typeof (value as StoredFileRecord).size === 'number'
}

// Mantido para compatibilidade com registros antigos gravados com todas as
// partes dentro do mesmo campo "content" (formato de uma única escrita, que
// é exatamente o que causava o bug de escrita acima de 16 MB) e com arquivos
// pequenos, que continuam nesse formato simples (uma string só).
export function encodeFileRecord(name: string, size: number, bytes: ArrayBuffer): StoredFileRecord {
  if (size <= MAX_PART_BYTES) {
    return { name, size, content: arrayBufferToBase64(bytes) }
  }
  const parts = encodeFileParts(bytes)
  const content: Record<string, string> = {}
  parts.forEach((part, i) => { content[String(i)] = part })
  return { name, size, parts: parts.length, content }
}

// Registros gravados antes do campo "name" existir não o têm: nesse caso (só
// nesse), cai para o nome derivado do caminho, como acontecia na versão
// anterior (Storage). Lida com os dois formatos de arquivo pequeno/antigo:
// content como string única, ou (mais antigo ainda) todas as partes dentro
// do mesmo registro.
export function decodeFileRecord(path: string, record: StoredFileRecord): { bytes: ArrayBuffer; name: string } {
  const name = record.name || (path.split('/').pop() ?? path)
  if (typeof record.content === 'string') return { bytes: base64ToArrayBuffer(record.content), name }
  const content = record.content ?? {}
  const parts = record.parts ?? Object.keys(content).length
  const ordered: string[] = []
  for (let i = 0; i < parts; i++) ordered.push(content[String(i)])
  return { bytes: combineParts(ordered), name }
}

// Orquestra a gravação em várias escritas pequenas (uma por parte, nunca
// acima de MAX_PART_BYTES em base64) e só grava o registro pequeno (sem o
// conteúdo) depois que todas as partes foram confirmadas. Se alguma parte
// falhar no meio, apaga as partes já gravadas desta tentativa e relança o
// erro — nunca deixa um registro apontando para partes faltando.
export async function writeFileRecord(client: RawDbClient, path: string, name: string, size: number, bytes: ArrayBuffer): Promise<void> {
  const oldRecord = await readRawRecord(client, path)
  if (oldRecord && typeof oldRecord.content !== 'string' && oldRecord.parts) {
    await client.remove(partsRootFor(path)).catch(() => {})
  }
  if (size <= MAX_PART_BYTES) {
    await client.write(path, { name, size, content: arrayBufferToBase64(bytes) })
    return
  }
  const parts = encodeFileParts(bytes)
  const written: number[] = []
  try {
    for (let i = 0; i < parts.length; i++) {
      await client.write(`${partsRootFor(path)}/${i}`, parts[i])
      written.push(i)
    }
    await client.write(path, { name, size, parts: parts.length })
  } catch (error) {
    for (const i of written) await client.remove(`${partsRootFor(path)}/${i}`).catch(() => {})
    throw error
  }
}

async function readRawRecord(client: RawDbClient, path: string): Promise<StoredFileRecord | null> {
  const value = await client.read(path)
  return isStoredFileRecord(value) ? value : null
}

// Lê o registro; se tiver "content" (arquivo pequeno ou registro antigo de
// uma escrita só), decodifica direto. Se tiver "parts" sem "content"
// (formato de várias escritas), lê cada parte separadamente e junta.
export async function readFileRecord(client: RawDbClient, path: string): Promise<{ bytes: ArrayBuffer; name: string } | null> {
  const record = await readRawRecord(client, path)
  if (!record) return null
  if (record.content !== undefined) return decodeFileRecord(path, record)
  const parts = record.parts ?? 0
  const ordered: string[] = []
  for (let i = 0; i < parts; i++) {
    const value = await client.read(`${partsRootFor(path)}/${i}`)
    if (typeof value !== 'string') return null
    ordered.push(value)
  }
  const name = record.name || (path.split('/').pop() ?? path)
  return { bytes: combineParts(ordered), name }
}

// Remove o registro e, se ele apontava para partes (gravação em várias
// escritas), remove as partes também — não deixa partes órfãs.
export async function removeFileRecord(client: RawDbClient, path: string): Promise<void> {
  const record = await readRawRecord(client, path)
  if (record && typeof record.content !== 'string' && record.parts) {
    await client.remove(partsRootFor(path)).catch(() => {})
  }
  await client.remove(path).catch(() => {})
}

function firebaseRawClient(): RawDbClient | null {
  const db = getDb()
  if (!db) return null
  return {
    async write(path, value) { await set(ref(db, path), value) },
    async read(path) {
      const snapshot = await get(ref(db, path))
      return snapshot.exists() ? snapshot.val() : null
    },
    async remove(path) { await removeRef(ref(db, path)) },
  }
}

function realtimeDatabaseClient(): StorageClient | null {
  const raw = firebaseRawClient()
  if (!raw) return null
  return {
    async upload(path, file) {
      const bytes = await file.arrayBuffer()
      await writeFileRecord(raw, path, file.name, file.size, bytes)
    },
    async download(path) {
      try { return await readFileRecord(raw, path) } catch { return null }
    },
    async remove(path) {
      try { await removeFileRecord(raw, path) } catch { /* degrada sem quebrar a tela */ }
    },
    async list(prefix) {
      try {
        const root = await raw.read(prefix)
        if (root === null) return []
        const paths: string[] = []
        const walk = (value: unknown, path: string) => {
          if (isStoredFileRecord(value)) { paths.push(path); return }
          if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) walk(child, `${path}/${key}`)
          }
        }
        walk(root, prefix)
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
  if (file.size > MAX_TOTAL_FILE_BYTES) {
    const limitMb = (MAX_TOTAL_FILE_BYTES / (1024 * 1024)).toFixed(0)
    const fileMb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, error: `O arquivo "${file.name}" tem ${fileMb} MB, acima do teto de segurança de ${limitMb} MB por arquivo guardado no Realtime Database. Ele não foi salvo; nada foi apagado.` }
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
