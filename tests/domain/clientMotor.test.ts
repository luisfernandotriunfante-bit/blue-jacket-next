import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processClientMotor } from '../../src/domain/clientMotor'
import { xlsxFile } from './helpers/files'
import { internalRows, portfolioRows } from '../../fixtures/domain/clientRows'

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

test('processClientMotor: sem arquivos reconheciveis, nao inventa clientes', async () => {
  const file = xlsxFile('arquivo-vazio.xlsx', { Sheet1: [['nada', 'aqui']] })
  const result = await processClientMotor([file])
  assert.equal(result.canonicalBase.length, 0)
  assert.ok(result.audit.some(item => item.id === 'no-client-source'))
})
