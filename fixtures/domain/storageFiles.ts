// Conteudo sintetico pequeno, sem dado real, só para testar o round-trip de
// upload/download do Storage (nao precisa ser um xlsx valido para isso).
export const sampleCadastroContent = 'codigo;descricao\n001;Produto Teste A\n002;Produto Teste B\n'
export const sampleCadastroContentV2 = 'codigo;descricao\n001;Produto Teste A (corrigido)\n'
export const sampleCarteiraContent = 'codigocliente;cnpj\n001;00011122233344\n'

// Nome com espaco, parenteses, acento e apostrofo, sintetico, para testar que
// o nome original (nao o caminho sanitizado) e o que volta na restauracao.
export const sampleComplexFileName = "Sortimento Recomendado - Q4'26 (preço médio).xlsx"
export const sampleSortimentoContent = 'codigo;canal\n001;Hiper\n'
