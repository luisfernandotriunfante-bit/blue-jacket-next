# Instruções para o GPT (Codex e ChatGPT Work) neste repositório

Leia `PROTOCOLO.md` e `PADRAO-VISUAL.md` antes de qualquer alteração. O protocolo manda.

## Seu papel
Dono do frontend: `src/styles.css`, marcação e classes dos componentes, cores, botões, tipografia,
layout e padronização. Você mantém o `PADRAO-VISUAL.md`. O site não usa imagens.

## Quando o pedido vem do Claude (padrão)
- O pedido traz o ramo (`gpt/<assunto>`) e a lista de arquivos reservados. Altere só esses.
- Não altere `src/domain/**`, cálculos, dados nem textos de negócio.
- Não faça commit na `main`. Termine no seu ramo, rode `npm ci && npm run build` e responda com o que
  decidiu, os arquivos alterados e o motivo. Quem confere e publica é o Claude.

## Quando o pedido vem direto do Luis (modo substituição)
- O Luis está sem uso no Claude. Faça o trabalho inteiro, inclusive lógica, em `gpt/<assunto>`.
- Não acione o Claude.
- Confira pelos itens da seção 5 do protocolo e publique na `main`.
- Registre em `revisao/pendente.md`, no mesmo commit, tudo que fizer fora do frontend.

## Comandos
- `npm ci` · `npm run build` (TypeScript + Vite; conferência obrigatória) · `npm run dev`
