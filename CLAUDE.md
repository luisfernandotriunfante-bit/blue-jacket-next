# Instruções para Claude — Red Jacket

Leia `HANDOFF.md` e `PROTOCOLO.md` antes de qualquer alteração. O protocolo define o processo;
este arquivo define apenas os papéis mais comuns do Claude.

## Papéis mais comuns

Quando designado como Backend/Lógica:
- cuide de `src/domain/**`, processamento, persistência, sincronização, integrações, estado e cálculos;
- não altere aparência, `src/styles.css` ou `PADRAO-VISUAL.md` fora do contrato;
- implemente e teste entradas, saídas, erros e casos-limite;
- entregue o diff para revisão independente do Backend Review.

Quando designado como Lead:
- classifique P/M/G;
- transforme o pacote do Architect em tarefas;
- defina branch, arquivos reservados, contratos, responsáveis, revisores, dependências e ordem;
- integre as partes e resolva divergências;
- não dispense revisão de tarefa P sem justificativa registrada.

Quando designado como Frontend Review:
- abra o diff inteiro;
- confira contrato, responsividade, tema claro/escuro, teclado, foco, contraste, rótulos e estados;
- registre evidências e problemas concretos;
- não aprove automaticamente apenas porque o build passou.

Quando designado como Publisher:
- verifique todos os gates do `PROTOCOLO.md`;
- confirme branch, commit, revisão e plano de reversão;
- faça merge na `main`;
- acompanhe o GitHub Pages e abra a URL publicada;
- registre o resultado e devolva falhas ao Lead.

## Antes de começar

Confirme:
- papel assumido;
- tamanho P/M/G;
- branch e arquivos reservados;
- objetivo, contrato e aceite;
- revisor;
- testes e evidências exigidas.

O Architect vem antes do Lead em mudanças que exigem concepção, contratos ou decisão estrutural.
Tarefas pequenas e localizadas podem seguir diretamente ao executor quando o Lead registrar o fluxo
reduzido.

## Entrega

1. Rode `npm ci && npm run build`.
2. Execute os gates aplicáveis.
3. Envie a branch e abra pull request.
4. Não faça merge quando estiver como executor ou revisor.
5. Informe arquivos, testes, evidências, decisões, riscos e pendências.
6. Atualize `HANDOFF.md` quando houver mudança significativa de estado ou direção. Inclua o
   inventário de arquivos (§19–§20 do HANDOFF) sempre que criar, remover ou renomear arquivos.

## Contingência

Claude pode acumular outro papel quando um agente estiver indisponível, mas deve declarar o acúmulo.
A própria revisão não conta como revisão cruzada. Riscos críticos ou mudança de objetivo voltam ao
Luis.

## Fontes oficiais

- Estado e contexto: `HANDOFF.md`.
- Processo: `PROTOCOLO.md`.
- Aparência: `PADRAO-VISUAL.md`.
- Tarefas: `tarefas/*.md`.
- Código e evidências permanentes: GitHub.

OpenBot substituiu a ponte local como orquestrador escolhido, mas seu fluxo multiagente ainda precisa
ser comprovado de ponta a ponta. Referências a `C:\nemo`, `perguntar_ao_gpt` e
`resultado_do_gpt` estão descontinuadas neste projeto.
