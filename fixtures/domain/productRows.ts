import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 46

export const internalHeader = sparseRow({ 1: 'CODIGO', 2: 'DESCRICAO', 25: 'COD.BARRAS', 26: 'COD.FABRICANTE' }, WIDTH)
export const internalRows = [
  internalHeader,
  sparseRow({ 1: '0100', 2: 'Produto Teste A 90g', 4: '10', 9: '8', 15: '2,50', 16: '3,00', 24: 'CX', 25: '07891000000012', 26: 'FAB-A' }, WIDTH),
  sparseRow({ 1: '0200', 2: 'Produto Teste B 200ml', 4: '5', 9: '5', 15: '4,10', 16: '4,80', 24: 'CX', 25: '07891000000029', 26: 'FAB-B' }, WIDTH),
]

// Mesmo cadastro interno, com CODIGO/DESCRICAO/COD.BARRAS/COD.FABRICANTE
// em colunas bem diferentes das originais (1/2/25/26 -> 30/31/40/41), para
// provar que a leitura é por rótulo e não por posição fixa.
export const internalHeaderShifted = sparseRow({ 30: 'CODIGO', 31: 'DESCRICAO', 40: 'COD.BARRAS', 41: 'COD.FABRICANTE' }, WIDTH)
export const internalRowsShifted = [
  internalHeaderShifted,
  sparseRow({ 30: '0100', 31: 'Produto Teste A 90g', 4: '10', 9: '8', 15: '2,50', 16: '3,00', 24: 'CX', 40: '07891000000012', 41: 'FAB-A' }, WIDTH),
]

export const stockHeader = sparseRow({ 0: 'CODIGO', 1: 'DESCRICAO', 5: 'DISPONIVEL', 10: 'ESTOQUE', 16: 'COD.FABRICANTE' }, WIDTH)
export const stockRows = [
  stockHeader,
  sparseRow({ 0: '0100', 1: 'Produto Teste A 90g', 5: '8', 10: '10', 16: 'FAB-A' }, WIDTH),
]
