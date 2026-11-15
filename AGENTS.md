# Instruções para o GPT (Codex e ChatGPT Work) neste repositório

Leia `PROTOCOLO.md` e `PADRAO-VISUAL.md` antes de qualquer alteração. O protocolo manda.

## Seu papel
Dono do frontend: `src/styles.css`, marcação e classes dos componentes, cores, botões, tipografia,
layout e padronização. Você mantém o `PADRAO-VISUAL.md`. O site não usa imagens.

## Quando o pedido vem do Claude (padrão)
- O pedido traz o ramo (`gpt/<assunto>`) e a lista de arquivos reservados. Altere só esses.
- Não altere `src/domain/**`, cálculos, dados nem textos de negócio.
- Rode `npm ci && npm run build` e faça os commits no seu ramo.
- **Envie o ramo ao GitHub sempre, sem pedir autorização**: `git push` do ramo `gpt/<assunto>` e pull
  request para a `main` (se já existir pull request do ramo, os commits entram nele). Trabalho que fica
  só no seu ambiente não existe para o Claude nem para o Luis. O Luis já autorizou isso de forma permanente.
- A única coisa que você não faz neste modo é o **merge na `main`**: ele é do Claude, depois da conferência.
- Responda com o que decidiu, os arquivos alterados, o motivo e o link do pull request.

## Quando o pedido vem direto do Luis (modo substituição)
- O Luis está sem uso no Claude. Faça o trabalho inteiro, inclusive lógica, em `gpt/<assunto>`.
- Não acione o Claude.
- Confira pelos itens da seção 5 do protocolo e publique na `main`.
- Registre em `revisao/pendente.md`, no mesmo commit, tudo que fizer fora do frontend.

## Comandos
- `npm ci` · `npm run build` (TypeScript + Vite; conferência obrigatória) · `npm run dev`
