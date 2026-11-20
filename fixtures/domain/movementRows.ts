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

// Corte de mercadorias sem venda atual correspondente, para testar o
// indicador de redigitacao pendente.
export const cutsHeader = sparseRow({ 0: 'CONSULTAR CORTE DE MERCADORIAS' }, WIDTH)
export const cutsRows = [
  cutsHeader,
  sparseRow({ 1: 'CLIENTE', 2: '001', 4: 'Empresa Teste Um LTDA' }, WIDTH),
  sparseRow({ 0: '10/01/2026', 1: '500', 2: '0100', 3: 'Produto Teste A', 10: '2', 11: '10,00', 12: '20,00' }, WIDTH),
]
