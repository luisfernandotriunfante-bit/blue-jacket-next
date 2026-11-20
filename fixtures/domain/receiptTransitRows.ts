import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 12

// Carteira da industria (em transito) com a coluna de valor em outra posicao
// (index 10), identificada pelo cabecalho "VALOR".
export const transitHeaderValueAt10 = sparseRow({ 0: 'ORDER DATE', 4: 'MATERIAL', 5: 'DESCRIPTION', 6: 'ORDER QTY', 7: 'BILL QTY', 9: 'NF', 10: 'VALOR' }, WIDTH)
export const transitRowsValueFound = [
  transitHeaderValueAt10,
  sparseRow({ 0: '10/01/2026', 4: '1001', 5: 'Produto Teste A', 6: '5', 7: '0', 9: '123-A', 10: '250,50' }, WIDTH),
]

// Mesma carteira, mas sem nenhuma coluna com cabecalho de valor.
export const transitHeaderNoValue = sparseRow({ 0: 'ORDER DATE', 4: 'MATERIAL', 5: 'DESCRIPTION', 6: 'ORDER QTY', 7: 'BILL QTY', 9: 'NF' }, WIDTH)
export const transitRowsNoValueColumn = [
  transitHeaderNoValue,
  sparseRow({ 0: '10/01/2026', 4: '1001', 5: 'Produto Teste A', 6: '5', 7: '0', 9: '123-A' }, WIDTH),
]

// Coluna de valor encontrada pelo cabecalho, mas os valores vieram zerados.
export const transitRowsValueZeroed = [
  transitHeaderValueAt10,
  sparseRow({ 0: '10/01/2026', 4: '1001', 5: 'Produto Teste A', 6: '5', 7: '0', 9: '123-A', 10: '0' }, WIDTH),
]
