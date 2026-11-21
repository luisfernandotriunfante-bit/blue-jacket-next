import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStorageName, sanitizeDatabaseKey, databasePathFor, saveSlotFile, removeSlotFile, restoreMotorFiles, encodeFileRecord, decodeFileRecord, writeFileRecord, readFileRecord, removeFileRecord, MAX_PART_BYTES, MAX_TOTAL_FILE_BYTES } from '../../src/domain/fileStorage'
import type { RawDbClient } from '../../src/domain/fileStorage'
import { textFile } from './helpers/files'
import { createFakeStorageClient } from './helpers/fakeStorageClient'
import { sampleCadastroContent, sampleCadastroContentV2, sampleCarteiraContent, sampleComplexFileName, sampleSortimentoContent } from '../../fixtures/domain/storageFiles'

test('sanitizeStorageName: remove acentos, espacos e caracteres invalidos de caminho', () => {
  const result = sanitizeStorageName('Relação Carteira clientes (1).xlsx')
  assert.match(result, /^[a-zA-Z0-9._-]+$/)
  assert.match(result, /Relacao/)
  assert.match(result, /\.xlsx$/)
})

test('sanitizeStorageName: nome vazio ou só com caracteres invalidos vira um nome padrao', () => {
  assert.equal(sanitizeStorageName('***'), 'arquivo')
})

test('sanitizeDatabaseKey: alem do que sanitizeStorageName ja faz, tira o ponto (proibido em chave do Realtime Database)', () => {
  assert.equal(sanitizeDatabaseKey('Carteira Clientes.xlsx'), 'Carteira-Clientes-xlsx')
  assert.doesNotMatch(sanitizeDatabaseKey('Relação (1).xlsx'), /[.$#[\]/]/)
})

test('databasePathFor: monta o caminho blue-jacket/arquivos/<motor>/<slot>/<nome-sem-ponto>', () => {
  assert.equal(databasePathFor('clientes', 'portfolio', 'Carteira Clientes.xlsx'), 'blue-jacket/arquivos/clientes/portfolio/Carteira-Clientes-xlsx')
})

test('saveSlotFile + restoreMotorFiles: round-trip para clientes com SDK falso (sem rede)', async () => {
  const client = createFakeStorageClient()
  const file = textFile('cadastro-clientes.csv', sampleCadastroContent)
  await saveSlotFile('clientes', 'internal', file, client)
  const restored = await restoreMotorFiles('clientes', client)
  assert.equal(restored.internal?.length, 1)
  assert.equal(restored.internal?.[0].name, 'cadastro-clientes.csv')
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContent)
})

test('saveSlotFile + restoreMotorFiles: round-trip para produtos com SDK falso (sem rede)', async () => {
  const client = createFakeStorageClient()
  const file = textFile('cadastro-produtos.csv', sampleCadastroContent)
  await saveSlotFile('produtos', 'internal', file, client)
  const restored = await restoreMotorFiles('produtos', client)
  assert.equal(restored.internal?.length, 1)
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContent)
})

test('saveSlotFile: reenviar o mesmo slot substitui o conteudo anterior', async () => {
  const client = createFakeStorageClient()
  const first = textFile('cadastro-clientes.csv', sampleCadastroContent)
  const second = textFile('cadastro-clientes.csv', sampleCadastroContentV2)
  await saveSlotFile('clientes', 'internal', first, client)
  await saveSlotFile('clientes', 'internal', second, client)
  assert.equal(client.store.size, 1, 'deve ocupar só um caminho, nao acumular versoes')
  const restored = await restoreMotorFiles('clientes', client)
  const content = await restored.internal![0].file.text()
  assert.equal(content, sampleCadastroContentV2)
})

test('removeSlotFile: remove o arquivo guardado daquele slot', async () => {
  const client = createFakeStorageClient()
  const file = textFile('carteira.csv', sampleCarteiraContent)
  await saveSlotFile('clientes', 'portfolio', file, client)
  await removeSlotFile('clientes', 'portfolio', 'carteira.csv', client)
  const restored = await restoreMotorFiles('clientes', client)
  assert.equal(restored.portfolio, undefined)
})

test('restoreMotorFiles: slots de lista guardam varios arquivos distintos', async () => {
  const client = createFakeStorageClient()
  await saveSlotFile('movimentacoes', 'sales', textFile('vendas-01.csv', 'a'), client)
  await saveSlotFile('movimentacoes', 'sales', textFile('vendas-02.csv', 'b'), client)
  const restored = await restoreMotorFiles('movimentacoes', client)
  assert.equal(restored.sales?.length, 2)
})

test('degradacao sem Firebase configurado: nada quebra e nada e apagado', async () => {
  const file = textFile('qualquer.csv', 'x')
  const saveResult = await saveSlotFile('clientes', 'internal', file)
  assert.equal(saveResult.ok, true)
  await assert.doesNotReject(removeSlotFile('clientes', 'internal', 'qualquer.csv'))
  const restored = await restoreMotorFiles('clientes')
  assert.deepEqual(restored, {})
})

test('saveSlotFile + restoreMotorFiles: nome com espaco, parenteses, acento e apostrofo volta igual ao original', async () => {
  const client = createFakeStorageClient()
  const file = textFile(sampleComplexFileName, sampleSortimentoContent)
  await saveSlotFile('produtos', 'sortiment', file, client)
  const restored = await restoreMotorFiles('produtos', client)
  assert.equal(restored.sortiment?.length, 1)
  assert.equal(restored.sortiment?.[0].name, sampleComplexFileName)
  const content = await restored.sortiment![0].file.text()
  assert.equal(content, sampleSortimentoContent)
})

test('decodeFileRecord: com name guardado, devolve o nome original (nao o do caminho)', () => {
  const content = btoa('conteudo')
  const result = decodeFileRecord('blue-jacket/arquivos/produtos/sortiment/Sortimento-Q4-26', { name: sampleComplexFileName, size: 8, content })
  assert.equal(result.name, sampleComplexFileName)
})

test('decodeFileRecord: registro antigo sem name cai para o nome do caminho, sem quebrar', () => {
  const content = btoa('conteudo')
  const result = decodeFileRecord('blue-jacket/arquivos/produtos/sortiment/Sortimento-Q4-26', { size: 8, content })
  assert.equal(result.name, 'Sortimento-Q4-26')
})

test('decodeFileRecord: registro antigo com content string (sem particao) continua restaurando', () => {
  const original = new Uint8Array([10, 20, 30, 40, 250])
  const content = btoa(String.fromCharCode(...original))
  const result = decodeFileRecord('blue-jacket/arquivos/produtos/internal/antigo-csv', { name: 'antigo.csv', size: original.length, content })
  assert.deepEqual([...new Uint8Array(result.bytes)], [...original])
})

test('encodeFileRecord + decodeFileRecord: arquivo maior que uma parte e quebrado e volta identico', () => {
  const size = MAX_PART_BYTES * 2 + 1024 * 1024 // um pouco mais de 2 partes
  const original = new Uint8Array(size)
  for (let i = 0; i < size; i++) original[i] = i % 256
  const record = encodeFileRecord('planilha-grande.xlsx', size, original.buffer)
  assert.equal(record.parts, 3)
  assert.equal(typeof record.content, 'object')
  const restored = decodeFileRecord('blue-jacket/arquivos/produtos/internal/planilha-grande-xlsx', record)
  assert.equal(restored.bytes.byteLength, size)
  assert.deepEqual([...new Uint8Array(restored.bytes)], [...original])
})

test('encodeFileRecord: arquivo de ate uma parte mantem o formato simples (content como string)', () => {
  const original = new Uint8Array([1, 2, 3])
  const record = encodeFileRecord('pequeno.csv', 3, original.buffer)
  assert.equal(typeof record.content, 'string')
  assert.equal(record.parts, undefined)
})

// Cliente "cru" falso: uma escrita/leitura/remocao por vez, sem rede, para
// testar a orquestracao de partes (writeFileRecord/readFileRecord/removeFileRecord)
// diretamente, inclusive o desfazimento quando uma escrita falha no meio.
function createFakeRawClient(options?: { failAfterWrites?: number }): RawDbClient & { store: Map<string, unknown>; writeSizes: number[] } {
  const store = new Map<string, unknown>()
  const writeSizes: number[] = []
  let writeCount = 0
  return {
    store,
    writeSizes,
    async write(path, value) {
      writeCount++
      if (options?.failAfterWrites && writeCount === options.failAfterWrites) throw new Error('falha simulada de escrita')
      writeSizes.push(typeof value === 'string' ? value.length : JSON.stringify(value).length)
      store.set(path, value)
    },
    async read(path) {
      return store.has(path) ? store.get(path) : null
    },
    async remove(path) {
      store.delete(path)
      for (const key of [...store.keys()]) if (key.startsWith(`${path}/`)) store.delete(key)
    },
  }
}

test('writeFileRecord + readFileRecord: arquivo grande e gravado em varias escritas, nenhuma acima do limite do SDK, e volta identico', async () => {
  const raw = createFakeRawClient()
  const path = 'blue-jacket/arquivos/historico/sales/arquivo-grande-txt'
  const size = MAX_PART_BYTES * 2 + 2 * 1024 * 1024 // ~12 MiB, 3 partes
  const original = new Uint8Array(size)
  for (let i = 0; i < size; i++) original[i] = i % 256
  await writeFileRecord(raw, path, 'arquivo-grande.txt', size, original.buffer)

  const SDK_WRITE_LIMIT_BYTES = 16 * 1024 * 1024
  assert.ok(raw.writeSizes.length >= 3, 'deve ter mais de uma escrita (uma por parte, mais o registro)')
  for (const writeSize of raw.writeSizes) assert.ok(writeSize < SDK_WRITE_LIMIT_BYTES, `uma escrita de ${writeSize} bytes passou do limite de 16 MB do SDK`)

  const restored = await readFileRecord(raw, path)
  assert.ok(restored)
  assert.equal(restored!.name, 'arquivo-grande.txt')
  assert.equal(restored!.bytes.byteLength, size)
  assert.deepEqual([...new Uint8Array(restored!.bytes)], [...original])
})

test('writeFileRecord: falha no meio das partes apaga o que ja foi gravado e nao deixa registro parcial', async () => {
  const path = 'blue-jacket/arquivos/historico/sales/arquivo-com-falha-txt'
  const raw = createFakeRawClient({ failAfterWrites: 2 }) // falha na 2a parte
  const size = MAX_PART_BYTES * 2 + 2 * 1024 * 1024
  const original = new Uint8Array(size)

  await assert.rejects(writeFileRecord(raw, path, 'arquivo-com-falha.txt', size, original.buffer))
  assert.equal(await raw.read(path), null, 'nao deve existir registro, nem parcial, apos a falha')
  const leftoverParts = [...raw.store.keys()].filter(key => key.includes('arquivos-partes'))
  assert.equal(leftoverParts.length, 0, 'nenhuma parte desta tentativa deve sobrar apos o desfazimento')
})

test('writeFileRecord: substituir um arquivo grande por um pequeno remove as partes antigas', async () => {
  const path = 'blue-jacket/arquivos/historico/sales/arquivo-grande-txt'
  const raw = createFakeRawClient()
  const bigSize = MAX_PART_BYTES * 2 + 1024
  await writeFileRecord(raw, path, 'grande.txt', bigSize, new Uint8Array(bigSize).buffer)
  const partsBefore = [...raw.store.keys()].filter(key => key.includes('arquivos-partes'))
  assert.ok(partsBefore.length >= 2, 'arquivo grande deve ter gravado mais de uma parte')

  await writeFileRecord(raw, path, 'pequeno.txt', 3, new Uint8Array([1, 2, 3]).buffer)
  const partsAfter = [...raw.store.keys()].filter(key => key.includes('arquivos-partes'))
  assert.equal(partsAfter.length, 0, 'partes antigas devem ser removidas ao substituir por um arquivo pequeno')
  const restored = await readFileRecord(raw, path)
  assert.deepEqual([...new Uint8Array(restored!.bytes)], [1, 2, 3])
})

test('removeFileRecord: remove o registro e as partes de um arquivo gravado em varias escritas', async () => {
  const path = 'blue-jacket/arquivos/historico/sales/arquivo-grande-txt'
  const raw = createFakeRawClient()
  const bigSize = MAX_PART_BYTES * 2 + 1024
  await writeFileRecord(raw, path, 'grande.txt', bigSize, new Uint8Array(bigSize).buffer)

  await removeFileRecord(raw, path)
  assert.equal(await raw.read(path), null)
  const leftoverParts = [...raw.store.keys()].filter(key => key.includes('arquivos-partes'))
  assert.equal(leftoverParts.length, 0, 'remover um arquivo grande deve remover as partes tambem')
})

test('saveSlotFile: arquivo acima do teto de seguranca nao e salvo e devolve erro claro, mesmo com cliente falso', async () => {
  const client = createFakeStorageClient()
  const bigFile = new File([new Uint8Array(MAX_TOTAL_FILE_BYTES + 1024)], 'planilha-enorme.xlsx')
  const result = await saveSlotFile('produtos', 'internal', bigFile, client)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.error, /acima do teto de segurança/)
    assert.match(result.error, /planilha-enorme\.xlsx/)
  }
  assert.equal(client.store.size, 0, 'nada deve ser salvo quando o arquivo passa do teto')
})
