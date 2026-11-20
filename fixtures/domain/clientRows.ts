import { sparseRow } from '../../tests/domain/helpers/files'

const WIDTH = 20

export const internalHeader = sparseRow({ 0: 'CODIGO', 5: 'CPF/CNPJ', 10: 'COD.RCA', 12: 'COD.SUPERVISOR' }, WIDTH)
export const internalRows = [
  internalHeader,
  sparseRow({ 0: '001', 1: 'Empresa Teste Um LTDA', 2: 'Loja Um', 5: '00011122233344', 6: 'Cidade Teste', 10: '0007', 11: 'Vendedor Um', 13: 'Supervisor Um' }, WIDTH),
  sparseRow({ 0: '002', 1: 'Empresa Teste Dois LTDA', 2: 'Loja Dois', 5: '00099988877766', 6: 'Cidade Teste', 10: '0008', 11: 'Vendedor Dois', 13: 'Supervisor Um' }, WIDTH),
]

// Mesmo cadastro interno, com CODIGO/CPF-CNPJ/COD.RCA/COD.SUPERVISOR em
// colunas diferentes das originais, para provar que a leitura é por
// rótulo e não por posição fixa.
export const internalHeaderShifted = sparseRow({ 14: 'CODIGO', 16: 'CPF/CNPJ', 18: 'COD.RCA', 19: 'COD.SUPERVISOR' }, WIDTH)
export const internalRowsShifted = [
  internalHeaderShifted,
  sparseRow({ 14: '001', 1: 'Empresa Teste Um LTDA', 2: 'Loja Um', 16: '00011122233344', 6: 'Cidade Teste', 18: '0007', 19: 'Vendedor Um', 20: 'Supervisor Um' }, WIDTH),
]

export const portfolioHeader = sparseRow({ 0: 'CODIGO CLIENTE', 1: 'CNPJ', 12: 'FREQUENCIA', 15: 'REPRESENTANTE' }, WIDTH)
export const portfolioRows = [
  portfolioHeader,
  sparseRow({ 0: '001', 1: '00011122233344', 2: 'Empresa Teste Um LTDA', 5: 'Cidade Teste', 12: 'Semanal', 15: 'Rep Um' }, WIDTH),
]

// codigocliente fora da posicao 0, com as colunas-ancora (cnpj, frequencia,
// representante) intactas nas mesmas posicoes de sempre.
export const portfolioHeaderCodeMoved = sparseRow({ 16: 'CODIGO CLIENTE', 1: 'CNPJ', 12: 'FREQUENCIA', 15: 'REPRESENTANTE' }, WIDTH)
export const portfolioRowsCodeMoved = [
  portfolioHeaderCodeMoved,
  sparseRow({ 16: '001', 1: '00011122233344', 2: 'Empresa Teste Um LTDA', 5: 'Cidade Teste', 12: 'Semanal', 15: 'Rep Um' }, WIDTH),
]

// cabecalho da carteira sem nenhuma coluna "codigocliente".
export const portfolioHeaderNoCode = sparseRow({ 1: 'CNPJ', 12: 'FREQUENCIA', 15: 'REPRESENTANTE' }, WIDTH)
export const portfolioRowsNoCode = [
  portfolioHeaderNoCode,
  sparseRow({ 1: '00011122233344', 2: 'Empresa Teste Um LTDA', 5: 'Cidade Teste', 12: 'Semanal', 15: 'Rep Um' }, WIDTH),
]

// Piramide ativa: nao tem as colunas-ancora da carteira (cnpj/frequencia/
// representante nas posicoes 1/12/15), para garantir que nao vira falso
// positivo de carteira depois que a ancora da carteira ficou mais solta.
export const premisesHeader = sparseRow({ 0: 'SEMESTRE PREMISSA', 2: 'COD CLIENTE', 13: 'CHECK PDV' }, WIDTH)
export const premisesRows = [
  premisesHeader,
  sparseRow({ 0: '2026-1', 2: '001', 3: 'Empresa Teste Um LTDA', 5: 'SP', 6: 'Cidade Teste', 8: 'Cluster A', 11: 'Perfil A', 14: 'Rede Teste' }, WIDTH),
]
