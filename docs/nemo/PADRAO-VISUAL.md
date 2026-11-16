# Nemo — sistema visual oficial

## Direção
Central de operações moderna, elegante e intuitiva — não uma página de chat genérica. Comunicação, automações, agentes, tarefas, mapas e preview convivem em um ambiente sóbrio.

## Tokens iniciais
- Fundo: `#0E1115`; superfície: `#171B21`; superfície elevada: `#1D232B`.
- Borda: `#29303A`; texto principal: `#F4F7FA`; secundário: `#AAB4C0`.
- Ação principal: coral `#FF6B5F`; sucesso: `#39C982`; alerta: `#F2B84B`; erro: `#EF5B67`.
- Claude: âmbar; GPT: verde-água. A cor nunca é o único indicador.
- Raios: 10, 14 e 18 px. Sombras discretas. Grade de espaçamento baseada em 4 px.
- Tipografia: fonte de sistema; corpo mínimo de 14 px; hierarquia por tamanho e peso, não por caixa alta.

## Layout
- Navegação principal persistente.
- Conversas no centro; contexto, atividade ou preview em painel lateral.
- Tarefas e agentes usam listas densas, com estado, modelo e responsável visíveis.
- Mapas usam nós sobre grade discreta, conectores legíveis e estado textual.
- Uma ação primária por área; ações destrutivas são separadas e claramente identificadas.

## Componentes obrigatórios
Botões, campos, seletores, cartões, mensagens, tarefas, nós de mapa, alertas, estados vazios, carregamento, erro, confirmação e preview devem compartilhar tokens e comportamento.

## Responsividade
- Abaixo de 1000 px: lateral compacta e contexto recolhível.
- Abaixo de 650 px: navegação inferior, uma coluna e ações essenciais ao alcance do polegar.
- Nenhum fluxo essencial depende de hover.

## Acessibilidade
- Contraste WCAG AA, foco visível e navegação por teclado.
- Rótulos programáticos em controles e textos alternativos quando houver conteúdo visual relevante.
- Movimento respeita preferência de redução.
- Erros explicam causa e correção; não dependem apenas de cor.

## Restrições
- Não usar imagens decorativas sem função.
- Evitar brilho excessivo, gradientes chamativos, cartões supérfluos e textos longos em caixa alta.
- Uma mudança visual estrutural exige atualização deste documento e registro em `DECISIONS.md`.

