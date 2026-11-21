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

// --- Abatimento da carteira em trânsito pela 218 (regra do Luis) ---

const BALANCE_WIDTH = 25

// Carteira com 2 notas sintéticas: "2974638" vai casar com um bloco da 218;
// "7777777" não tem nenhuma entrada correspondente (fica como aviso, sem
// abatimento). Total M = 1.000,00 + 500,00 = 1.500,00.
export const transitBalanceCarteiraRows = [
  industryPortfolioHeader,
  sparseRow({ 0: '10/6/26', 4: '61054413', 5: 'Produto Teste B', 6: '384', 7: '0', 8: '2974638', 12: '1.000,00' }, WIDTH),
  sparseRow({ 0: '11/6/26', 4: '61054499', 5: 'Produto Teste C', 6: '10', 7: '0', 8: '7777777', 12: '500,00' }, WIDTH),
]

// 218 (entradas atuais) com 2 blocos, cada um com "Nota Fiscal" e "Vl. Total"
// em posições diferentes — a leitura tem que ser pelo rótulo de cada bloco,
// não por um deslocamento fixo a partir de "Nota Fiscal". Só a nota
// "2974638" (bloco 1) existe aqui; "3000000" (bloco 2) não casa com nenhuma
// nota da carteira acima, então não entra no abatimento.
export const entradas218BlocosRows = [
  sparseRow({ 0: 'REL ENTRADA DE MERCADORIA' }, BALANCE_WIDTH),
  // Bloco 1: Nota Fiscal na coluna 2, Vl. Total na coluna 12.
  sparseRow({ 0: 'DT ENTRADA', 2: 'NOTA FISCAL', 12: 'VL. TOTAL' }, BALANCE_WIDTH),
  sparseRow({ 0: '10/01/2026', 2: '*2974638', 12: '1.200,00' }, BALANCE_WIDTH),
  sparseRow({ 0: 'CODIGO', 1: 'PRODUTO' }, BALANCE_WIDTH),
  sparseRow({ 0: 'P001' }, BALANCE_WIDTH),
  // Bloco 2: Nota Fiscal na coluna 4, Vl. Total na coluna 21 (linha acima
  // também termina o bloco 1).
  sparseRow({ 0: 'DT ENTRADA', 4: 'NOTA FISCAL', 21: 'VL. TOTAL' }, BALANCE_WIDTH),
  sparseRow({ 0: '11/01/2026', 4: '*3000000', 21: '300,00' }, BALANCE_WIDTH),
  sparseRow({ 0: 'CODIGO', 1: 'PRODUTO' }, BALANCE_WIDTH),
  sparseRow({ 0: 'P002' }, BALANCE_WIDTH),
  sparseRow({ 0: 'CPAGAR' }, BALANCE_WIDTH),
]
