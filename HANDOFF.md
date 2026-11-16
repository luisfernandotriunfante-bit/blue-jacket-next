# HANDOFF — Red Jacket

Documento de passagem para qualquer IA ou equipe de agentes que assuma este projeto.
Leia inteiro antes da primeira alteração. Última atualização: 2026-11-16.

---

## 1. O que é o sistema

**Red Jacket** é um painel comercial web (SPA) usado por um profissional de vendas para
analisar clientes, produtos, estoque, sortimento, sell-out e dados financeiros. O usuário
importa planilhas Excel/XLS e o sistema processa, cruza e apresenta os dados em abas
especializadas.

- **Confirmado no código.** O repositório se chama `blue-jacket-next` por razão histórica;
  o nome oficial do produto é **Red Jacket** (definido pelo Luis em 16/11/2026). O `package.json`,
  `index.html` e `README.md` já usam "Red Jacket". O path do GitHub Pages é `/blue-jacket-next/`
  e não precisa mudar (é só rota de deploy).

---

## 2. Situação atual (16/11/2026)

| Item | Estado |
|---|---|
| Aplicação | Funcional, publicada em GitHub Pages |
| Abas ativas | App (admin), Clientes, Cadastro Cliente, Pirâmide, Carteira, Estoque, Sortimento, Sell Out, Gerencial, Campanhas (placeholder), RCA Manager |
| Dados | Importados via planilhas Excel/XLS; persistidos em IndexedDB; sincronizados via Firebase Realtime Database |
| Testes automatizados | Nenhum. Único gate: `npm run build` (TypeScript + Vite). **Decisão do Luis: adicionar testes.** |
| PR #142 | Aberta, NÃO mergear. **Decisão do Luis: fechar.** Contém documentação aspiracional do "Nemo" que foi substituído pelo OpenBot. |
| Segurança | **URGENTE.** `.env` com credenciais reais do Firebase está commitado em repo público. Pasta `arquivos/` com 126 MB de dados comerciais está commitada. Ambos precisam ser removidos e as credenciais rotacionadas. |

---

## 3. Objetivos ativos

1. **Segurança e limpeza** (prioridade imediata):
   - Remover `.env` do rastreamento git e rotacionar credenciais Firebase.
   - Remover `arquivos/` do rastreamento git (dados comerciais sensíveis em repo público).
   - Remover branch de desenvolvimento hardcoded do workflow de deploy.

2. **Padronização da execução e governança** (esta etapa):
   - Consolidar documentação para guiar agentes de IA via OpenBot.
   - Definir fluxo de trabalho coerente e executável.
   - Fechar PR #142.

3. **Padronização visual** (próxima etapa):
   - Tarefa especificada em `tarefas/2026-11-14-padronizacao-visual.md`.
   - Status: aguardando o agente de frontend.

4. **Histórico de sortimento** (pendente):
   - Tracking de performance per-client, item por item, com variação ano/mês/trimestre.
   - Aguardando planilha do Luis.

---

## 4. Arquitetura real (confirmada no código)

```
React 19 + TypeScript 6 + Vite 8
│
├── src/
│   ├── App.tsx              — Shell principal, navegação por abas, uploads, admin
│   ├── *Tab.tsx (10 abas)   — Cada aba é um componente independente
│   ├── RcaManager.tsx       — Gestão de representantes
│   ├── styles.css           — Todo CSS do projeto (765 linhas)
│   ├── firebaseConfig.ts    — Inicialização Firebase
│   └── domain/              — Motores de processamento de dados
│       ├── clientMotor.ts   — Processa planilhas de clientes
│       ├── productMotor.ts  — Processa planilhas de produtos + sortimento
│       ├── receiptMotor.ts  — Processa notas fiscais
│       ├── historyMotor.ts  — Processa histórico de vendas
│       ├── movementMotor.ts — Processa movimentações de estoque
│       ├── cloudSync.ts     — Sincronização Firebase Realtime DB
│       ├── persistence.ts   — Persistência IndexedDB
│       ├── syncEngine.ts    — Coordenação de sync
│       ├── competenciaEngine.ts — Motor de competência por período
│       ├── productGrouping.ts   — Agrupamento de produtos
│       ├── fileDetector.ts  — Detecção de tipo de arquivo
│       ├── audit.ts         — Tipos e utilidades de auditoria
│       └── types.ts         — Tipos compartilhados
│
├── .github/workflows/
│   └── deploy.yml           — Deploy automático: push to main → GitHub Pages
│
└── index.html               — Entry point (título: "Red Jacket")
```

**Confirmado no código:**
- Não há servidor backend. É uma SPA pura que roda no browser.
- Não há banco de dados relacional, filas, APIs REST, autenticação de servidor.
- Os dados vêm de planilhas Excel importadas pelo usuário.
- Firebase é usado apenas para sync (Realtime Database) e storage.
- IndexedDB é o armazenamento primário no browser.

**Não existe no projeto (apesar de mencionado em documentos aspiracionais):**
- Testes automatizados, linter, formatter.
- Backend, APIs, migrações de banco.
- Autenticação de usuários, roles, permissões.
- Smoke tests, health checks, rollback automático.

---

## 5. Principais telas e módulos

| Aba | Arquivo | Função | Linhas |
|---|---|---|---|
| Admin/Uploads | `App.tsx` | Navegação, importação de arquivos, configurações | 1056 |
| Estoque | `StockTab.tsx` | Estoque, notas recebidas, treemap, caixas | 1830 |
| Carteira | `CarteiraTab.tsx` | Gestão de carteira de clientes | 1516 |
| Sortimento | `SortimentoTab.tsx` | Análise de sortimento por canal | 799 |
| Cadastro Cliente | `CadastroClienteTab.tsx` | Cadastro e edição de clientes | 606 |
| Sell Out | `SellOutTab.tsx` | Dashboard de sell-out (referência visual) | 594 |
| Pirâmide | `PiramideTab.tsx` | Análise de premissas/pirâmide | 543 |
| Gerencial | `GerencialTab.tsx` | Dashboard financeiro/gerencial | 474 |
| Clientes | `ClientesTab.tsx` | Listagem de clientes | 352 |
| RCA | `RcaManager.tsx` | Gestão de representantes comerciais | 341 |
| Campanhas | `CampaignTab.tsx` | Placeholder (20 linhas) | 20 |

---

## 6. Fontes de dados

O usuário importa planilhas via a interface de uploads em `App.tsx`. Cada motor
(`src/domain/*Motor.ts`) reconhece um tipo de planilha pelo cabeçalho (posição fixa de colunas).

| Motor | Planilhas que reconhece | Campos-chave |
|---|---|---|
| `clientMotor` | Cadastro interno, Carteira, Roteiro geral, Pirâmide ativa | document (CPF/CNPJ), channelType, premiseRange, premiseNetwork |
| `productMotor` | Lista de indústria (produtos + sortimento por canal) | internalCode, manufacturerCode, unitsPerBox, sortimentChannels |
| `receiptMotor` | Entrada de mercadoria | invoice, productCode, quantity, unitPrice, value |
| `historyMotor` | Histórico de vendas | (período, produto, cliente, quantidade, valor) |
| `movementMotor` | Movimentações de estoque | (produto, tipo, quantidade) |

**Confirmado no código:** A detecção de arquivo usa `fileDetector.ts` que identifica o tipo
pela estrutura do cabeçalho, não pelo nome do arquivo.

---

## 7. Como o site é publicado

**Confirmado na configuração** (`.github/workflows/deploy.yml`):

1. Push na branch `main` dispara o workflow "Publicar no GitHub Pages".
2. O workflow faz: checkout → Node 20 → `npm ci` → `npm run build` → upload artifact → deploy.
3. O site fica disponível em `https://luisfernandotriunfante-bit.github.io/blue-jacket-next/`.
4. Não há smoke test, health check nem rollback automático após deploy.
5. **Alerta:** A branch `claude/affectionate-wright-4mal4c` também está no trigger — deve ser removida.

**Não existe:** rollback automático, preview de PRs, ambientes de staging.

---

## 8. Divisão de responsabilidades

### Decisões confirmadas pelo Luis (16/11/2026)

| Papel | Responsável | Escopo |
|---|---|---|
| **Dono do projeto** | Luis | Decisões de produto, priorização, aprovação de mudanças arquiteturais |
| **Architect** | Bot designado (via OpenBot) | Recebe pedidos do Luis, planeja, distribui trabalho. O Luis fala com o Architect como falaria com Claude hoje. |
| **Backend / Lógica** | Bot designado | `src/domain/**`, cálculos, dados, integrações, estado, hooks |
| **Frontend / Visual** | Bot designado | `src/styles.css`, componentes visuais, CSS, acessibilidade, `PADRAO-VISUAL.md` |
| **Publisher** | Bot designado | Merge na main, garantir gates antes de publicar. Pode publicar automaticamente quando todos os gates passarem. |
| **Revisão cruzada** | Backend revisa frontend, frontend revisa backend | Nenhum merge sem aprovação explícita da outra parte |

### Mudanças em relação ao protocolo anterior (PROTOCOLO.md v7)

| Antes (v7) | Agora |
|---|---|
| Claude = gerente, GPT = frontend | Papéis por função (Architect, Backend, Frontend, Publisher), não por modelo de IA |
| Comunicação via C:\nemo (ponte local) | **C:\nemo descontinuado.** Comunicação exclusivamente via OpenBot |
| `perguntar_ao_gpt` / `resultado_do_gpt` | **Descontinuados.** OpenBot orquestra |
| Claude sempre faz merge | Publisher faz merge (pode ser qualquer bot designado) |
| GPT publica sozinho só em modo substituição | Qualquer bot com papel Publisher pode publicar quando gates passarem |
| Nemo como repo/produto | **Descontinuado.** Substituído por OpenBot como orquestrador |

### O que NÃO muda

- **PROTOCOLO.md** continua como referência de regras de git, formato de tarefas e checklist.
- **PADRAO-VISUAL.md** continua como referência visual.
- **Regras de git** da seção 4 do PROTOCOLO continuam válidas (branches, arquivos reservados, uma tarefa por tipo).
- **Revisão cruzada** continua obrigatória (quando houver mais de um agente trabalhando).
- **`npm run build` sem erro** continua como gate mínimo obrigatório.

---

## 9. Fluxo de uma tarefa

### Fluxo real atual (confirmado no histórico de PRs)
```
Luis pede → Architect (bot) planeja → Bot designado implementa
→ PR para main → Revisão cruzada (se aplicável) → Publisher faz merge
→ Deploy automático via GitHub Pages
```

### Regras
1. Ninguém faz commit direto na `main`.
2. Cada tarefa tem um branch e um dono: `<agente>/<assunto>`.
3. Branch nasce da `main` atual. Atualizar com main antes de mergear.
4. Arquivos reservados: definidos no pedido de cada tarefa.
5. Uma tarefa visual por vez, uma tarefa de lógica por vez.
6. Commits pequenos com mensagem dizendo o que mudou e por quê.
7. Quem termina abre o PR e informa os arquivos alterados.

### Tarefas pequenas (só lógica OU só visual)
Passam direto pelo bot responsável, sem envolver todos os agentes.
O Architect só precisa ser envolvido quando há decisão de arquitetura.

### Tarefas mistas (lógica + visual)
O Architect define um contrato antes de começar:
- Dados que a tela recebe e ações que dispara.
- Lista de arquivos de cada lado.
- Estados visuais necessários (loading, empty, error, disabled).
- Critérios de aceite.

A lógica entra na main primeiro; o branch visual nasce depois.

---

## 10. Regras de branches e arquivos reservados

**Definido por regra** (PROTOCOLO.md §4):

- `main` — protegida, publica o site a cada push.
- `claude/<assunto>` ou `<agente>/<assunto>` — branches de trabalho.
- `gpt/<assunto>` — branches visuais (autoria do agente de frontend).
- Arquivos reservados ao **backend**: `src/domain/**`.
- Arquivos reservados ao **frontend**: `src/styles.css`, `PADRAO-VISUAL.md`.
- Fora da lista reservada: parar e pedir liberação.

---

## 11. Revisões e testes obrigatórios

### Gate mínimo (confirmado na configuração)
- `npm ci && npm run build` sem erro.

### Checklist de aprovação (definido por regra, PROTOCOLO.md §5)
1. Build passa.
2. Diff lido por inteiro por quem confere.
3. Tarefa visual: nenhum arquivo de `src/domain/**` alterado.
4. Tarefa de lógica: nenhuma mudança de aparência fora do combinado.
5. Só os arquivos reservados foram alterados.
6. Tarefas visuais: contraste, foco, labels, estados de botão conferidos.

### Ainda não implementado (decisão do Luis: adicionar)
- Linter (ESLint).
- Testes unitários.
- Testes de integração.
- Smoke test pós-deploy.

---

## 12. Padrão visual

Fonte oficial: `PADRAO-VISUAL.md` (136 linhas, atualizado 14/11/2026).
Referência visual: aba Sell Out > Dashboard (`src/SellOutTab.tsx`).

Resumo:
- Tokens de cor: `--background`, `--surface`, `--surface-raised`, `--text`, `--muted`, `--border`, `--red`, `--blue`, `--white`.
- Tokens a criar: `--amber`, `--green`, `--purple`.
- Escala de raios: `--radius-xs` (4px) a `--radius-pill` (999px).
- Fontes: Manrope (texto), Space Grotesk (números, títulos, abas, valores).
- Temas: claro e escuro. Todo componente deve funcionar em ambos.
- Semáforo: bom = azul, médio = âmbar, ruim = vermelho.
- Todo CSS mora em `src/styles.css`. Inline só para valores dinâmicos.

A tarefa de padronização visual (`tarefas/2026-11-14-padronizacao-visual.md`) lista 14
correções priorizadas. Status: aguardando execução na próxima etapa.

---

## 13. Documentos oficiais e ordem de leitura

Para qualquer IA que comece a trabalhar neste repositório:

| Ordem | Documento | Conteúdo | Status |
|---|---|---|---|
| 1 | `HANDOFF.md` (este) | Visão geral, decisões, situação atual | **Ativo** |
| 2 | `PROTOCOLO.md` | Regras de trabalho entre IAs | **Ativo, precisa atualização** (v7 → v8: remover C:\nemo, atualizar papéis) |
| 3 | `CLAUDE.md` | Instruções para Claude | **Ativo** |
| 4 | `AGENTS.md` | Instruções para GPT/Codex | **Ativo** |
| 5 | `PADRAO-VISUAL.md` | Design system | **Ativo** |
| 6 | `tarefas/*.md` | Tarefas ativas | **Ativo** |
| 7 | `revisao/pendente.md` | Trabalho pendente de revisão | **Ativo** (vazio) |
| 8 | `README.md` | Descrição do projeto | **Desatualizado, precisa reescrita** |

### Documentos que NÃO são oficiais
- `docs/nemo/*` (PR #142) — **Não mergear. Fechar PR.** Conteúdo aspiracional do Nemo, substituído por OpenBot.
- Qualquer referência a C:\nemo, `perguntar_ao_gpt`, `resultado_do_gpt` — **Descontinuados.**

---

## 14. Decisões confirmadas pelo Luis (16/11/2026)

| # | Decisão | Status |
|---|---|---|
| D-01 | Nome oficial é **Red Jacket** | Confirmado pelo Luis |
| D-02 | Sistema é um painel comercial de execução de vendas | Confirmado pelo Luis |
| D-03 | GitHub é a única fonte de verdade para código | Confirmado no código |
| D-04 | Deploy automático via GitHub Pages no push to main | Confirmado na configuração |
| D-05 | Publisher pode mergear e publicar automaticamente quando gates passarem | Confirmado pelo Luis |
| D-06 | Qualquer bot pode publicar quando Claude estiver indisponível | Confirmado pelo Luis |
| D-07 | OpenBot substitui C:\nemo e Nemo como orquestrador | Confirmado pelo Luis |
| D-08 | PR #142 deve ser fechada sem merge | Confirmado pelo Luis |
| D-09 | Docs de governança de bots podem ficar neste repo para guiar agentes | Confirmado pelo Luis |
| D-10 | Dados sensíveis (`.env`, `arquivos/`) devem ser removidos do repo público | Confirmado pelo Luis, **URGENTE** |
| D-11 | Testes automatizados devem ser adicionados | Confirmado pelo Luis |
| D-12 | Padronização visual é a próxima etapa (após segurança e governança) | Confirmado pelo Luis |
| D-13 | Nemo não terá repo separado — conceito substituído por OpenBot | Confirmado pelo Luis |
| D-14 | O Luis fala com o Architect; o Architect planeja e distribui | Confirmado pelo Luis |

---

## 15. Hipóteses ainda não confirmadas

| Hipótese | Depende de |
|---|---|
| Revisão cruzada entre agentes funcionará na prática via OpenBot | Comprovação em uso real |
| GPT/Codex consegue executar tarefas visuais com qualidade neste repo | Primeira tarefa visual ainda não executada |
| OpenBot consegue orquestrar múltiplos agentes neste projeto | Infraestrutura do OpenBot |
| As security rules do Firebase protegem os dados adequadamente | Verificação manual pelo Luis |
| A remoção de `arquivos/` e `.env` do git não quebra funcionalidade | Confirmação após execução |
| Ferramentas de lint/test serão viáveis sem refatoração grande | Avaliação técnica |

---

## 16. Riscos conhecidos

### Crítico
1. **Credenciais Firebase expostas em repo público.** `.env` com API key, project ID e demais
   valores reais está commitado e no histórico do git. Rotacionar credenciais imediatamente.
2. **Dados comerciais em repo público.** `arquivos/` (126 MB) contém planilhas com dados de
   clientes, vendas, preços e estoque.

### Alto
3. **Sem testes automatizados.** Qualquer regressão só é detectada manualmente.
4. **Branch de desenvolvimento no trigger de deploy.** `claude/affectionate-wright-4mal4c` no
   `deploy.yml` permite deploy de código não mergeado.

### Médio
5. **PROTOCOLO.md desatualizado.** Referências a C:\nemo, ferramentas de ponte e divisão
   Claude/GPT rígida não refletem mais a realidade.
6. **README.md desatualizado.** Descreve apenas o "primeiro ciclo" — o sistema tem 10+ abas
   e funcionalidades não documentadas.
7. **Todas as dependências em `dependencies`.** Dev tools (TypeScript, Vite, @types) deveriam
   estar em `devDependencies`.

### Baixo
8. **Nenhum linter ou formatter.** Inconsistências de estilo no código.
9. **Componente Campanhas é placeholder.** 20 linhas, sem funcionalidade.

---

## 17. Pendências atuais

| # | Pendência | Prioridade | Responsável | Status |
|---|---|---|---|---|
| P-01 | Remover `.env` do git + rotacionar credenciais Firebase | **Crítica** | Luis (credenciais) + bot (git) | Aguardando |
| P-02 | Remover `arquivos/` do git | **Crítica** | Bot | Aguardando |
| P-03 | Remover branch dev do deploy.yml trigger | **Alta** | Bot | Aguardando |
| P-04 | Fechar PR #142 | **Alta** | Bot ou Luis | Aguardando |
| P-05 | Atualizar PROTOCOLO.md para v8 (remover C:\nemo, atualizar papéis) | **Alta** | Bot | Aguardando |
| P-06 | Atualizar README.md | **Média** | Bot | Aguardando |
| P-07 | Executar padronização visual | **Média** | Agente frontend | Especificada, aguardando |
| P-08 | Adicionar ESLint + testes básicos | **Média** | Bot | Aguardando |
| P-09 | Histórico de sortimento por cliente | **Média** | Bot backend | Aguardando planilha do Luis |
| P-10 | Mover devDependencies no package.json | **Baixa** | Bot | Aguardando |

---

## 18. Última entrega e próxima ação recomendada

### Última entrega (06/11/2026)
- PR #136: Correção do mapeamento faixa→canal no sortimento.
- PR #137: Quantidade em caixas (Cx) nas notas recebidas.
- Ambos mergeados e deployed com sucesso.

### Próxima ação recomendada
1. **Imediato:** Resolver segurança (P-01 e P-02).
2. **Em seguida:** Limpar deploy.yml (P-03), fechar PR #142 (P-04), atualizar PROTOCOLO.md (P-05).
3. **Depois:** Padronização visual (P-07).

---

## 19. Como atualizar este documento

Este documento é atualizado pelo bot que concluir uma entrega significativa:

1. Atualize a data no topo.
2. Mova pendências concluídas para a seção 14 (decisões confirmadas) ou remova se irrelevante.
3. Adicione novas pendências à seção 17.
4. Atualize a seção 18 com a última entrega.
5. Marque claramente: "Confirmado no código", "Confirmado na configuração", "Definido por regra", "Ainda não comprovado" ou "Depende de decisão do Luis".
6. Não adicione informação aspiracional como se fosse fato. Se algo é planejado mas não implementado, diga explicitamente.
7. Commit no mesmo branch da entrega, com mensagem: `docs: atualizar HANDOFF.md — <o que mudou>`.
