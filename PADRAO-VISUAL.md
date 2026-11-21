# Padrão visual do Blue Jacket

Este documento define a aparência de todo o sistema daqui em diante. Cada nova tela, botão, seletor, campo, filtro, cartão, tabela e aviso segue exatamente o que está aqui. Um elemento que não está descrito neste documento não entra no sistema antes de ser acrescentado aqui.

Regras gerais:
1. Um componente, uma forma. Não existem variações por tela.
2. Nenhuma cor, fonte, tamanho ou raio fora dos tokens da seção 1.
3. Nenhum estilo inline para aparência. A aparência fica no arquivo de estilo.
4. Todo elemento interativo tem estados de hover, foco e desabilitado (seção 3).

---

## 1. Tokens

### 1.1 Cores

O sistema tem tema escuro (padrão) e tema claro. Cada token tem um valor para cada tema.

| Token | Uso | Escuro | Claro |
|---|---|---|---|
| `--background` | fundo da página | `#090909` | `#f5f5f2` |
| `--surface` | cartão, campo, seletor, barra lateral | `#121212` | `#ffffff` |
| `--surface-raised` | campo interno, painel suspenso, fundo de linha em destaque | `#1a1a1a` | `#fafafa` |
| `--border` | borda de cartão, campo, separador | `#303030` | `#d9d9d5` |
| `--text` | texto principal | `#f6f6f6` | `#171717` |
| `--muted` | texto secundário, item de navegação inativo | `#a7a7a7` | `#686868` |
| `--red` | ação principal, aba ativa, rótulo de indicador | `#ed1c24` | `#d4131b` |
| `--blue` | valor de destaque, anel de progresso, foco de painel | `#3b82f6` | `#2563eb` |
| `--white` | destaque neutro de indicador | `#e2e8f0` | `#64748b` |
| `#fff` | texto sobre `--red` (fixo nos dois temas) | `#fff` | `#fff` |

Não há outra cor no sistema. Verde, roxo e laranja não são usados em novas telas.

### 1.2 Tipografia

| Papel | Fonte | Peso |
|---|---|---|
| Texto corrido, campos, botões de texto | Manrope, Arial, sans-serif | 400 a 700 |
| Títulos de aba, valores de indicador, rótulos de aba | Space Grotesk, sans-serif | 800 |

Tamanhos fixos:
- Rótulo de indicador: 10px, peso 800, maiúsculas, espaçamento `.08em`, cor `--red`.
- Valor de indicador: `clamp(1.1rem, 1.55vw, 1.62rem)`, peso 800, Space Grotesk, espaçamento `-.025em`.
- Texto de botão, campo e seletor: 14px.
- Texto de tabela e de aviso: 13px.
- Legenda e texto secundário: 12px, cor `--muted`.
- Cabeçalho de tabela: 11px, peso 700, maiúsculas, espaçamento `.04em`, cor `--muted`.

### 1.3 Espaço, raio e altura

- Raio de cartão e indicador: 16px.
- Raio de botão de ação e de campo: 10px.
- Raio de botão de ação compacta: 6px.
- Raio de pílula e filtro suspenso: 999px.
- Raio de painel suspenso e de item de paginação: 6px.
- Altura mínima de campo, seletor e botão de ação: 40px.
- Padding de botão de ação: `0 16px`.
- Padding de campo e seletor: `0 13px`.

### 1.4 Layout

- Barra lateral fixa, 52px de largura, borda direita `--border`, fundo `--surface`. Ao passar o mouse, expande e mostra o nome dos itens.
- Área principal: margem esquerda de 52px e padding `42px clamp(24px, 5vw, 72px) 72px`.
- Espaço entre seções: 50px.
- Abaixo de 720px, a barra lateral some e a navegação inferior aparece.
- Pontos de quebra: 720px (troca para navegação inferior) e 1350px (reduz espaçamento). Não criar outros.

---

## 2. Componentes

### 2.1 Botão primário
Uso: a ação principal da tela (salvar, processar, criar base, aplicar).
- Fundo `--red`, texto `#fff`, sem borda, raio 10px, altura 40px, padding `0 16px`, peso 800, texto de 14px.
- Só um botão primário por área da tela.

### 2.2 Botão secundário
Uso: ações alternativas (adicionar, limpar, exportar).
- Fundo transparente, borda 1px `--red`, texto `--text`, raio 10px, altura 40px, padding `0 16px`, peso 800, texto de 14px.

### 2.3 Botão de aba
Uso: alternar visões dentro de uma tela (ex.: Dashboard, Produtos, Itens Foco, Notas).
- Fundo transparente, borda inferior de 3px transparente, texto `--muted`, Space Grotesk 800, maiúsculas, espaçamento `.08em`, padding `14px 32px`.
- Ativo: texto `--red` e borda inferior `--red`.
- As abas ficam alinhadas numa linha, com linha separadora `--border` por baixo.

### 2.4 Item de navegação lateral
- Largura total, altura mínima 40px, raio 8px, padding `10px`, peso 700, texto `--muted`, fundo transparente.
- Ativo: texto `--text` e fundo `--surface-raised`.
- Com a barra expandida, o texto aparece ao lado do ícone (padding `10px 12px`).

### 2.5 Item de navegação inferior (celular)
- Coluna com ícone de 22px e texto de 10px, peso 700, cor `--muted`, fundo transparente, padding `8px 4px`, larguras iguais.
- Ativo: cor `--red`.

### 2.6 Botão de ação compacta
Uso: ações dentro de linha de tabela ou de cartão (marcar, remover, ver detalhe).
- Altura 28px, padding `0 10px`, raio 6px, borda 1px `--border`, fundo transparente, texto `--muted`, 12px, peso 700.
- Hover: texto `--text` e borda `--muted`.
- Remover: texto `--red` no hover.

### 2.7 Botão de paginação
- 28px de altura, largura mínima 28px, raio 6px, borda 1px `--border`, fundo `--surface-raised`, texto `--text`, 13px, peso 700.
- Hover: fundo `--blue`, texto `#fff`, borda `--blue`.
- Desabilitado: opacidade `.4`.

### 2.8 Pílula
Uso: marcar um item como em destaque (ex.: PEX, lançamento).
- Raio 999px, borda 1px `--border`, fundo transparente, texto `--muted`, 12px, peso 700, padding `5px 12px`.
- Ativa: borda e texto `--blue`.

### 2.9 Filtro suspenso
Uso: escolher um ou mais valores de uma lista.
- Botão: raio 999px, borda 1px `--border`, fundo `--surface`, texto `--text`, 13px, padding `6px 14px`, altura 32px.
- Com valor selecionado: contador ao lado do rótulo, na cor `--blue`.
- Painel: fundo `--surface-raised`, borda 1px `--border`, raio 6px, sombra leve.
- Campo de busca dentro do painel: aparece quando há mais de 8 opções. Altura 32px, raio 6px, 12px, fundo `--surface`, foco com borda `--blue`.
- Seleção única: primeira opção "Todos", depois as opções; escolher uma opção fecha o painel.
- Seleção múltipla: caixa de seleção por opção; "Limpar seleção" em `--red` no topo, quando há valor marcado.

### 2.10 Seletor
- Altura mínima 40px, raio 10px, borda 1px `--border`, fundo `--surface`, texto `--text`, 14px, padding `0 13px`, largura mínima 165px.
- Foco: borda `--blue`.

### 2.11 Campo de texto e de número
- Altura mínima 40px, raio 10px, borda 1px `--border`, fundo `--surface`, texto `--text`, 14px, padding `0 13px`.
- Foco: borda `--blue`.
- Campo de número: largura padrão 120px, texto em peso 700.

### 2.12 Campo de busca
- Mesmo padrão do campo de texto (2.11), com lupa à esquerda quando couber.
- Dentro de painel suspenso: altura 32px e raio 6px (ver 2.9).

### 2.13 Caixa de seleção
- Usa a caixa padrão do navegador, sem estilo customizado.

### 2.14 Cartão de indicador
- Fundo `--surface`, borda 1px `--border`, raio 16px, altura mínima 120px, conteúdo centralizado, padding `16px 14px`.
- Rótulo: 10px, peso 800, maiúsculas, cor `--red`.
- Valor: Space Grotesk 800, tamanho `clamp(1.1rem, 1.55vw, 1.62rem)`, cor `--text`. Destaque em `--blue` quando o valor for o principal do cartão.
- Anel de progresso (opcional): 28px, traço 2.5px, trilho `--border`, progresso na cor de destaque (`--blue`, `--red` ou `--white`). Percentual escrito ao lado do anel, 12px, `--muted`.

### 2.15 Anel pequeno
- Tamanho 20px, traço 2px, trilho `--border`, progresso em `--blue`, `--red` ou `--white`.

### 2.16 Tabela
- Cabeçalho: 11px, peso 700, maiúsculas, espaçamento `.04em`, cor `--muted`, borda inferior 1px `--border`.
- Célula: 13px, cor `--text`, borda inferior 1px `--border`.
- Linha em hover: fundo `--surface-raised`.
- Valores numéricos alinhados à direita.

### 2.17 Aviso
- Borda esquerda de 3px, fundo `--surface-raised`, texto `--text`, 13px, padding `12px 16px`, raio 6px.
- Nível `ok`: borda em `--blue`.
- Nível `attention` e `action`: borda em `--red`.

### 2.18 Botão de fechar
- Ícone "×", sem borda, fundo transparente, cor `--muted`, hover `--text`.
- Sempre no canto superior direito do painel ou da janela.

### 2.19 Alternância de tema
- Item de navegação lateral (2.4), com ícone de lua ou sol.

---

## 3. Estados

- **Hover:** mudança de cor ou de opacidade. Nunca mudança de tamanho.
- **Foco:** borda `--blue` em campo, seletor e painel. Nunca remover o contorno sem substituir.
- **Ativo:** `--red` no texto e na borda inferior (abas), ou `--blue` na borda (pílula e campo focado).
- **Desabilitado:** opacidade `.4` (paginação) ou `.5` (botão de ação), cursor `not-allowed`.
- **Vazio:** texto `--muted` centralizado, com uma frase curta sobre o que falta.
- **Carregando:** texto de status no lugar do conteúdo, `--muted`, 13px.

---

## 4. Como usar este documento

Antes de criar uma tela nova:
1. Escolha, entre os componentes da seção 2, os que a tela precisa.
2. Se nenhum componente servir, escreva a nova definição aqui primeiro, com os tokens da seção 1.
3. Só depois crie o código.

Ao revisar uma tela, cada botão, seletor, campo e cartão precisa ser conferido contra a seção 2.
