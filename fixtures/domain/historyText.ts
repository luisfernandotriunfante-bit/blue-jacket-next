export const historySalesHeader = 'VENDAS 01/JAN/2026 a 31/JAN/2026 ANALITICO DETALHADO'

export const historySalesContent = [
  historySalesHeader,
  '',
  '15/01/2026 000123 X 11100100 3,00 9,00 0,00 X X X X 00011122233344 0701',
  '16/01/2026 000124 X 11100200 1,00 4,80 0,00 X X X X 00011122233344 0701',
].join('\n')

// venda com um codigo de origem que nao esta no catalogo Milenio nem bate
// com o prefixo 111, para testar a lista de nao-casados.
export const historySalesContentWithUnmatched = [
  historySalesHeader,
  '',
  '15/01/2026 000123 X 11100100 3,00 9,00 0,00 X X X X 00011122233344 0701',
  '20/01/2026 000125 X 99900555 2,00 5,00 0,00 X X X X 00011122233344 0701',
].join('\n')

export const legacyCatalogContent = [
  'RELACAO COMPLEMENTAR - CADASTRO DE ITENS MILENIO',
  '11100100 7891000000012 Produto Teste A 90g',
  '11100200 7891000000029 Produto Teste B 200ml',
].join('\n')
