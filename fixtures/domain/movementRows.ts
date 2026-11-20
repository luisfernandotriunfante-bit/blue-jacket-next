import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 26

export const salesHeader = sparseRow(
  { 2: 'DATA MOVIMENTO', 3: 'COD. CLIENTE', 24: 'CODPROD. WINTHOR', 18: 'STATUS PEDIDO', 20: 'TIPO VENDA' },
  WIDTH,
)

export const salesRows = [
  salesHeader,
  sparseRow({ 2: '05/01/2026', 3: '001', 18: 'FATURADO', 20: 'NORMAL', 24: '0100', 10: '3', 12: '30,00' }, WIDTH),
  sparseRow({ 2: '06/01/2026', 3: '001', 18: 'A FATURAR', 20: 'NORMAL', 24: '0200', 10: '1', 12: '4,80' }, WIDTH),
  sparseRow({ 2: '06/01/2026', 3: '002', 18: 'FATURADO', 20: 'NORMAL', 24: '0100', 10: '7', 12: '70,00' }, WIDTH),
]

// Mesmo relatorio de vendas, com as colunas-ancora (DATA MOVIMENTO, COD.
// CLIENTE, CODPROD. WINTHOR, STATUS PEDIDO, TIPO VENDA) em posicoes bem
// diferentes das originais, para provar que a leitura é por rotulo e nao
// por posicao fixa.
export const salesHeaderShifted = sparseRow(
  { 5: 'DATA MOVIMENTO', 6: 'COD. CLIENTE', 8: 'CODPROD. WINTHOR', 2: 'STATUS PEDIDO', 3: 'TIPO VENDA' },
  WIDTH,
)
export const salesRowsShifted = [
  salesHeaderShifted,
  sparseRow({ 5: '05/01/2026', 6: '001', 2: 'FATURADO', 3: 'NORMAL', 8: '0100', 10: '3', 12: '30,00' }, WIDTH),
  sparseRow({ 5: '06/01/2026', 6: '001', 2: 'A FATURAR', 3: 'NORMAL', 8: '0200', 10: '1', 12: '4,80' }, WIDTH),
  sparseRow({ 5: '06/01/2026', 6: '002', 2: 'FATURADO', 3: 'NORMAL', 8: '0100', 10: '7', 12: '70,00' }, WIDTH),
]

// Corte de mercadorias sem venda atual correspondente, para testar o
// indicador de redigitacao pendente.
export const cutsHeader = sparseRow({ 0: 'CONSULTAR CORTE DE MERCADORIAS' }, WIDTH)
export const cutsRows = [
  cutsHeader,
  sparseRow({ 1: 'CLIENTE', 2: '001', 4: 'Empresa Teste Um LTDA' }, WIDTH),
  sparseRow({ 0: '10/01/2026', 1: '500', 2: '0100', 3: 'Produto Teste A', 10: '2', 11: '10,00', 12: '20,00' }, WIDTH),
]
