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
| Abas ativas | 10 funcionais + 1 placeholder: App (admin), Clientes, Cadastro Cliente, Pirâmide, Carteira, Estoque, Sortimento, Sell Out, Gerencial, RCA Manager. Campanhas é placeholder (20 linhas). |
| Dados | Importados via planilhas Excel/XLS; persistidos em IndexedDB; sincronizados via Firebase Realtime Database |
| Testes automatizados | Nenhum. Único gate: `npm run build` (TypeScript + Vite). **Decisão do Luis: adicionar testes.** |
| PR #142 | Fechada sem merge em 16/11/2026. A documentação do Nemo não faz parte do Red Jacket. |
| Segurança | `.env` e `arquivos/` foram retirados da versão atual e adicionados ao `.gitignore`. O histórico ainda precisa ser avaliado; regras, restrições e configurações do Firebase precisam ser revisadas. |

---

## 3. Objetivos ativos

1. **Segurança e limpeza** (prioridade imediata):
   - **Concluído na versão atual:** retirar `.env` e `arquivos/` do rastreamento e limitar o deploy à `main`.
   - **Pendente:** revisar o histórico Git, decidir se deve ser reescrito e conferir regras/restrições do Firebase.
   - **Pendente:** substituir ou restringir qualquer configuração que o responsável pelo Firebase considere exposta.

2. **Padronização da execução e governança** (esta etapa):
   - Consolidar documentação para guiar agentes de IA via OpenBot.
   - Definir fluxo de trabalho coerente e executável.
   - **Concluído:** fechar a PR #142 sem merge.
   - **Concluído:** alinhar `PROTOCOLO.md`, `AGENTS.md` e `CLAUDE.md` ao fluxo funcional.

3. **Padronização visual** (próxima etapa):
   - Tarefa especificada em `tarefas/2026-11-14-padronizacao-visual.md`.
   - Status: aguardando o agente de frontend.

4. **Histórico de sortimento** (pendente):
   - Tracking de performance per-client, item por item, com variação ano/mês/trimestre.
   - Aguardando planilha do Luis.

---

## 4. Arquitetura real (confirmada no código)

```
React 19.2 + TypeScript 6.0 + Vite 8.3
│
├── src/
│   ├── App.tsx              — Shell principal, navegação por abas, uploads, admin
│   ├── *Tab.tsx (10 abas)   — Cada aba é um componente independente
│   ├── RcaManager.tsx       — Gestão de representantes
│   ├── styles.css           — Todo CSS do projeto (765 linhas)
│   ├── firebaseConfig.ts    — Inicialização Firebase
│   ├── msGeo.ts             — Dados geográficos SVG dos municípios de MS (mapa)
│   ├── vite-env.d.ts        — Declarações de tipo do Vite
│   ├── main.tsx             — Entry point React
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
├── index.html               — Entry point HTML (título: "Red Jacket")
├── package.json             — Dependências e scripts (name: "red-jacket")
├── package-lock.json        — Lock de versões
├── vite.config.ts           — Configuração do Vite (base: /blue-jacket-next/)
├── tsconfig.json            — Configuração raiz do TypeScript
└── tsconfig.app.json        — Configuração TS da aplicação
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
5. O trigger foi corrigido: somente a branch `main` dispara a publicação.

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

### Fluxo oficial definido pelo Luis — ainda precisa ser validado integralmente no OpenBot
```
Luis pede → Architect planeja → Lead distribui → bot designado implementa
→ PR para main → revisão cruzada → Lead integra → Architect confere quando necessário → Publisher faz merge
→ deploy automático via GitHub Pages
```

O uso de branches, pull requests e deploy está comprovado. A coordenação completa entre múltiplos bots pelo OpenBot e a memória compartilhada ainda não foram comprovadas em uma execução de ponta a ponta.

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

- `main` — branch de produção; publica o site a cada push. A regra operacional proíbe commits diretos, mas a proteção técnica do GitHub ainda precisa ser verificada.
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
| 2 | `PROTOCOLO.md` | Regras de trabalho entre IAs | **Ativo — v8 concluída em 16/11/2026** |
| 3 | `CLAUDE.md` | Instruções para Claude | **Ativo** |
| 4 | `AGENTS.md` | Instruções para GPT/Codex | **Ativo** |
| 5 | `PADRAO-VISUAL.md` | Design system | **Ativo** |
| 6 | `tarefas/*.md` | Tarefas ativas | **Ativo** |
| 7 | `revisao/pendente.md` | Trabalho pendente de revisão | **Ativo** (vazio) |
| 8 | `README.md` | Descrição do projeto | **Desatualizado, precisa reescrita** |

### Auditoria dos documentos

| Documento | Por que existe | Autoridade e recomendação |
|---|---|---|
| `HANDOFF.md` | Estado, arquitetura, decisões, riscos e passagem entre equipes | Fonte oficial do estado atual; atualizar após entregas significativas |
| `PROTOCOLO.md` | Processo de trabalho, branches, revisão e publicação | Fonte oficial das regras operacionais |
| `AGENTS.md` | Instruções específicas para GPT/Codex | Complementa o protocolo; não pode contradizê-lo |
| `CLAUDE.md` | Instruções específicas para Claude | Complementa o protocolo; não pode contradizê-lo |
| `PADRAO-VISUAL.md` | Design system e validação visual | Fonte oficial da aparência; mantido pelo frontend |
| `README.md` | Apresentação pública e início rápido | Manter, mas reescrever para refletir o produto atual |
| `tarefas/*.md` | Especificações de trabalhos concretos | Histórico/execução; cada arquivo deve declarar status |
| `revisao/pendente.md` | Exceções aguardando revisão | Manter enquanto houver modo de contingência; hoje vazio |
| `revisao/revisado.md` | Histórico das exceções revisadas | Manter como registro; hoje vazio |

Não há duplicação exata na documentação oficial. Há sobreposição necessária: o protocolo define regras gerais e `AGENTS.md`/`CLAUDE.md` traduzem apenas o papel de cada executor. Em conflito, vale `PROTOCOLO.md`; para aparência, vale `PADRAO-VISUAL.md`; para estado factual, vale este `HANDOFF.md`.

### Documentos que NÃO são oficiais
- `docs/nemo/*` (PR #142) — PR fechada sem merge. Os seis arquivos misturavam governança do orquestrador com o produto Red Jacket e não pertencem a este repositório.
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
1. **Configuração Firebase e histórico Git.** A configuração pública de um app web não equivale, por si só, a uma senha de servidor. Mesmo assim, regras do Realtime Database/Storage, restrições de chave e histórico do repositório precisam ser revisados. Nunca registrar chaves administrativas ou contas de serviço.
2. **Dados comerciais no histórico.** `arquivos/` saiu da versão atual, mas commits anteriores podem continuar contendo planilhas de clientes, vendas, preços e estoque. Avaliar limpeza do histórico e impactos antes de reescrevê-lo.

### Alto
3. **Sem testes automatizados.** Qualquer regressão só é detectada manualmente.
4. **Proteção técnica da `main` não comprovada.** A regra operacional existe, mas branch protection e revisões obrigatórias ainda precisam ser verificadas no GitHub.

### Médio
5. **Validação prática do protocolo v8 pendente.** O texto está atualizado, mas o fluxo multiagente completo no OpenBot ainda precisa ser comprovado de ponta a ponta.
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
| P-01 | Revisar regras/restrições do Firebase e decidir substituição de configurações | **Crítica** | Luis + responsável Firebase | Aguardando |
| P-02 | Avaliar e, se autorizado, limpar `.env` e `arquivos/` do histórico Git | **Crítica** | Especialista Git + Luis | Versão atual já limpa |
| P-03 | Verificar proteção técnica e revisões obrigatórias da `main` | **Alta** | Publisher | Aguardando |
| P-04 | PR #142 fechada sem merge | **Concluída** | GPT | Concluída em 16/11/2026 |
| P-05 | Atualizar PROTOCOLO.md para v8 | **Concluída** | GPT + revisão Claude | Concluída em 16/11/2026 — PR #144 |
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
1. **Imediato:** revisar Firebase e histórico Git (P-01 e P-02).
2. **Em seguida:** verificar a proteção técnica da `main` e executar o primeiro piloto multiagente no OpenBot.
3. **Depois:** executar a padronização visual (P-07).

---

## 19. Inventário completo de arquivos

Atualizado em 16/11/2026. Cada entrada informa: caminho relativo, propósito, linhas e data da
última mudança significativa.

### Documentação (raiz)

| Arquivo | Propósito | Linhas | Última mudança |
|---|---|---|---|
| `HANDOFF.md` | Estado, decisões, inventário, passagem entre equipes | ~460 | 16/11/2026 |
| `PROTOCOLO.md` | Regras operacionais de trabalho (v8) | 163 | 16/11/2026 |
| `CLAUDE.md` | Instruções para Claude por papel | 74 | 16/11/2026 |
| `AGENTS.md` | Instruções para GPT/Codex por papel | 60 | 16/11/2026 |
| `PADRAO-VISUAL.md` | Design system e tokens visuais | 136 | 14/11/2026 |
| `README.md` | Apresentação pública (desatualizado) | 16 | 01/11/2026 |

### Tarefas e revisão

| Arquivo | Propósito | Linhas | Última mudança |
|---|---|---|---|
| `tarefas/2026-11-14-padronizacao-visual.md` | Especificação da padronização visual | 60 | 14/11/2026 |
| `revisao/pendente.md` | Template para trabalho pendente de revisão | ~15 | Criação |
| `revisao/revisado.md` | Registro de revisões concluídas | ~7 | Criação |

### Configuração e build

| Arquivo | Propósito | Linhas | Última mudança |
|---|---|---|---|
| `package.json` | Dependências, scripts, nome do projeto | ~25 | 06/11/2026 |
| `package-lock.json` | Lock de versões | Auto | 06/11/2026 |
| `vite.config.ts` | Configuração Vite (base path: `/blue-jacket-next/`) | ~15 | 01/11/2026 |
| `tsconfig.json` | Configuração raiz TypeScript | ~5 | 01/11/2026 |
| `tsconfig.app.json` | Configuração TS da aplicação | ~15 | 01/11/2026 |
| `index.html` | Entry point HTML (título: "Red Jacket") | ~15 | 01/11/2026 |
| `.gitignore` | Ignora node_modules, dist, .env, arquivos/ | 7 | 16/11/2026 |
| `.github/workflows/deploy.yml` | Deploy automático: push to main → GitHub Pages | 38 | 16/11/2026 |

### Código-fonte — Componentes (`src/`)

| Arquivo | Propósito | Linhas | Última mudança |
|---|---|---|---|
| `src/App.tsx` | Shell principal, navegação, uploads, admin | 1056 | 06/11/2026 |
| `src/StockTab.tsx` | Estoque, notas recebidas, treemap, caixas | 1830 | 06/11/2026 |
| `src/CarteiraTab.tsx` | Gestão de carteira de clientes | 1516 | 01/11/2026 |
| `src/SortimentoTab.tsx` | Análise de sortimento por canal | 799 | 06/11/2026 |
| `src/CadastroClienteTab.tsx` | Cadastro e edição de clientes | 606 | 01/11/2026 |
| `src/SellOutTab.tsx` | Dashboard de sell-out (referência visual) | 594 | 01/11/2026 |
| `src/PiramideTab.tsx` | Análise de premissas/pirâmide | 543 | 01/11/2026 |
| `src/GerencialTab.tsx` | Dashboard financeiro/gerencial | 474 | 01/11/2026 |
| `src/ClientesTab.tsx` | Listagem de clientes | 352 | 01/11/2026 |
| `src/RcaManager.tsx` | Gestão de representantes comerciais | 341 | 01/11/2026 |
| `src/CampaignTab.tsx` | Placeholder — campanhas (sem funcionalidade) | 20 | 01/11/2026 |
| `src/styles.css` | Todo CSS do projeto | 765 | 01/11/2026 |
| `src/firebaseConfig.ts` | Inicialização Firebase (lê do `.env`) | 26 | 01/11/2026 |
| `src/main.tsx` | Entry point React (monta App no DOM) | 6 | 01/11/2026 |
| `src/msGeo.ts` | Dados SVG geográficos dos municípios de MS | ~5* | 01/11/2026 |
| `src/vite-env.d.ts` | Declarações de tipo do Vite | 1 | 01/11/2026 |

\* `msGeo.ts` tem 5 linhas de código mas ~227 KB de dados SVG inlined (paths de municípios).

### Código-fonte — Domínio (`src/domain/`)

| Arquivo | Propósito | Linhas | Última mudança |
|---|---|---|---|
| `src/domain/cloudSync.ts` | Sincronização Firebase Realtime DB | 228 | 06/11/2026 |
| `src/domain/productMotor.ts` | Processa planilhas de produtos + sortimento | 207 | 06/11/2026 |
| `src/domain/clientMotor.ts` | Processa planilhas de clientes | 160 | 01/11/2026 |
| `src/domain/historyMotor.ts` | Processa histórico de vendas | 158 | 01/11/2026 |
| `src/domain/movementMotor.ts` | Processa movimentações de estoque | 119 | 01/11/2026 |
| `src/domain/syncEngine.ts` | Coordenação de sync | 93 | 01/11/2026 |
| `src/domain/receiptMotor.ts` | Processa notas fiscais | 85 | 01/11/2026 |
| `src/domain/competenciaEngine.ts` | Motor de competência por período | 85 | 01/11/2026 |
| `src/domain/persistence.ts` | Persistência IndexedDB | 82 | 01/11/2026 |
| `src/domain/productGrouping.ts` | Agrupamento de produtos | 72 | 01/11/2026 |
| `src/domain/fileDetector.ts` | Detecção de tipo de arquivo pelo cabeçalho | 67 | 01/11/2026 |
| `src/domain/audit.ts` | Tipos e utilidades de auditoria | 37 | 01/11/2026 |
| `src/domain/types.ts` | Tipos compartilhados do domínio | 20 | 01/11/2026 |

**Totais:** 12 componentes TSX (8928 linhas) · 13 módulos de domínio (1413 linhas) ·
1 CSS (765 linhas) · 3 utilitários TS (33 linhas) · Total src: ~11139 linhas.

---

## 20. Regra permanente — Inventário de arquivos

**Vigência:** a partir de 16/11/2026. Aplica-se a qualquer bot ou pessoa.

1. **Arquivo novo** → inventário (§19) atualizado no mesmo commit ou PR.
2. **Arquivo removido** → entrada removida do inventário no mesmo commit ou PR.
3. **Arquivo renomeado** → caminho atualizado no inventário.
4. **Mudança significativa de propósito** → descrição atualizada.
5. **Contagem de linhas** → atualizada quando a variação for ≥ 20% em relação ao registrado.
6. **Formato de cada entrada:** caminho relativo, propósito em uma frase, linhas, data da última
   mudança significativa.
7. **Agrupamento:** Documentação, Tarefas/Revisão, Configuração/Build, Componentes (`src/`),
   Domínio (`src/domain/`).
8. **Vale para qualquer bot.** Nenhum modelo de IA está isento.
9. **PR bloqueada se inventário desatualizado.** Revisor deve rejeitar PR que adicione, remova
   ou renomeie arquivo sem atualizar o inventário.
10. **Revisores verificam inventário.** Checklist de revisão inclui: "Inventário do HANDOFF.md
    está atualizado?".

---

## 21. Como atualizar este documento

Este documento é atualizado pelo bot que concluir uma entrega significativa:

1. Atualize a data no topo.
2. Mova pendências concluídas para a seção 14 (decisões confirmadas) ou remova se irrelevante.
3. Adicione novas pendências à seção 17.
4. Atualize a seção 18 com a última entrega.
5. Atualize o inventário (§19) conforme a regra permanente (§20).
6. Marque claramente: "Confirmado no código", "Confirmado na configuração", "Definido por regra", "Ainda não comprovado" ou "Depende de decisão do Luis".
7. Não adicione informação aspiracional como se fosse fato. Se algo é planejado mas não implementado, diga explicitamente.
8. Commit no mesmo branch da entrega, com mensagem: `docs: atualizar HANDOFF.md — <o que mudou>`.
