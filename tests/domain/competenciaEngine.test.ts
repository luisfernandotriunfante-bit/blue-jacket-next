import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs, uninstallBrowserStubs } from './helpers/browserStubs'
import {
  saveCompetenciaSnap,
  loadCompetenciaSnap,
  listClosedCompetencias,
  deleteCompetenciaSnap,
  fmtCompetencia,
  getActiveComp,
  setActiveComp,
  type CompetenciaSnapshot,
} from '../../src/domain/competenciaEngine'

beforeEach(() => installBrowserStubs())
afterEach(() => uninstallBrowserStubs())

function snapshot(competencia: string): CompetenciaSnapshot {
  return {
    competencia,
    closedAt: '2026-01-31T00:00:00.000Z',
    movements: [],
    products: [],
    clients: [],
    history: [],
    receipts: [],
    rcas: [],
    markupPct: '30',
    covDays: '45',
    selloutMeta: '0',
    positivMeta: '0',
  }
}

test('saveCompetenciaSnap + loadCompetenciaSnap: grava e recupera o mesmo fechamento', () => {
  assert.equal(saveCompetenciaSnap(snapshot('2026-01')), true)
  const loaded = loadCompetenciaSnap('2026-01')
  assert.equal(loaded?.competencia, '2026-01')
})

test('listClosedCompetencias: lista as competencias fechadas em ordem decrescente', () => {
  saveCompetenciaSnap(snapshot('2026-01'))
  saveCompetenciaSnap(snapshot('2026-03'))
  saveCompetenciaSnap(snapshot('2026-02'))
  assert.deepEqual(listClosedCompetencias(), ['2026-03', '2026-02', '2026-01'])
})

test('deleteCompetenciaSnap: remove o fechamento salvo', () => {
  saveCompetenciaSnap(snapshot('2026-01'))
  deleteCompetenciaSnap('2026-01')
  assert.equal(loadCompetenciaSnap('2026-01'), null)
})

test('fmtCompetencia: formata AAAA-MM como mes abreviado em portugues', () => {
  assert.equal(fmtCompetencia('2026-01'), 'Jan/2026')
})

test('getActiveComp/setActiveComp: guarda a competencia ativa escolhida', () => {
  setActiveComp('2026-02')
  assert.equal(getActiveComp(), '2026-02')
})
