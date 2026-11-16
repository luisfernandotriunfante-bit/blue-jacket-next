# Protocolo oficial de trabalho — Red Jacket (v8)

Este arquivo é a fonte oficial das regras operacionais do projeto. Vale para qualquer pessoa ou IA.
Antes de trabalhar, leia nesta ordem: `HANDOFF.md`, este protocolo e, conforme o papel,
`AGENTS.md` ou `CLAUDE.md`. Trabalho visual também exige `PADRAO-VISUAL.md`.

Em caso de conflito:
1. este protocolo manda no processo;
2. `PADRAO-VISUAL.md` manda na aparência;
3. `HANDOFF.md` descreve o estado factual e as pendências;
4. `AGENTS.md` e `CLAUDE.md` só complementam o papel de cada executor.

## 1. Estado do fluxo

O fluxo abaixo foi definido pelo Luis. Branches, pull requests, build e deploy pela `main` estão
comprovados. A orquestração completa, memória compartilhada e revisão entre múltiplos bots pelo
OpenBot ainda precisam ser comprovadas em uma execução de ponta a ponta.

`Luis → Architect → Lead → equipes/revisões → Lead → Architect → Publisher`

Os papéis são funções, não marcas de modelo. O modelo escolhido no OpenBot pode mudar sem alterar
este arquivo; deve ser registrado na configuração do bot.

## 2. Papéis

- **Luis:** define produto, prioridade e decisões que mudam objetivo, risco ou escopo.
- **Architect:** transforma a ideia em solução, consulta o sistema atual, define limites, contratos,
  dependências, riscos, aceite e sequência. No final, confere conformidade quando houver mudança
  arquitetural. Não substitui revisão de código.
- **Lead:** classifica o tamanho, divide o trabalho, reserva arquivos, coordena dependências, recebe
  revisões, integra as partes e resolve divergências técnicas.
- **Backend/Lógica:** cuida de `src/domain/**`, processamento, persistência, sincronização, dados,
  integrações, estado e cálculos.
- **Frontend/Visual:** cuida de `src/styles.css`, marcação e classes dos componentes, layout,
  responsividade, acessibilidade, validação no navegador e `PADRAO-VISUAL.md`.
- **Backend Review:** revisa independentemente lógica produzida pelo backend, preferencialmente com
  uma família de modelo diferente.
- **Frontend Review:** revisa independentemente interface produzida pelo frontend, preferencialmente
  com uma família de modelo diferente.
- **Publisher:** comprova os gates, faz merge na `main`, acompanha o deploy e registra o resultado.

Uma mesma IA pode acumular papéis somente quando outro agente estiver indisponível. O acúmulo deve
ser declarado na entrega, com os riscos e as verificações compensatórias.

## 3. Classificação e fluxo

- **P — pequena:** correção localizada, documentação ou mudança de baixo risco. O Lead pode reduzir
  etapas, mas deve justificar qualquer dispensa de revisão cruzada.
- **M — média:** afeta um fluxo, uma tela ou um motor. Exige executor, revisão e gates aplicáveis.
- **G — grande:** envolve vários módulos, dados, arquitetura ou publicação sensível. Exige pacote do
  Architect, plano por etapas, revisões cruzadas e conferência arquitetural final.

Fluxo padrão:
1. Luis descreve objetivo, prioridade e restrições.
2. Architect entrega contexto, solução, contratos, riscos e aceite.
3. Lead cria tarefas, dependências, responsáveis, branch e arquivos reservados.
4. Executores implementam e testam a própria entrega.
5. Revisores cruzados leem o diff e registram aprovação ou problemas concretos.
6. Lead integra e resolve divergências.
7. Architect confere mudanças estruturais quando aplicável.
8. Publisher verifica gates, faz merge e acompanha a publicação.

## 4. Contrato de tarefa

Toda tarefa informa:
- objetivo e tamanho P/M/G;
- responsável e revisor;
- branch;
- arquivos reservados;
- entradas, saídas e comportamento esperado;
- estados de interface quando aplicável;
- critérios de aceite;
- testes e evidências exigidos;
- riscos, dependências e forma de reversão.

Tarefa mista não começa pela interface antes de o contrato de dados e ações estar definido.

## 5. Git e isolamento

1. Ninguém faz commit direto na `main`; ela é a branch de produção e dispara o deploy.
2. A proteção técnica da `main` deve ser verificada no GitHub; não presuma que está ativa.
3. Cada tarefa tem uma branch e um dono: `<agente>/<assunto>`.
4. A branch nasce da `main` atual e deve ser atualizada antes do merge.
5. O pedido reserva explicitamente os arquivos. Fora da lista, pare e peça liberação.
6. `src/domain/**` pertence ao backend durante tarefa ativa.
7. `src/styles.css` e `PADRAO-VISUAL.md` pertencem ao frontend durante tarefa visual.
8. Commits devem ser pequenos e explicar o motivo.
9. Quem implementa abre o pull request e informa arquivos, testes, evidências e pendências.
10. Somente o Publisher faz merge após os gates.

## 6. Revisão cruzada

- Quem produz não revisa a própria entrega. De preferência, o revisor usa uma família de modelo
  diferente do executor; quando isso não for possível, o acúmulo deve ser declarado.
- A regra essencial é independência: o revisor não pode apenas repetir a conclusão do executor.
- O revisor deve abrir o diff inteiro, conferir contratos, erros, regressões, segurança e testes.
- Aprovação deve citar o que foi verificado. “Aprovado” sem evidência não vale.
- Problemas são classificados como bloqueador, importante, melhoria ou observação.
- Divergência técnica volta ao Lead; mudança de objetivo volta ao Luis.
- Uma tarefa P pode dispensar revisão cruzada apenas com justificativa registrada pelo Lead.

## 7. Gates

Antes de integrar:
1. `npm ci && npm run build` passa.
2. O diff foi lido por inteiro.
3. Apenas arquivos reservados foram alterados.
4. Mudança de lógica não alterou aparência fora do contrato.
5. Mudança visual não alterou cálculo ou regra de negócio.
6. Interface foi conferida em tema claro/escuro, largura móvel, teclado, foco, contraste, rótulos,
   loading, vazio, erro e disabled quando aplicável.
7. Dados sensíveis, credenciais administrativas e informações comerciais não foram commitidos.
8. Documentação afetada, inclusive `HANDOFF.md` e seu inventário de arquivos (§19–§20), foi
   atualizada quando necessário.

Antes de publicar:
1. branch, commit e ambiente estão identificados;
2. build de produção passou;
3. revisão aplicável foi concluída;
4. existe forma de reversão;
5. após o deploy, o Publisher abre a URL e verifica carregamento e fluxo crítico.

Smoke test e rollback automáticos ainda não existem; não os declare como executados.

## 8. Comunicação e memória

- GitHub é a fonte oficial de código, documentação, decisões e evidências permanentes.
- OpenBot é o orquestrador escolhido, mas seu fluxo multiagente ainda precisa de validação prática.
- Configuração de bots, conversas e memória operacional ficam no OpenBot, não neste repositório,
  salvo documentação necessária para trabalhar no Red Jacket.
- `C:\nemo` e suas ferramentas de ponte estão descontinuados para este projeto.
- Uma conversa não substitui atualização no GitHub.
- Pedidos extensos podem ficar em `tarefas/AAAA-MM-DD-assunto.md`.

## 9. Contingência

Quando o agente preferencial estiver indisponível, outro bot pode assumir o papel se:
- declarar o papel assumido;
- respeitar os mesmos arquivos, gates e limites;
- registrar qualquer revisão que não pôde ser independente;
- não apresentar uma revisão própria como revisão cruzada;
- encaminhar riscos críticos ao Luis.

## 10. Segurança

- Nunca registre segredos, contas de serviço, chaves administrativas ou dados comerciais.
- Configuração pública de Firebase web não equivale automaticamente a uma senha; ainda assim,
  regras do Realtime Database/Storage e restrições de chave devem ser verificadas.
- `.env` e `arquivos/` estão ignorados na versão atual. O histórico Git ainda precisa ser avaliado.
- Reescrita de histórico, rotação de configuração e exclusão permanente exigem alvo e plano claros.

## 11. Entrega

A entrega ao Luis informa:
- objetivo e resultado;
- quem fez e quem revisou;
- arquivos alterados;
- testes e evidências;
- decisões e riscos;
- o que ficou pendente;
- link do pull request ou publicação.

O `HANDOFF.md` deve ser atualizado após mudança significativa de arquitetura, processo, segurança,
estado do produto ou próxima prioridade.
