import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 14

// Carteira da indústria real (relatório em inglês/SAP): datas no formato
// americano M/D/AA sem zero à esquerda, nota fiscal e valor em colunas
// próprias e nomeadas — não em deslocamento relativo a "Material".
export const industryPortfolioHeader = sparseRow(
  { 0: 'Order Date', 1: 'Customer Number', 2: 'Customer Name', 3: 'Order Number', 4: 'Material', 5: 'Description', 6: 'Order Qty', 7: 'Bill Qty', 8: 'Nota Fiscal Number', 9: 'Billing Type', 10: 'Billing Date', 11: 'Gross Weight', 12: 'Net Value (with PIS/Cofins)', 13: 'Net Value ( ZINV )' },
  WIDTH,
)
export const industryPortfolioRows = [
  industryPortfolioHeader,
  sparseRow({ 0: '11/3/26', 4: 'BR03494A', 5: 'Produto Teste A', 6: '120', 7: '0', 8: '', 12: '19,740.67' }, WIDTH),
  sparseRow({ 0: '10/6/26', 4: '000000000061054413', 5: 'Produto Teste B', 6: '384', 7: '0', 8: '2974638', 12: '146,110.06' }, WIDTH),
]

// Mesmas linhas, com as colunas em posições bem diferentes das originais,
// para provar que a leitura é por rótulo e não por posição/deslocamento.
export const industryPortfolioHeaderShifted = sparseRow(
  { 9: 'Order Date', 1: 'Customer Number', 2: 'Customer Name', 3: 'Order Number', 10: 'Material', 11: 'Description', 12: 'Order Qty', 13: 'Bill Qty', 0: 'Nota Fiscal Number', 8: 'Billing Type', 7: 'Billing Date', 6: 'Gross Weight', 5: 'Net Value (with PIS/Cofins)', 4: 'Net Value ( ZINV )' },
  14,
)
export const industryPortfolioRowsShifted = [
  industryPortfolioHeaderShifted,
  sparseRow({ 9: '11/3/26', 10: 'BR03494A', 11: 'Produto Teste A', 12: '120', 13: '0', 0: '', 5: '19,740.67' }, 14),
  sparseRow({ 9: '10/6/26', 10: '000000000061054413', 11: 'Produto Teste B', 12: '384', 13: '0', 0: '2974638', 5: '146,110.06' }, 14),
]
