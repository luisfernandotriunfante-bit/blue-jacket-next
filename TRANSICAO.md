# Transição para OpenBot — Red Jacket

Documento para configurar os bots no OpenBot. Atualizado em 19/11/2026.

---

## 1. O que é o Red Jacket

Painel comercial web (SPA) usado por um profissional de vendas para analisar clientes, produtos,
estoque, sortimento, sell-out e dados financeiros. O usuário importa planilhas Excel e o sistema
processa, cruza e apresenta os dados.

- **Stack:** React 19.2 + TypeScript 6.0 + Vite 8.3
- **Deploy:** GitHub Pages, automático no push para `main`
- **Dados:** Planilhas Excel → motores de processamento → IndexedDB (local) + Firebase Realtime DB (sync)
- **Repo:** `luisfernandotriunfante-bit/blue-jacket-next` (público)
- **URL:** https://luisfernandotriunfante-bit.github.io/blue-jacket-next/

---

## 2. Arquitetura do bot delegador (Architect)

### Por que um delegador?

O Luis manda um pedido → o Architect analisa rapidamente → encaminha para o bot certo com
instruções precisas. Isso funciona bem porque:

- Cada bot tem contexto especializado (menos tokens gastos)
- Erros ficam isolados (um bot não quebra o trabalho do outro)
- O Luis não precisa saber qual bot usar para cada tarefa

### Como o Architect deve funcionar

O Architect é **leve**. Ele não implementa nada. Ele faz 4 coisas:

1. **Classifica** o pedido: é frontend (visual), backend (lógica/dados), ou misto?
2. **Encaminha** com instruções curtas e claras ao bot certo
3. **Cobra** a entrega: build passou? Arquivos certos? PR aberta?
4. **Integra** quando necessário: se uma tarefa mista precisa dos dois bots

### Regra de ouro

> Se o Architect gastar mais de 2 mensagens antes de delegar, ele está pensando demais.
> O trabalho pesado é dos executores.

---

## 3. Configuração dos bots

### Bot 1: Architect (delegador)

**Modelo sugerido:** o mais barato disponível (GPT-4o-mini ou Haiku)
**Função:** receber pedidos do Luis, classificar e delegar

**Prompt de sistema:**
```
Você é o Architect do projeto Red Jacket. Seu trabalho é receber pedidos do Luis e delegar
para o bot certo. Nunca implemente nada — apenas delegue.

Regras:
1. Classifique o pedido: FRONTEND (visual, CSS, layout), BACKEND (dados, cálculos, domínio),
   ou MISTO (precisa dos dois).
2. Delegue com: objetivo, arquivos permitidos, critério de aceite.
3. Se for MISTO: backend implementa primeiro, frontend depois. Defina o contrato (dados de
   entrada/saída) antes de começar.
4. Cobre: build passou? PR aberta? Arquivos certos?
5. Nunca altere código. Nunca faça merge. Apenas coordene.

Arquivos do backend: src/domain/**, qualquer .tsx que não seja visual
Arquivos do frontend: src/styles.css, layout/CSS dos .tsx, visual e acessibilidade

Build obrigatório: npm ci && npm run build
Branch: cada tarefa tem uma branch própria, ex: claude/nome-da-tarefa ou gpt/nome-da-tarefa
Merge: só na main, só depois de build passar e revisão
```

### Bot 2: Claude (backend / lógica)

**Modelo:** Claude (via créditos existentes)
**Função:** implementação de lógica, dados, processamento, domínio

**Prompt de sistema:**
```
Você é o executor de backend/lógica do Red Jacket — um painel comercial React+TypeScript+Vite
publicado no GitHub Pages.

Seu escopo:
- src/domain/** (motores de processamento de dados)
- Lógica de negócio nos componentes .tsx
- Persistência (IndexedDB via persistence.ts)
- Sincronização (Firebase via cloudSync.ts e syncEngine.ts)
- Hooks, estado, cálculos

Proibido:
- Alterar src/styles.css
- Mudar aparência (cores, fontes, layout, espaçamento)
- Fazer merge na main

Entrega:
1. Crie branch: claude/<nome-da-tarefa>
2. Implemente
3. Rode: npm ci && npm run build (deve passar sem erro)
4. Abra PR para main
5. Informe: arquivos alterados, o que fez, o que testou

Sempre responda em português.
```

### Bot 3: ChatGPT (frontend / visual)

**Modelo:** GPT-4o ou o disponível no OpenBot
**Função:** implementação visual, CSS, layout, acessibilidade

**Prompt de sistema:**
```
Você é o executor de frontend/visual do Red Jacket — um painel comercial React+TypeScript+Vite
publicado no GitHub Pages.

Seu escopo:
- src/styles.css (todo CSS do projeto)
- Marcação JSX, classes e layout dos componentes .tsx
- Responsividade, tema claro/escuro, acessibilidade
- Validação visual no navegador

Proibido:
- Alterar src/domain/** (motores de dados)
- Mudar cálculos, lógica de negócio, textos de dados
- Fazer merge na main

Design:
- Referência visual: aba Sell Out > Dashboard
- Fontes: Manrope (texto), Space Grotesk (números/títulos)
- Temas: claro e escuro, todo componente funciona em ambos
- Semáforo: bom = azul, médio = âmbar, ruim = vermelho
- Todo CSS em src/styles.css. Inline só para valores dinâmicos (calculados)

Entrega:
1. Crie branch: gpt/<nome-da-tarefa>
2. Implemente
3. Rode: npm ci && npm run build (deve passar sem erro)
4. Abra PR para main
5. Informe: arquivos alterados, o que fez, screenshots se possível

Sempre responda em português.
```

---

## 4. Mapa completo de arquivos

### O que cada arquivo faz e por que está ali

#### Componentes (src/*.tsx) — a interface

| Arquivo | Linhas | Função | Quem mexe |
|---|---|---|---|
| `App.tsx` | 1056 | Shell principal: navegação por abas, uploads de planilhas, configurações, admin | Ambos |
| `StockTab.tsx` | 1830 | Estoque: notas recebidas, treemap de posições, quantidade em caixas | Ambos |
| `CarteiraTab.tsx` | 1516 | Carteira de clientes: visão geral, detalhamento, análise | Ambos |
| `SortimentoTab.tsx` | 799 | Sortimento: análise por canal, semáforo, cobertura | Ambos |
| `CadastroClienteTab.tsx` | 606 | Cadastro e edição de clientes | Ambos |
| `SellOutTab.tsx` | 594 | Dashboard de sell-out — **referência visual** do projeto | Frontend |
| `PiramideTab.tsx` | 543 | Análise de premissas e pirâmide de clientes | Ambos |
| `GerencialTab.tsx` | 474 | Dashboard financeiro/gerencial | Ambos |
| `ClientesTab.tsx` | 352 | Listagem e filtros de clientes | Ambos |
| `RcaManager.tsx` | 341 | Gestão de representantes comerciais (RCAs) | Backend |
| `CampaignTab.tsx` | 20 | **Placeholder** — campanhas, sem funcionalidade ainda | — |

#### Domínio (src/domain/*.ts) — o cérebro

| Arquivo | Linhas | Função | Crítico? |
|---|---|---|---|
| `cloudSync.ts` | 228 | Sincronização com Firebase Realtime Database | **Sim** — sync entre dispositivos |
| `productMotor.ts` | 207 | Processa planilhas de produtos e sortimento | Sim |
| `clientMotor.ts` | 160 | Processa planilhas de clientes (cadastro, carteira, pirâmide) | Sim |
| `historyMotor.ts` | 158 | Processa histórico de vendas | Sim |
| `movementMotor.ts` | 119 | Processa movimentações de estoque | Sim |
| `syncEngine.ts` | 93 | Coordena a sync entre IndexedDB e Firebase | **Sim** |
| `receiptMotor.ts` | 85 | Processa notas fiscais (entrada de mercadoria) | Sim |
| `competenciaEngine.ts` | 85 | Motor de competência por período | Sim |
| `persistence.ts` | 82 | Persistência em IndexedDB (armazenamento local) | **Sim** |
| `productGrouping.ts` | 72 | Agrupamento e categorização de produtos | Sim |
| `fileDetector.ts` | 67 | Detecta tipo de planilha pelo cabeçalho (não pelo nome) | Sim |
| `audit.ts` | 37 | Tipos e utilidades de auditoria | Não |
| `types.ts` | 20 | Tipos TypeScript compartilhados | Não |

#### Outros arquivos src/

| Arquivo | Função |
|---|---|
| `styles.css` (765 linhas) | **Todo** o CSS do projeto. Nenhum CSS em outro lugar. |
| `firebaseConfig.ts` (26 linhas) | Inicialização Firebase — lê variáveis `VITE_FB_*` do ambiente |
| `main.tsx` (6 linhas) | Entry point React — monta App no DOM |
| `msGeo.ts` (~227KB) | Dados SVG dos municípios de MS (mapa geográfico) |
| `vite-env.d.ts` (1 linha) | Declaração de tipos Vite |

#### Configuração (raiz)

| Arquivo | Função | Pode mexer? |
|---|---|---|
| `package.json` | Dependências e scripts | Com cuidado |
| `package-lock.json` | Lock de versões | Auto (npm ci) |
| `vite.config.ts` | Config Vite (base: `/blue-jacket-next/`) | Raramente |
| `tsconfig.json` + `tsconfig.app.json` | Config TypeScript | Raramente |
| `index.html` | Entry point HTML (título: "Red Jacket") | Raramente |
| `.gitignore` | Ignora node_modules, dist, .env, arquivos/ | Com cuidado |
| `.github/workflows/deploy.yml` | Deploy automático no GitHub Pages | Com cuidado |
| `.env.example` | Template de variáveis (sem valores reais) | Referência |
| `README.md` | Descrição do projeto | Livre |

---

## 5. Fluxo de dados

```
Usuário importa planilha Excel
        ↓
  fileDetector.ts identifica tipo pelo cabeçalho
        ↓
  Motor correto processa (clientMotor, productMotor, etc.)
        ↓
  Dados salvos no IndexedDB (persistence.ts)
        ↓
  cloudSync.ts envia para Firebase Realtime Database
        ↓
  Componentes .tsx leem do IndexedDB e renderizam
        ↓
  Outro dispositivo abre o site → cloudSync.ts baixa do Firebase → IndexedDB
```

**Importante:** Não há servidor backend. É tudo no browser. Firebase é usado apenas para sync
entre dispositivos do mesmo usuário.

---

## 6. Regras de trabalho

### Git

1. **Nunca** commit direto na `main`
2. Cada tarefa = uma branch: `claude/<assunto>` ou `gpt/<assunto>`
3. Build obrigatório antes de mergear: `npm ci && npm run build`
4. PR para main, descrever o que mudou
5. Merge só depois de confirmar que build passou

### Divisão de território

| Área | Dono | Arquivos |
|---|---|---|
| Lógica e dados | Claude (backend) | `src/domain/**`, lógica nos `.tsx` |
| Visual e CSS | ChatGPT (frontend) | `src/styles.css`, layout/classes nos `.tsx` |
| Ambos | Coordenação do Architect | `App.tsx` (com cuidado) |

### O que NÃO pode acontecer

- Backend alterar CSS ou aparência
- Frontend alterar motores de dados ou cálculos
- Qualquer bot fazer merge sem build passando
- Dois bots editando o mesmo arquivo ao mesmo tempo

---

## 7. Análise de segurança

### Problema crítico: `.env` no repositório público

**Situação anterior:** O arquivo `.env` com credenciais Firebase estava commitado no repo público.
Qualquer pessoa podia ver as chaves.

**Correção aplicada nesta PR:**
1. `.env` removido do git (continua existindo localmente para desenvolvimento)
2. `.gitignore` atualizado para ignorar `.env` e `arquivos/`
3. `deploy.yml` atualizado para usar **GitHub Secrets** no build
4. Deploy trigger limitado à `main` (removida a branch de trabalho)

**Ação necessária do Luis:**
Configurar os secrets no GitHub:
1. Acesse: https://github.com/luisfernandotriunfante-bit/blue-jacket-next/settings/secrets/actions
2. Clique "New repository secret" para cada um:

| Nome do secret | Valor (copie do seu .env local) |
|---|---|
| `VITE_FB_API_KEY` | (seu valor) |
| `VITE_FB_AUTH_DOMAIN` | (seu valor) |
| `VITE_FB_DATABASE_URL` | (seu valor) |
| `VITE_FB_PROJECT_ID` | (seu valor) |
| `VITE_FB_STORAGE_BUCKET` | (seu valor) |
| `VITE_FB_MESSAGING_SENDER_ID` | (seu valor) |
| `VITE_FB_APP_ID` | (seu valor) |

### Sobre as chaves Firebase

A configuração pública de um app Firebase web (API key, project ID, etc.) **não é equivalente a
uma senha de servidor**. Essas chaves ficam visíveis no JavaScript do site publicado de qualquer
forma. A proteção real vem das **regras de segurança** do Firebase (Realtime Database Rules e
Storage Rules).

**Mesmo assim**, manter o `.env` fora do git é boa prática porque:
- Evita que bots commitam credenciais acidentalmente
- Separa configuração de código
- Permite trocar credenciais sem alterar código

### Recomendações adicionais

| Prioridade | Ação | Status |
|---|---|---|
| **Alta** | Configurar GitHub Secrets (ver acima) | **Luis precisa fazer** |
| **Alta** | Verificar regras do Firebase Realtime Database | **Luis precisa fazer** |
| **Média** | Considerar tornar o repositório privado | Decisão do Luis |
| **Média** | Rotacionar as chaves Firebase (já estiveram expostas) | Decisão do Luis |
| **Baixa** | Limpar histórico Git (chaves nos commits antigos) | Complexo, pode esperar |

---

## 8. Checklist de transição

### Luis precisa fazer (uma vez):

- [ ] Configurar os 7 GitHub Secrets (seção 7)
- [ ] Testar o deploy após configurar os secrets
- [ ] Configurar os 3 bots no OpenBot (seção 3)
- [ ] Verificar regras do Firebase

### Já feito nesta PR:

- [x] `.env` removido do git
- [x] `.gitignore` atualizado
- [x] `deploy.yml` usando GitHub Secrets
- [x] Deploy limitado à `main`
- [x] Documento de transição criado

### Depois da transição:

- [ ] Primeira tarefa via OpenBot (teste completo do fluxo)
- [ ] Padronização visual (tarefa para o bot frontend)
- [ ] Adicionar testes automatizados
