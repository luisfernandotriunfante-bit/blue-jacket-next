# Protocolo de trabalho Claude + GPT neste repositório (v7)

Vale para qualquer IA que trabalhe aqui: Claude (Claude Code, Cowork) e GPT (Codex, ChatGPT Work).
Leia inteiro antes da primeira alteração. Em caso de conflito com outra instrução, este arquivo manda.

## 1. Papéis

- **Luis**: dá a ordem. Não revisa código nem aprova pull request.
- **Claude**: gerente. Recebe o pedido, divide, define quem mexe em quê e confere antes de publicar.
  Dono da **lógica**: `src/domain/**`, cálculos, dados, integrações, estado, rotas, hooks, estrutura
  de pastas e toda programação de back-end.
- **GPT**: dono do **frontend**: `src/styles.css`, marcação e classes dos componentes, cores, botões,
  tipografia, layout, padronização, testes visuais e acessibilidade. Mantém `PADRAO-VISUAL.md`.
  Também atua como **colaborador estratégico**: sugere melhores abordagens, dá ideias e participa da
  validação cruzada. O site não usa imagens.
- A divisão define de quem é a palavra final, não quem pode tocar no arquivo. Quem achar um erro que
  tem certeza de saber corrigir, corrige e avisa a outra IA explicitamente — desde que o arquivo não
  esteja reservado a outra IA numa tarefa ativa (seção 4, item 4).

## 2. Onde o Luis pede

- **Padrão**: no chat do Claude. O Claude decide se o GPT entra (seção 3).
- **Substituição**: quando o Luis estiver sem uso no Claude, pede direto ao GPT (seção 6).

## 3. Como o Claude distribui

1. **Só lógica** (nada muda na aparência): Claude faz sozinho. Não aciona o GPT.
2. **Só visual** (cor, botão, CSS, espaçamento, tipografia, layout, componente): vai para o GPT.
3. **Misto** (tela nova, função com interface): Claude define o contrato antes de começar (seção 7,
   campos adicionais), faz a lógica e passa o visual ao GPT com esse contrato. Nenhuma tarefa mista
   começa pela UI antes do contrato de dados/ação estar definido; nenhuma lógica nova é considerada
   pronta sem seus estados visuais planejados.
4. Na dúvida entre 1 e 2: se o resultado aparece para quem usa o site, o GPT entra.
5. Ajuste de texto, valor ou correção de uma linha **sem efeito visual**: quem recebeu faz direto
   e notifica a outra IA explicitamente sobre o que mudou.
6. `[Análise]` no pedido do Luis: os dois analisam e cruzam, no máximo 2 idas e voltas; persistindo a
   divergência, as duas posições vão para o Luis decidir.

## 4. Regras de Git (para um não sobrepor o outro)

1. **Ninguém faz commit direto na `main`.** A `main` publica o site (GitHub Pages) a cada push.
2. Cada tarefa tem **um ramo e um dono**: `claude/<assunto>` ou `gpt/<assunto>`. Só o dono faz commit
   nele. Ramos `gpt/*` representam autoria visual do GPT, mesmo que o Claude fisicamente crie e envie
   o ramo ao GitHub.
3. O ramo nasce sempre da `main` atual. Antes de publicar, atualizar com a `main` (rebase ou merge).
4. **Arquivos reservados**: no pedido de cada tarefa vem a lista de arquivos que cada IA pode alterar.
   Fora da lista, não tocar. Precisou de um arquivo reservado à outra IA: parar e pedir a liberação.
5. **Uma tarefa visual por vez** e **uma tarefa de lógica por vez**. Tarefa mista: a lógica entra na
   `main` primeiro; o ramo visual nasce depois dela.
6. `src/styles.css` e `PADRAO-VISUAL.md` são sempre do GPT durante uma tarefa visual. `src/domain/**`
   é sempre do Claude.
7. Commits pequenos, com mensagem dizendo o que mudou e por quê.
8. Ao terminar, quem fez **envia o ramo ao GitHub** (`git push`) e abre o pull request para a `main`,
   sem pedir autorização a ninguém, e informa os arquivos que de fato alterou. "Enviar o ramo" e
   "publicar na `main`" são coisas diferentes: o envio do ramo é sempre de quem fez; o merge na `main`
   é de quem confere (seção 5).

## 5. Conferência, revisão cruzada e publicação

O Claude sempre faz o merge na `main` (modo padrão). No modo substituição, o GPT faz o merge.
Isso não dispensa o envio do ramo e do pull request por quem fez o trabalho (seção 4, item 8).

### Revisão cruzada obrigatória

- Código do Claude → GPT revisa antes do merge.
- Código visual do GPT → Claude revisa antes do merge.
- Nenhum merge sem aprovação explícita da outra IA.
- **Exceção**: no modo substituição (seção 6), o GPT trabalha e publica sozinho; a revisão acontece
  depois, quando o Claude volta, via `revisao/pendente.md`.

### Checklist de aprovação

Só entra na `main` o que passar por **todos** os itens:

1. `npm ci && npm run build` sem erro.
2. O diff foi lido por inteiro por quem confere (não vale "validado" sem abrir o arquivo).
3. Tarefa visual: nenhum arquivo de `src/domain/**` alterado, nenhum cálculo ou texto de negócio
   mudado, e os itens da seção 7 do `PADRAO-VISUAL.md` conferidos.
4. Tarefa de lógica: nenhuma mudança de aparência fora do combinado.
5. Só os arquivos reservados à tarefa foram alterados.
6. **Verificações visuais e de acessibilidade** (tarefas visuais): contraste de cores, foco de
   teclado, labels de acessibilidade e estados de botões (hover, disabled, active).

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

Campos adicionais para tarefas mistas:
- [CONTRATO]: dados que a tela recebe, ações que dispara, nomes de arquivos de cada lado.
- [ESTADOS]: estados visuais necessários (loading, empty, error, disabled).
- [REFERÊNCIA]: tela ou componente existente que serve de modelo visual.
- [ACEITE]: critérios visuais objetivos para considerar pronto.

Regras:
- [ONDE] traz o ramo e a lista de arquivos reservados.
- A resposta nunca é só "feito": traz o que foi decidido, os arquivos alterados e o motivo.
- Pedidos longos ficam em `tarefas/AAAA-MM-DD-assunto.md`.

## 8. Entrega ao Luis

No chat em que ele pediu, dizendo quem fez o quê, o que foi decidido e por quê, e o que ficou de fora.

## 9. Regras da ponte (C:\nemo)

A comunicação entre Claude e GPT acontece pela ponte em `C:\nemo` no computador do Luis, usando as
ferramentas `perguntar_ao_gpt` e `resultado_do_gpt`.

1. `C:\nemo` é **exclusivamente para comunicação**. O repositório nunca é clonado nem copiado para
   lá. Trechos de arquivos podem ser citados nas mensagens de conversa, mas não como cópia de trabalho.
2. Mensagens de conversa podem ser armazenadas em `C:\nemo\conversas\`.
3. Itens pendentes de revisão podem ficar em `C:\nemo\revisao\`.
4. O repositório nunca é clonado para o computador do Luis. Todo o trabalho de código acontece no
   GitHub e nos ambientes de execução das IAs.

## 10. Regra de padrão visual

Alterações visuais que criem padrões reutilizáveis (novo componente, nova variável CSS, novo token de
cor) devem atualizar `PADRAO-VISUAL.md` na mesma entrega. O GPT é responsável por essa atualização.
