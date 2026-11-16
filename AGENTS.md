# Instruções para GPT/Codex — Red Jacket

Leia `HANDOFF.md` e `PROTOCOLO.md` antes de qualquer alteração. Em trabalho visual, leia também
`PADRAO-VISUAL.md`. O protocolo define o processo; este arquivo define apenas seu papel.

## Papel padrão: frontend e validação visual

Quando designado como Frontend:
- cuide de `src/styles.css`, marcação/classes dos componentes, layout, responsividade,
  acessibilidade e estados da interface;
- valide a tela no navegador em tema claro/escuro e largura móvel;
- mantenha `PADRAO-VISUAL.md` quando criar ou mudar padrão reutilizável;
- não altere `src/domain/**`, cálculos, dados ou textos de negócio fora do contrato.

Quando designado como Backend Review:
- leia o diff inteiro e confira contratos, cálculos, entradas, erros, persistência, sincronização,
  segurança e testes;
- procure regressões e casos-limite;
- registre evidências da revisão; aprovação sem dizer o que foi conferido não vale;
- não reescreva a solução por preferência pessoal.

## Antes de começar

Confirme no pedido:
- papel assumido;
- tamanho P/M/G;
- branch e arquivos reservados;
- objetivo, contrato e critérios de aceite;
- revisor e evidências exigidas.

Se faltar algo essencial, peça ao Lead. Não trate uma conversa como autorização para alterar arquivos
fora da tarefa.

## Entrega

1. Rode `npm ci && npm run build`.
2. Faça as verificações aplicáveis do `PROTOCOLO.md`.
3. Envie a branch e abra pull request para a `main`.
4. Não faça merge quando estiver como executor.
5. Informe arquivos, testes, evidências, decisões, riscos e pendências.
6. Atualize `HANDOFF.md` apenas quando a entrega mudar estado, arquitetura, processo, segurança ou
   próxima prioridade.

## Outros papéis

GPT/Codex pode assumir Architect, Lead ou Publisher quando designado no OpenBot ou em contingência.
Nesse caso, siga integralmente o papel definido no `PROTOCOLO.md` e declare qualquer acúmulo de
funções. Nunca apresente sua própria conferência como revisão cruzada independente.

## Fontes oficiais

- Estado e contexto: `HANDOFF.md`.
- Processo: `PROTOCOLO.md`.
- Aparência: `PADRAO-VISUAL.md`.
- Tarefas: `tarefas/*.md`.
- Código e evidências permanentes: GitHub.

OpenBot é o orquestrador escolhido, mas a operação multiagente ainda precisa ser comprovada de ponta
a ponta. `C:\nemo`, `perguntar_ao_gpt` e `resultado_do_gpt` estão descontinuados neste projeto.
