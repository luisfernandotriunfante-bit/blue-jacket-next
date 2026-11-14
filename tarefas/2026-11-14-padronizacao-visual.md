# Tarefa: padronizar o visual do site inteiro pelo padrão da aba Sell Out

[TAREFA] Padronização visual completa
[SOLICITADO POR] Luis, via Claude
[QUANDO] 14/11/2026
[PEDIDO] Deixar todas as abas no mesmo padrão visual da aba Sell Out > Dashboard, conforme
`PADRAO-VISUAL.md`. Só aparência: nenhum cálculo, dado ou texto de negócio muda.
[ENTREGA] Commits no ramo `gpt/padronizacao-visual`, `npm run build` passando, e resposta com as
decisões tomadas, os arquivos alterados e o que ficou de fora.
[ONDE] Ramo `gpt/padronizacao-visual`, criado a partir da `main`.
Arquivos reservados ao GPT nesta tarefa: `src/styles.css`, `PADRAO-VISUAL.md` e a marcação
(JSX/classes/estilo inline) de `src/*.tsx`. Proibido: `src/domain/**`, hooks, cálculos, `useMemo` de
dados, textos de negócio, `package.json`.
[POR QUÊ] O Luis apontou inconsistências visuais entre as abas e quer um padrão único.
[STATUS] Aguardando o GPT

## Achados da varredura (Claude, 14/11/2026, commit base `0c966d5`)

Números medidos no código:

| Item | Situação hoje |
|---|---|
| Estilo inline (`style={{`) | 274 ocorrências em 11 arquivos; Sortimento 46, App 40, Estoque 34, Gerencial 32 |
| Raios de borda | 13 valores diferentes (2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 999px) |
| Tamanhos de fonte | 8, 9, 10, 11, 11.5, 12, 13, 14, 15px + `rem` só no treemap do Estoque |
| Classes de botão | 15, com raio de 5 a 8px e paddings diferentes |
| Classes de badge | ~15 com o mesmo desenho e medidas ligeiramente diferentes |
| Estilos de tabela | 5 (`so-daily-table`, `so-day-detail-table`, `gr-table`, `notas-items-table`, `crt-tb`) + 4 listas em grade |
| Cores escritas à mão | âmbar `#f59e0b` 12x; 4 roxos; 4 verdes; cores do Material no Sortimento |

Lista de correções, em ordem de prioridade:

1. **Erro real**: `var(--bg)` não existe (linhas ~515, 536, 538 de `styles.css`: `.cl-history-wrap`,
   `.rca-field input`, `.rca-opt-btn`). Trocar por `var(--background)`.
2. **Tema claro quebrado**:
   - `.stock-line-card` tem fundo fixo `#111821` e texto `#fff` (treemap do Estoque).
   - Hovers com `rgba(255,255,255,.02/.03)` não aparecem no claro (`.so-dt-row`, `.gr-row`,
     `.cl-expandable-row`). Usar `var(--surface-raised)`.
   - Badges com `rgba(255,255,255,.05/.07)` (`.so-mov-bonificacao/-corte/-entrada`, `.rca-badge-inac`).
3. **Tokens**: criar `--amber`, `--green`, `--purple` e a escala `--radius-*`; substituir os valores
   escritos à mão (seções 2.2 e 2.4 do padrão).
4. **Semáforo**: Sortimento usa `#4caf50`/`#ff9800`/`#ef5350` em estilo inline e nas classes
   `.sort-class-badge`/`.sort-status-badge`. Migrar para azul/âmbar/vermelho (seção 2.3).
5. **Estado ativo e foco**: unificar em azul (seção 3). Hoje vermelho em `.pf-range button.is-active`,
   `.sort-mode-btn.active`, `.cad-pex-toggle.on`, e foco vermelho em `.stock-search`, `.pf-input`,
   `.config-input`, `.cad-upload-textarea`, `.notas-cart-date`.
6. **Botões**: convergir as 15 classes para os 4 botões do padrão (seção 4).
7. **Badges**: criar `.badge` + variantes e migrar as classes atuais.
8. **Tabelas e listas**: criar `.data-table`; alinhar cabeçalho (9px) e paddings; listas do Sortimento
   passam a usar a base de `.stock-list`.
9. **Abas internas**: `.gr-view-btn` com as medidas de `.stock-nav-btn`.
10. **Painel de seção**: apelido neutro `.panel`; remover os `!important` e o `maxHeight` inline.
11. **CSS dentro de componente**: `CRT_STYLES` em `src/CarteiraTab.tsx` (bloco `<style>` com as classes
    `crt-*` e a rampa `--r0…--r4`) vai para `styles.css`, usando os tokens.
12. **Estado vazio**: um só (`.so-empty`).
13. **Estilo inline estático** vira classe. Fica inline só o que vem do dado.
14. **Escala de fonte**: eliminar 8px, 11.5px, 15px e os `rem` do treemap.

Se o volume for grande demais para uma rodada, entregar na ordem acima e dizer onde parou.
