import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 20

export const internalHeader = sparseRow({ 0: 'CODIGO', 5: 'CPF/CNPJ', 10: 'COD.RCA', 12: 'COD.SUPERVISOR' }, WIDTH)
export const internalRows = [
  internalHeader,
  sparseRow({ 0: '001', 1: 'Empresa Teste Um LTDA', 2: 'Loja Um', 5: '00011122233344', 6: 'Cidade Teste', 10: '0007', 11: 'Vendedor Um', 13: 'Supervisor Um' }, WIDTH),
  sparseRow({ 0: '002', 1: 'Empresa Teste Dois LTDA', 2: 'Loja Dois', 5: '00099988877766', 6: 'Cidade Teste', 10: '0008', 11: 'Vendedor Dois', 13: 'Supervisor Um' }, WIDTH),
]

export const portfolioHeader = sparseRow({ 0: 'CODIGO CLIENTE', 1: 'CNPJ', 12: 'FREQUENCIA', 15: 'REPRESENTANTE' }, WIDTH)
export const portfolioRows = [
  portfolioHeader,
  sparseRow({ 0: '001', 1: '00011122233344', 2: 'Empresa Teste Um LTDA', 5: 'Cidade Teste', 12: 'Semanal', 15: 'Rep Um' }, WIDTH),
]
