# Protocolo de trabalho Claude + GPT neste repositório (v6)

Vale para qualquer IA que trabalhe aqui: Claude (Claude Code, Cowork) e GPT (Codex, ChatGPT Work).
Leia inteiro antes da primeira alteração. Em caso de conflito com outra instrução, este arquivo manda.

## 1. Papéis

- **Luis**: dá a ordem. Não revisa código nem aprova pull request.
- **Claude**: gerente. Recebe o pedido, divide, define quem mexe em quê e confere antes de publicar.
  Dono da **lógica**: `src/domain/**`, cálculos, dados, integrações, estado, rotas, estrutura de pastas.
- **GPT**: dono do **frontend**: `src/styles.css`, marcação e classes dos componentes, cores, botões,
  tipografia, layout e padronização. Mantém `PADRAO-VISUAL.md`. O site não usa imagens.
- A divisão define de quem é a palavra final, não quem pode tocar no arquivo. Quem achar um erro que
  tem certeza de saber corrigir, corrige e avisa.

## 2. Onde o Luis pede

- **Padrão**: no chat do Claude. O Claude decide se o GPT entra (seção 3).
- **Substituição**: quando o Luis estiver sem uso no Claude, pede direto ao GPT (seção 6).

## 3. Como o Claude distribui

1. **Só lógica** (nada muda na aparência): Claude faz sozinho. Não aciona o GPT.
2. **Só visual** (cor, botão, CSS, espaçamento, tipografia, layout, componente): vai para o GPT.
3. **Misto** (tela nova, função com interface): Claude define o contrato (dados que a tela recebe,
   ações que dispara, nomes de arquivos), faz a lógica e passa o visual ao GPT com esse contrato.
4. Na dúvida entre 1 e 2: se o resultado aparece para quem usa o site, o GPT entra.
5. Ajuste de texto, valor ou correção de uma linha **sem efeito visual**: quem recebeu faz direto.
6. `[Análise]` no pedido do Luis: os dois analisam e cruzam, no máximo 2 idas e voltas; persistindo a
   divergência, as duas posições vão para o Luis decidir.

## 4. Regras de Git (para um não sobrepor o outro)

1. **Ninguém faz commit direto na `main`.** A `main` publica o site (GitHub Pages) a cada push.
2. Cada tarefa tem **um ramo e um dono**: `claude/<assunto>` ou `gpt/<assunto>`. Só o dono faz commit nele.
3. O ramo nasce sempre da `main` atual. Antes de publicar, atualizar com a `main` (rebase ou merge).
4. **Arquivos reservados**: no pedido de cada tarefa vem a lista de arquivos que cada IA pode alterar.
   Fora da lista, não tocar. Precisou de um arquivo reservado à outra IA: parar e pedir a liberação.
5. **Uma tarefa visual por vez** e **uma tarefa de lógica por vez**. Tarefa mista: a lógica entra na
   `main` primeiro; o ramo visual nasce depois dela.
6. `src/styles.css` e `PADRAO-VISUAL.md` são sempre do GPT durante uma tarefa visual. `src/domain/**`
   é sempre do Claude.
7. Commits pequenos, com mensagem dizendo o que mudou e por quê.
8. Ao terminar, quem fez informa os arquivos que de fato alterou.

## 5. Conferência e publicação (sem revisão do Luis)

Quem publica é quem confere. No modo padrão é o Claude; no modo substituição é o GPT.

Só entra na `main` o que passar por **todos** os itens:

1. `npm ci && npm run build` sem erro.
2. O diff foi lido por inteiro por quem confere (não vale "validado" sem abrir o arquivo).
3. Tarefa visual: nenhum arquivo de `src/domain/**` alterado, nenhum cálculo ou texto de negócio mudado,
   e os itens da seção 7 do `PADRAO-VISUAL.md` conferidos.
4. Tarefa de lógica: nenhuma mudança de aparência fora do combinado.
5. Só os arquivos reservados à tarefa foram alterados.

Passou: merge na `main` e o ramo é apagado. Não passou: quem confere corrige o que souber corrigir ou
devolve ao dono do ramo com o motivo. Nada quebrado vai para a `main`.

## 6. Modo substituição (Luis sem uso no Claude)

- O GPT faz o trabalho inteiro, inclusive lógica, em ramo `gpt/<assunto>`, **sem acionar o Claude**.
- O GPT confere pelos itens da seção 5 e publica na `main`.
- Tudo que fizer **fora do frontend** é registrado em `revisao/pendente.md` no mesmo commit, no modelo
  do topo daquele arquivo. Mudança só visual não precisa de registro.
- Quando o Luis voltar ao Claude, a primeira coisa que o Claude faz é abrir `revisao/pendente.md`.
  Havendo entradas: lê os arquivos, corrige o que estiver errado, diz ao Luis o que estava certo e o
  que mudou, copia a entrada com o resultado para `revisao/revisado.md` e a remove de `pendente.md`.

## 7. Formato do pedido entre as IAs

[TAREFA] / [SOLICITADO POR] / [QUANDO] / [PEDIDO] / [ENTREGA] / [ONDE] / [POR QUÊ] / [STATUS]

- [ONDE] traz o ramo e a lista de arquivos reservados.
- A resposta nunca é só "feito": traz o que foi decidido, os arquivos alterados e o motivo.
- Pedidos longos ficam em `tarefas/AAAA-MM-DD-assunto.md`.

## 8. Entrega ao Luis

No chat em que ele pediu, dizendo quem fez o quê, o que foi decidido e por quê, e o que ficou de fora.
