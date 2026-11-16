# Nemo — registro de decisões

Este arquivo registra apenas decisões duradouras. Não é lista de tarefas nem histórico de conversa.

## D-001 — GitHub como fonte oficial
- **Status:** aceita
- **Decisão:** código e documentação do produto têm uma única versão oficial no GitHub; a pasta local guarda ponte e governança.
- **Motivo:** impedir cópias divergentes.

## D-002 — Hierarquia de agentes
- **Status:** aceita
- **Decisão:** Luis → Architect → Lead → equipes/revisões → Lead → Architect → Publisher.
- **Motivo:** separar concepção, coordenação, execução, conformidade e publicação.

## D-003 — Revisão cruzada
- **Status:** aceita
- **Decisão:** GPT revisa backend produzido por Claude; Claude revisa frontend produzido por GPT. O Lead pode dispensar apenas tarefa P, com justificativa.
- **Motivo:** reduzir pontos cegos sem criar burocracia para mudanças triviais.

## D-004 — Publicação automática com reversão
- **Status:** aceita
- **Decisão:** o Publisher pode publicar sem aprovação manual após comprovar os gates; smoke test falho causa reversão e retorno ao Lead.
- **Motivo:** autonomia com proteção operacional.

## Modelo para nova decisão
```text
## D-NNN — Título
- Status: proposta | aceita | substituída
- Contexto:
- Decisão:
- Consequências:
- Substitui:
```

