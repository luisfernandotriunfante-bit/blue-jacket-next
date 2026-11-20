import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processClientMotor } from '../../src/domain/clientMotor'
import { xlsxFile } from './helpers/files'
import {
  internalRows,
  portfolioRows,
  portfolioRowsCodeMoved,
  portfolioRowsNoCode,
} from '../../fixtures/domain/clientRows'

test('processClientMotor: reconhece cadastro interno e preserva zeros do CNPJ', async () => {
  const file = xlsxFile('cadastro-interno-teste.xlsx', { Clientes: internalRows })
  const result = await processClientMotor([file])
  assert.equal(result.indicators.totalClients, 2)
  const client = result.canonicalBase.find(c => c.document === '00011122233344')
  assert.ok(client, 'documento deve manter os 14 digitos, incluindo zeros a esquerda')
  assert.equal(client?.sources.includes('Cadastro interno'), true)
})

test('processClientMotor: junta carteira e cadastro interno pelo mesmo documento', async () => {
  const internal = xlsxFile('cadastro-interno-teste.xlsx', { Clientes: internalRows })
  const portfolio = xlsxFile('carteira-teste.xlsx', { Carteira: portfolioRows })
  const result = await processClientMotor([internal, portfolio])
  const client = result.canonicalBase.find(c => c.document === '00011122233344')
  assert.deepEqual(client?.sources.sort(), ['Cadastro interno', 'Carteira'].sort())
  assert.equal(client?.visitFrequency, 'Semanal')
})

test('processClientMotor carteira: codigocliente na coluna 1 (posicao original) e lido pelo cabecalho', async () => {
  const file = xlsxFile('carteira-teste.xlsx', { Carteira: portfolioRows })
  const result = await processClientMotor([file])
  const client = result.canonicalBase.find(c => c.document === '00011122233344')
  assert.equal(client?.winthorCode, '001')
})

test('processClientMotor carteira: codigocliente em outra coluna produz os mesmos registros', async () => {
  const original = await processClientMotor([xlsxFile('carteira-teste.xlsx', { Carteira: portfolioRows })])
  const moved = await processClientMotor([xlsxFile('carteira-teste.xlsx', { Carteira: portfolioRowsCodeMoved })])
  const originalClient = original.canonicalBase.find(c => c.document === '00011122233344')
  const movedClient = moved.canonicalBase.find(c => c.document === '00011122233344')
  assert.deepEqual(movedClient, originalClient)
})

test('processClientMotor carteira: sem a coluna codigocliente, erro claro e nenhuma base parcial', async () => {
  const file = xlsxFile('carteira-teste.xlsx', { Carteira: portfolioRowsNoCode })
  const result = await processClientMotor([file])
  assert.equal(result.canonicalBase.length, 0)
  const error = result.audit.find(item => item.id.startsWith('portfolio-missing-codigocliente'))
  assert.ok(error, 'deve haver um item de auditoria sobre a coluna ausente')
  assert.match(error!.title + error!.detail, /codigocliente/i)
})

test('processClientMotor: sem arquivos reconheciveis, nao inventa clientes', async () => {
  const file = xlsxFile('arquivo-vazio.xlsx', { Sheet1: [['nada', 'aqui']] })
  const result = await processClientMotor([file])
  assert.equal(result.canonicalBase.length, 0)
  assert.ok(result.audit.some(item => item.id === 'no-client-source'))
})
