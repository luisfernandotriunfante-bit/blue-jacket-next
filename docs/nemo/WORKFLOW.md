# Nemo — fluxo operacional

## Estados oficiais
`Ideia → Arquitetura → Planejada → Em execução → Em revisão → Integrada → Em conformidade → Pronta para publicar → Publicada`

Estados de exceção: `Bloqueada`, `Falhou`, `Revertida` e `Cancelada`.

## Etapas
1. **Luis:** descreve ideia, prioridade e restrições.
2. **Architect:** consulta produto, sistema e decisões; entrega pacote arquitetural.
3. **Lead:** classifica P/M/G, decompõe tarefas, define contratos, dependências, responsáveis e ordem.
4. **Backend/Frontend:** implementam em paralelo quando os contratos permitem; cada executor testa a própria entrega.
5. **Revisão cruzada:** GPT revisa backend de Claude; Claude revisa frontend de GPT. Tarefa P pode pular somente com justificativa do Lead.
6. **Lead:** integra código, contratos e testes e resolve divergências técnicas.
7. **Architect:** verifica aderência a arquitetura, mapas e decisões, sem repetir a revisão linha a linha.
8. **Publisher:** verifica gates, publica, acompanha deploy e executa smoke test.

## Severidade de apontamentos
- **Bloqueador:** impede integração/publicação ou cria risco crítico.
- **Importante:** comportamento incorreto, regressão ou dívida relevante.
- **Melhoria:** aumenta qualidade sem impedir a entrega.
- **Observação:** informação sem ação obrigatória.

## Regra de retorno
- Implementação ou teste falhou → executor.
- Integração ou contrato divergiu → Lead.
- Arquitetura divergiu → Architect.
- Objetivo ou prioridade mudou → Luis.
- Deploy/smoke falhou → Publisher reverte e devolve ao Lead.

## Modelo de passagem
```text
Tarefa e tamanho:
Responsável:
Realizado:
Arquivos/áreas:
Contratos:
Testes e resultados:
Evidências:
Decisões:
Riscos e pendências:
Próximo responsável:
```

