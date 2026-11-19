# Red Jacket — Documento de Contexto

Documento de referência para qualquer agente que trabalhe neste projeto.

---

## 1. O que é o Red Jacket

Painel comercial web para um profissional de vendas. O usuário importa planilhas Excel
(clientes, produtos, estoque, vendas, notas fiscais) e o sistema processa, cruza e apresenta
os dados em dashboards interativos.

O objetivo é ter uma ferramenta completa de análise comercial que funcione no navegador,
sem instalação, acessível de qualquer dispositivo, com sincronização automática entre eles.

### O que já funciona

- Importação inteligente de planilhas (detecta o tipo pelo cabeçalho, não pelo nome do arquivo)
- Dashboard de sell-out com KPIs e gráficos
- Análise de carteira de clientes com detalhamento
- Controle de estoque com treemap e quantidade em caixas
- Análise de sortimento por canal com semáforo de cobertura
- Pirâmide de clientes e premissas
- Dashboard financeiro/gerencial
- Cadastro e edição de clientes
- Gestão de RCAs (representantes comerciais)
- Sincronização entre dispositivos via Firebase
- Temas claro e escuro

### O que queremos construir ainda

- Módulo de campanhas (placeholder existe, sem funcionalidade)
- Padronização visual completa (a aba Sell Out é a referência de qualidade)
- Melhorias de responsividade
- Testes automatizados

---

## 2. Stack e arquitetura

- **React 19.2 + TypeScript 6.0 + Vite 8.3** — SPA pura, sem servidor backend
- **Deploy:** GitHub Pages, automático no push para `main`
- **Persistência local:** IndexedDB (via `persistence.ts`)
- **Sincronização:** Firebase Realtime Database (via `cloudSync.ts` e `syncEngine.ts`)
- **Credenciais:** GitHub Secrets injetados no build (nunca no código)
- **CSS:** Tudo em um único arquivo `src/styles.css` — sem CSS modules, sem styled-components
- **Repo:** `luisfernandotriunfante-bit/blue-jacket-next` (público)
- **URL:** https://luisfernandotriunfante-bit.github.io/blue-jacket-next/

### Fluxo de dados

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

Não há servidor backend. Firebase é usado apenas para sync entre dispositivos do mesmo usuário.

---

## 3. Padrão visual

A **aba Sell Out > Dashboard** é a referência visual do projeto. Todo novo componente deve
seguir esse padrão.

### Tipografia

- **Manrope** — texto geral, labels, descrições
- **Space Grotesk** — números, valores, títulos de seção

### Cores e temas

- O site funciona em tema **claro e escuro**. Todo componente deve funcionar em ambos.
- Semáforo de indicadores: **azul** = bom, **âmbar** = médio, **vermelho** = ruim
- As variáveis de cor estão definidas em `src/styles.css`

### Regras de CSS

- **Todo CSS fica em `src/styles.css`** — nenhum outro arquivo de estilo
- CSS inline só para valores dinâmicos calculados em runtime (ex: `width: ${percent}%`)
- Classes semânticas, não utilitárias

---

## 4. Mapa de arquivos

### Componentes (src/*.tsx) — a interface

| Arquivo | Linhas | O que faz |
|---|---|---|
| `App.tsx` | 1056 | Shell principal: navegação por abas, uploads, configurações, admin |
| `StockTab.tsx` | 1830 | Estoque: notas recebidas, treemap de posições, quantidade em caixas |
| `CarteiraTab.tsx` | 1516 | Carteira de clientes: visão geral, detalhamento, análise |
| `SortimentoTab.tsx` | 799 | Sortimento: análise por canal, semáforo, cobertura |
| `CadastroClienteTab.tsx` | 606 | Cadastro e edição de clientes |
| `SellOutTab.tsx` | 594 | Dashboard de sell-out — **referência visual** do projeto |
| `PiramideTab.tsx` | 543 | Análise de premissas e pirâmide de clientes |
| `GerencialTab.tsx` | 474 | Dashboard financeiro/gerencial |
| `ClientesTab.tsx` | 352 | Listagem e filtros de clientes |
| `RcaManager.tsx` | 341 | Gestão de representantes comerciais (RCAs) |
| `CampaignTab.tsx` | 20 | **Placeholder** — campanhas, ainda sem funcionalidade |

### Domínio (src/domain/*.ts) — processamento de dados

| Arquivo | Linhas | O que faz |
|---|---|---|
| `cloudSync.ts` | 228 | Sincronização com Firebase Realtime Database |
| `productMotor.ts` | 207 | Processa planilhas de produtos e sortimento |
| `clientMotor.ts` | 160 | Processa planilhas de clientes (cadastro, carteira, pirâmide) |
| `historyMotor.ts` | 158 | Processa histórico de vendas |
| `movementMotor.ts` | 119 | Processa movimentações de estoque |
| `syncEngine.ts` | 93 | Coordena a sync entre IndexedDB e Firebase |
| `receiptMotor.ts` | 85 | Processa notas fiscais (entrada de mercadoria) |
| `competenciaEngine.ts` | 85 | Motor de competência por período |
| `persistence.ts` | 82 | Persistência em IndexedDB (armazenamento local) |
| `productGrouping.ts` | 72 | Agrupamento e categorização de produtos |
| `fileDetector.ts` | 67 | Detecta tipo de planilha pelo cabeçalho |
| `audit.ts` | 37 | Tipos e utilidades de auditoria |
| `types.ts` | 20 | Tipos TypeScript compartilhados |

### Outros arquivos

| Arquivo | O que faz |
|---|---|
| `src/styles.css` (765 linhas) | **Todo** o CSS do projeto |
| `src/firebaseConfig.ts` (26 linhas) | Inicialização Firebase — lê `VITE_FB_*` do ambiente |
| `src/main.tsx` (6 linhas) | Entry point React |
| `src/msGeo.ts` (~227KB) | Dados SVG dos municípios de MS (mapa geográfico) |
| `.github/workflows/deploy.yml` | Deploy automático no GitHub Pages |
| `.env.example` | Template de variáveis de ambiente (sem valores reais) |

---

## 5. Regras de trabalho

### Git

1. **Nunca** commit direto na `main`
2. Cada tarefa = uma branch própria
3. Build obrigatório antes de mergear: `npm ci && npm run build`
4. PR para main, descrever o que mudou
5. Merge só depois de confirmar que build passou

### Segurança

- `.env` não está no git — credenciais ficam nos GitHub Secrets
- `arquivos/` (dados comerciais) também está no `.gitignore`
- Nunca commitar credenciais ou dados reais de clientes

### O que NÃO pode acontecer

- Merge sem build passando
- Dois bots editando o mesmo arquivo ao mesmo tempo
- Commitar .env ou dados comerciais
- Alterar `deploy.yml` ou `firebaseConfig.ts` sem necessidade clara

---

## 6. Organização dos bots

O trabalho é dividido entre bots especializados, coordenados por um **Architect** (delegador).

### Architect (delegador)

Recebe os pedidos, classifica e encaminha para o bot certo. Não implementa nada.
Classifica como: **frontend** (visual), **backend** (lógica/dados), ou **misto** (os dois).
Em tarefas mistas, backend implementa primeiro, frontend depois.

### Bot de backend (lógica e dados)

Trabalha em: `src/domain/**`, lógica de negócio nos `.tsx`, persistência, sincronização.
Não mexe em CSS ou aparência.

### Bot de frontend (visual e CSS)

Trabalha em: `src/styles.css`, layout e classes dos `.tsx`, responsividade, temas.
Não mexe em motores de dados ou cálculos.

### Divisão de território

| Área | Responsável | Arquivos |
|---|---|---|
| Lógica e dados | Bot backend | `src/domain/**`, lógica nos `.tsx` |
| Visual e CSS | Bot frontend | `src/styles.css`, layout/classes nos `.tsx` |
| Shell principal | Coordenação | `App.tsx` (com cuidado, ambos podem precisar) |
