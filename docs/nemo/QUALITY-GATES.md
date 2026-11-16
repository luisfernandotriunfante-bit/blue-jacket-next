# Nemo — gates de qualidade

## Gate de implementação
- Critérios de aceitação atendidos.
- Testes próprios executados e resultados informados.
- Sem segredos, credenciais ou dados sensíveis no código/logs.
- Erros, carregamento, vazio e sucesso tratados quando aplicável.
- Documentação afetada atualizada.

## Gate de backend
- Entradas, autorização, erros, contratos, banco e migrações revisados.
- Testes de unidade/integração e compatibilidade executados conforme risco.
- Impacto em dados e reversão documentados.

## Gate de frontend
- Contratos integrados; fluxos principais funcionando.
- Responsividade nos tamanhos relevantes.
- Teclado, foco, contraste, rótulos e mensagens de erro validados.
- Validação visual no navegador com evidência.

## Gate de integração
- Build e suíte aplicável passam.
- Revisões cruzadas concluídas ou dispensa de tarefa P registrada.
- Divergências resolvidas e contratos sincronizados.
- Architect confirmou conformidade quando exigido.

## Gate de publicação
- Repositório, branch, commit e ambiente identificados.
- Build de produção concluído.
- Variáveis necessárias existem sem expor valores.
- Deploy terminou sem erro e URL foi aberta.
- Smoke test cobre carregamento, fluxo crítico e erro visível.
- Plano de reversão está disponível.

## Regra de falha
Nenhum gate pode ser marcado como aprovado sem evidência. Falha após deploy exige reversão e retorno ao Lead.

