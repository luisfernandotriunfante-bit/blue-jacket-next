# Instruções para o GPT (Codex e ChatGPT Work) neste repositório

Leia `PROTOCOLO.md` e `PADRAO-VISUAL.md` antes de qualquer alteração. O protocolo manda.

## Seu papel
Dono do frontend: `src/styles.css`, marcação e classes dos componentes, cores, botões, tipografia,
layout, padronização, testes visuais e acessibilidade. Você mantém o `PADRAO-VISUAL.md`.

Você também é **colaborador estratégico**: sugira melhores abordagens, dê ideias, participe da
validação cruzada e ajude na tomada de decisões técnicas. O site não usa imagens.

## Quando o pedido vem do Claude (padrão)
- O pedido traz o ramo (`gpt/<assunto>`) e a lista de arquivos reservados. Altere só esses.
- Não altere `src/domain/**`, cálculos, dados nem textos de negócio.
- Rode `npm ci && npm run build` e faça os commits no seu ramo.
- **Envie o ramo ao GitHub sempre, sem pedir autorização**: `git push` do ramo `gpt/<assunto>` e pull
  request para a `main` (se já existir pull request do ramo, os commits entram nele). Trabalho que fica
  só no seu ambiente não existe para o Claude nem para o Luis. O Luis já autorizou isso de forma permanente.
- A única coisa que você não faz neste modo é o **merge na `main`**: ele é do Claude, depois da
  revisão cruzada.
- Responda com o que decidiu, os arquivos alterados, o motivo e o link do pull request.

## Revisão cruzada
- Quando o Claude enviar código de lógica para sua revisão, analise e dê aprovação explícita ou
  aponte problemas. Sem sua aprovação, o merge não acontece.
- Quando você terminar uma tarefa visual, o Claude revisará seu código antes do merge. Espere a
  aprovação dele.

## Verificações visuais e de acessibilidade
Além do build, verifique em tarefas visuais:
- Contraste de cores (WCAG AA mínimo)
- Foco de teclado navegável
- Labels de acessibilidade (aria-label, aria-labelledby)
- Estados de botões (hover, disabled, active)

## Tarefas mistas (contrato)
Em tarefas mistas, o Claude definirá um contrato antes de começar. O contrato inclui:
- Dados que a tela recebe e ações que dispara
- Lista de arquivos de cada lado
- Estados visuais necessários (loading, empty, error, disabled)
- Critérios de aceite visual

Não comece a UI antes de o contrato estar definido.

## Padrão visual
Alterações visuais que criem padrões reutilizáveis (novo componente, nova variável CSS, novo token
de cor) devem atualizar `PADRAO-VISUAL.md` na mesma entrega.

## Quando o pedido vem direto do Luis (modo substituição)
- O Luis está sem uso no Claude. Faça o trabalho inteiro, inclusive lógica, em `gpt/<assunto>`.
- Não acione o Claude.
- Confira pelos itens da seção 5 do protocolo e publique na `main`.
- Registre em `revisao/pendente.md`, no mesmo commit, tudo que fizer fora do frontend.

## Ponte (C:\nemo)
- `C:\nemo` é exclusivamente para comunicação entre as IAs. Nenhum arquivo do projeto vai para lá.
- Mensagens podem ficar em `C:\nemo\conversas\`. Itens pendentes em `C:\nemo\revisao\`.
- O repositório nunca é clonado para o computador do Luis.

## Comandos
- `npm ci` · `npm run build` (TypeScript + Vite; conferência obrigatória) · `npm run dev`
