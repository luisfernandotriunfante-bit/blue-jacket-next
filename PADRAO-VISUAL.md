# Padrão visual do Red Jacket

Fonte única da aparência do site. Referência: a aba **Sell Out > Dashboard** (`src/SellOutTab.tsx`).
Toda tela nova ou alterada segue este arquivo. Se o padrão mudar, este arquivo muda no mesmo commit.

Dono: GPT (frontend). Definido pelo Claude em 14/11/2026 a partir da varredura do código; o GPT pode
refinar, desde que registre a mudança aqui.

## 1. Princípios

1. Nada de cor, raio ou tamanho de fonte "solto": tudo sai dos tokens da seção 2.
2. O site tem tema claro e escuro. Nenhum componente pode depender de fundo escuro fixo
   (ex.: texto `#fff` sobre fundo fixo, hover com `rgba(255,255,255,…)`).
3. Estilo inline (`style={{…}}`) só para valor que vem do dado (largura de barra em %, cor da linha
   comercial). Layout, espaçamento, fonte e cor fixa vão para classe no `src/styles.css`.
4. Todo CSS mora em `src/styles.css`. Nada de bloco `<style>` dentro de componente.
5. Um componente, uma classe. Antes de criar classe nova, usar a que já existe na seção 4.

## 2. Tokens

### 2.1 Cores (já existem em `.theme-dark` / `.theme-light`)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--background` | `#090909` | `#f5f5f2` | fundo da página |
| `--surface` | `#121212` | `#ffffff` | cartões, painéis, linhas de lista |
| `--surface-raised` | `#1a1a1a` | `#fafafa` | cabeçalho de tabela, hover, cartão em destaque |
| `--text` | `#f6f6f6` | `#171717` | texto principal |
| `--muted` | `#a7a7a7` | `#686868` | texto secundário, rótulos |
| `--border` | `#303030` | `#d9d9d5` | bordas e divisórias |
| `--red` | `#ed1c24` | `#d4131b` | marca, títulos, rótulo de KPI, ação principal, alerta/pendente |
| `--blue` | `#3b82f6` | `#2563eb` | realizado/positivo, estado ativo de controle, foco |
| `--white` | `#e2e8f0` | `#64748b` | destaque neutro |

### 2.2 Cores adicionais

| Token novo | Valor | Substitui | Uso |
|---|---|---|---|
| `--amber` | `#f59e0b` | `#f59e0b`, `#ff9800`, `#e65100` | atenção / faixa intermediária |
| `--green` | `#10b981` | `#10b981`, `#22c55e`, `#4caf50`, `#2e7d32` | concluído / sincronizado |
| `--purple` | `#a855f7` | `#a855f7`, `#8b5cf6`, `#9e5bee`, `#a78bfa` | categoria extra (PJ, rede, PEX+lançamento) |

`--background` é o token de fundo; `--bg` não é usado.

### 2.3 Semáforo de desempenho (um só no site inteiro)

Igual ao Sell Out e ao Gerencial: **bom = `--blue`, médio = `--amber`, ruim = `--red`**.
O Sortimento usa a escala azul/âmbar/vermelho.

### 2.4 Raios

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 4px | badge, tag, etiqueta |
| `--radius-sm` | 6px | botão, controle pequeno, item de menu |
| `--radius-md` | 10px | campo de texto, select, lista, dropdown, painel lateral |
| `--radius-lg` | 16px | cartão, painel de seção, KPI |
| `--radius-pill` | 999px | chip de filtro, contador |

Valores fora da escala hoje (2, 3, 5, 7, 8, 9, 12, 20px) migram para o vizinho mais próximo.
Exceção: barras de progresso finas mantêm 3px.

### 2.5 Tipografia

- Texto: `Manrope`. Números, títulos, abas e valores: `Space Grotesk`.
- Escala (px): **9** cabeçalho de tabela e etiqueta de gráfico · **10** rótulo em caixa alta e badge ·
  **11** texto secundário · **12** corpo de tabela · **13** corpo · **14** ênfase · **16/18/28** h3/h2/h1.
- Valor de KPI: `clamp(1.1rem, 1.55vw, 1.62rem)`, peso 800, `Space Grotesk`.
- Rótulo em caixa alta: peso 800, `letter-spacing: .08em`.
- Fora da escala hoje: 8px, 11.5px, 15px e os tamanhos em `rem` do treemap do Estoque. Migrar.

### 2.6 Espaçamento

Escala: 4, 8, 12, 16, 20, 24px. Padding de painel: `14px 18px` no cabeçalho, `16px` no corpo.
Distância entre blocos de uma aba: 20px. Grade de KPIs: `gap: 12px`.

## 3. Estados de interação

| Situação | Regra |
|---|---|
| Aba de navegação ativa | texto `--red` + sublinhado `--red` de 3px (`.stock-nav-btn.on`) |
| Controle ativo (filtro, alternador, paginação, "Atual") | fundo `--blue`, texto branco, borda `--blue` |
| Foco em campo | borda azul e contorno de foco visível de 2px |
| Hover em linha | `background: var(--surface-raised)` |
| Linha selecionada | `background: color-mix(in srgb, var(--blue) 8%, transparent)` |
| Desabilitado | `opacity: .4; cursor: not-allowed` |

Hoje o estado ativo é vermelho em uns lugares (`.pf-range`, `.sort-mode-btn`, `.cad-pex-toggle`) e azul
em outros; o foco é vermelho no Estoque e azul no resto. Vale a tabela acima.

## 4. Componentes canônicos

| Componente | Classe de referência | Especificação |
|---|---|---|
| Barra de abas | `.stock-topbar` + `.stock-nav-btn` | 14px/800, caixa alta, `.08em`. `.gr-view-btn` (13px, padding diferente) passa a usar esta |
| Painel de seção | `.notas-section` + `.notas-section-head` + `.notas-section-title` | fundo `--surface`, borda, raio 16; título 10px/800 caixa alta `--muted`. Criar o apelido neutro `.panel`, `.panel-head`, `.panel-title` e tirar os `!important` de `.so-detail-section`/`.so-lines-section` |
| Cartão de KPI | `.stock-kpis` + `.kpi-card` | rótulo 10px/800 `--red`; valor `Space Grotesk`; variantes `.kpi-blue/.kpi-red/.kpi-white` |
| Cartão de destaque | `.so-hero-card` | fundo `--surface-raised`, raio 16 |
| Tabela | `.so-daily-table` | th 9px/800 caixa alta `.07em` `--muted`, padding `7px 10px`, fixo no topo; td 12px, padding `8px 10px`; número à direita em `Space Grotesk` 700 (`.n-right`). Criar `.data-table` e migrar `.gr-table`, `.notas-items-table`, `.so-day-detail-table`, `.crt-tb` |
| Lista em grade | `.stock-list` + `.stock-head` + `.stock-row` | cabeçalho 11px/700 caixa alta; linha `11px 14px`. `.sort-client-*`, `.sort-rede-*`, `.sort-product-*` passam a usar esta base |
| Badge | `.so-mov-badge` | `padding: 2px 7px`, raio 4, 10px/800, fundo da cor a 10%, borda da cor a 30%. Criar `.badge` + `.badge-blue/-red/-amber/-green/-purple/-neutral` e migrar as ~15 classes de badge atuais |
| Botão principal | `.process-button` | fundo `--red`, texto branco, raio 6, 13px/800, altura 36px |
| Botão secundário | `.secondary-button` | transparente, borda `--border`, texto `--text`; hover: borda e texto `--text`. Raio 6, altura 36px |
| Botão de controle | `.so-nav-btn` | altura 28px, raio 6, 12px/700; ativo conforme seção 3 |
| Botão de limpar/perigo | `.pf-clear-btn` | borda e texto `--red`, raio 6, altura 28px |
| Campo de texto / select | `.pf-input` / `.pf-select` | altura 40px, raio 10, borda `--border`, foco azul |
| Chip de filtro | `.pf-range button` | pílula, 12px/700; ativo azul (exceção: chips ABC mantêm a cor da classe) |
| Estado vazio | `.so-empty` | centralizado, título 15px/700, apoio 13px `--muted`. `.empty`, `.sort-empty`, `.stock-treemap-empty` passam a usar este |
| Modal | `.modal-backdrop` + `.modal` | raio 16, padding 24px |

Hoje existem 15 classes de botão com raio de 5 a 8px e paddings diferentes (`.add-button`, `.cad-pex-btn`,
`.cad-pex-clear`, `.cad-pex-toggle`, `.rca-btn`, `.so-compact-btn`, `.sort-filter-btn`, `.sort-clear-btn`,
`.sort-mode-btn`, `.pf-filter-btn`, `.comp-close-btn`, `.crt-*-btn`…). Todas convergem para os 4 botões acima.

## 5. Gráficos

- Trilha/grade: `--border`. Série principal: `--text`. Realizado: `--blue`. Pendente: `--red` tracejado.
- Texto de eixo: 9px, `--muted`, `Space Grotesk`.
- Cores das linhas comerciais (fixas, vêm do dado): Creme Dental `--blue`, Esc + Enx + Fio `--green`,
  Sabonetes `--amber`, Hair `--purple`, Limpeza `#64748b`.

## 6. Responsividade e acessibilidade

- Quebras: 720px (menu inferior, 1 coluna) e 960px (grade de detalhe em 1 coluna).
- Alvo de toque mínimo no celular: 40px de altura.
- Contraste mínimo de texto: 4.5:1 nos dois temas. Nunca usar só cor para passar informação
  (badge sempre com texto).
- Todo botão só com ícone tem `aria-label`.

## 7. Conferência antes de entregar

1. `npm run build` passa.
2. Nenhuma cor hexadecimal nova em `.tsx` (exceto as cores de dado da seção 5).
3. Tela conferida nos temas claro e escuro e em largura de celular.
4. Nenhuma regra de cálculo, dado ou texto de negócio foi alterada.

### Base de interação (E1)

As escalas de cor, espaço, raio e tipografia estão disponíveis como propriedades CSS globais. `--focus` usa o azul do tema; `--on-accent` é branco e `--overlay` é preto a 60%. Os temas definem `color-scheme`. Controles recebem contorno de foco visível e animações respeitam movimento reduzido; a fonte usa `system-ui` como alternativa.

### Componentes compartilhados (E2)

Classes `.btn` (variantes `-primary`, `-secondary`, `-control`, `-danger`, `-sm`, `-icon`), `.tabs`/`.tab`, `.chip`, `.badge` e variantes de cor, `.panel`/`.panel-head`/`.panel-title`, `.data-table`, `.empty-state`, `.field`/`.input`/`.select`/`.textarea` e `.page-head` fornecem a base para migração gradual. As classes anteriores permanecem durante a migração; `.add-button`, `.secondary-button` e `.process-button` compartilham altura e raio da base de botão.

### Navegação (E3)

A sidebar compacta também expande com foco do teclado; entre 721 e 1024px permanece compacta com títulos nos controles. As abas rolam horizontalmente e a navegação móvel preserva alvos de pelo menos 40px.

### Diálogos (E4)

Os diálogos têm título associado, foco inicial, retorno ao controle de origem e Escape para fechar. O foco permanece no diálogo. Sua largura e altura respeitam a tela; em telas pequenas o conteúdo rola e os campos empilham.

### Texto vermelho e tabelas comerciais (E5)

`--red-text` usa `#f43f46` no tema escuro (4,68:1 sobre `#1a1a1a`) e `#d4131b` no claro; `--red` permanece para fundos e marca. Linhas expansíveis aceitam Enter e Espaço. Tabelas mantêm todas as colunas em contêiner rolável.

### Estoque (E6)

O cabeçalho e a superfície dos cartões do treemap usam os tokens do tema; os blocos coloridos permanecem calculados pelos dados. Linhas interativas respondem a Enter e Espaço.

### Carteira (E7)

Os estilos da Carteira residem em `styles.css`. O seletor de modo ativo usa azul, e cidades selecionáveis no mapa e na lista aceitam teclado. As rampas do mapa preservam seus valores de dados originais.

### Sortimento e filtros (E8)

O semáforo de sortimento usa azul (bom), âmbar (intermediário) e vermelho (ruim). `--amber-text` usa `#f59e0b` no escuro e `#985500` no claro para leitura em superfícies; o âmbar de preenchimento permanece `--amber`. Controles selecionados usam azul; linhas de seleção respondem ao teclado.

### Contraste e grades (E9)

`--red-fill` é `#c2151c` no tema escuro e `#d4131b` no claro; `--blue-fill` é `#2563eb`. Com branco, as razões calculadas são 6,14:1, 5,37:1 e 5,17:1, respectivamente. São usados nos preenchimentos de ações e controles selecionados. As grades extensas de Cadastro, Pirâmide e Estoque mantêm colunas em rolagem horizontal interna e nomes podem quebrar linhas. Classes `visual-u-*` agrupam estilos estáticos previamente inline e são temporárias enquanto componentes legados forem migrados.

Os tons `--r0` a `--r4` e `--r-soft` mantêm a escala de dados da Carteira em cada tema. `--on-amber` é `#000000`; `--green-text` é `#10b981` no escuro e `#087a57` no claro, para preservar o significado de concluído com leitura adequada.

Aliases legados mantidos nesta entrega: botões `.add-button`, `.secondary-button`, `.process-button`, `.rca-btn`, `.cad-pex-btn`, `.pf-clear-btn`, `.pf-filter-btn`, `.sort-filter-btn`, `.sort-clear-btn`, `.sort-mode-btn`, `.so-compact-btn`, `.so-nav-btn`, `.stock-nav-btn`, `.gr-view-btn`, `.comp-close-btn` e `.rca-opt-btn` compartilham raio; os vazios e painéis antigos compartilham tokens de superfície e texto. As variantes específicas permanecem para preservar seus fluxos.
`--map-complete` mantém `#22c55e`, cor de dado da Carteira e de sua legenda.

`--blue-text` é `#60a5fa` no escuro e `#1d4ed8` no claro, usado em textos azuis sobre fundos de destaque; `--blue` permanece para séries e elementos de dados.

Exceções e regras finais da validação (E9):
- Texto vermelho em qualquer superfície usa `--red-text` (inclui a legenda do donut do Estoque, "Remover" e os avisos de vazio de Uploads/Dados). `--red` fica só para fundo, marca e séries de dados.
- Dicas secundárias usam `--muted` sem `opacity` (a opacidade reduzia o contraste para 2,4–3,6:1).
- Alvos de toque ≤720px: botões, abas, chips, campos e rótulos de checkbox têm 40px; a caixa do checkbox nativo mede 13px dentro de um rótulo clicável de 40px. Links dentro de parágrafo (ex.: link do console Firebase) são exceção de link em linha.
- Linhas clicáveis de tabela (`.so-dt-row`) têm altura mínima de 40px em ≤720px.
- Linhas de ajuste de Configurações (`.config-input-row`) quebram linha para o botão "Salvar" nunca sair da tela; o grid de motores em Uploads usa `minmax(0, 1fr)` para não estourar 4px em 360px.
- `!important` permanece somente no bloco `prefers-reduced-motion` (precisa vencer animações e transições inline de terceiros). Raios: 5 tokens, `50%` (círculos) e `3px` (barras de gráfico).
- Texto branco sobre as telhas do treemap de Estoque usa o gradiente escuro da própria telha em ambos os temas.
- Desabilitado (`:disabled`) fica isento de contraste mínimo, como previsto pelo WCAG.

Os textos de badges usam âmbar `#985500`, verde `#087a57` e roxo `#7e22ce` no tema claro; no escuro usam `#f59e0b`, `#10b981` e `#a855f7`. O preenchimento azul ativo usa `#2563eb`.

O título da seção usa `.page-head` e os rótulos existentes da navegação. Abas administrativas indicam rolagem e mantêm a aba selecionada visível.
