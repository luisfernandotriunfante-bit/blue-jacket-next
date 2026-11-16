# Nemo — princípios de arquitetura

## Fonte e implantação
- O projeto vive no GitHub; trabalho local não cria uma fonte paralela.
- Branch, ambiente e mecanismo de deploy devem ser identificados no pacote arquitetural.
- Configuração e segredos ficam fora do código e são documentados por nome, nunca por valor.

## Limites do sistema
- **Interface:** telas, componentes, acessibilidade, estados e comunicação com contratos.
- **Aplicação:** casos de uso, coordenação e regras de fluxo.
- **Domínio:** regras de negócio independentes da interface.
- **Infraestrutura:** banco, APIs externas, autenticação, filas, armazenamento e deploy.

Dependências devem apontar para dentro: interface e infraestrutura não definem regras do domínio.

## Contratos
Todo contrato descreve entrada, saída, erros, autorização, efeitos colaterais, compatibilidade e testes. Mudança incompatível exige migração e plano de reversão.

## Dados e segurança
- Validar entradas nas fronteiras.
- Aplicar menor privilégio e autorização no servidor.
- Não registrar segredos nem dados pessoais desnecessários.
- Migrações devem ser reproduzíveis, testadas e reversíveis quando possível.

## Observabilidade
Fluxos críticos devem produzir logs úteis, estado de execução e correlação suficiente para diagnóstico, sem expor dados sensíveis.

## Pacote do Architect
Objetivo, contexto atual, mapa afetado, componentes, contratos, dependências, riscos, critérios, sequência, testes, observabilidade, migração e reversão.

