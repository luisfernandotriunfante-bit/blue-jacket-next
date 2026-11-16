# Nemo — protocolo oficial de colaboração (v6)

Este é o único documento de governança. Ele substitui o protocolo v5 e qualquer rascunho anterior.

## 1. Hierarquia
`Luis → Nemo Architect → Nemo Lead → equipes → Nemo Lead → Nemo Architect → Nemo Publisher`

- Luis define intenção, prioridades e limites de negócio.
- Architect transforma a ideia em solução, contratos, mapas, riscos e critérios.
- Lead classifica, divide, coordena, integra e resolve divergências técnicas.
- Equipes implementam e fazem revisão cruzada dentro do processo.
- Architect confirma aderência estrutural após a integração.
- Publisher comprova os gates e publica.

## 2. Bots oficiais
| Bot | Modelo | Esforço | Palavra final |
|---|---|---:|---|
| Nemo Architect | GPT-6-Astra | muito alto na concepção; alto na conformidade | arquitetura e coerência sistêmica |
| Nemo Lead | Claude Sonnet 5.5 | alto | planejamento, coordenação e integração |
| Nemo Backend | Claude Sonnet 5.5 | alto | implementação de lógica, dados e serviços |
| Nemo Backend Review | GPT-6.1 Terra | alto | revisão cruzada do backend |
| Nemo Frontend | GPT-6.1 Terra | alto | interface, UX e validação visual |
| Nemo Frontend Review | Claude Sonnet 5.5 | médio | revisão cruzada do frontend |
| Nemo Publisher | Claude Sonnet 5.5 | médio | gates, GitHub, deploy e reversão |

Modelos alternativos só podem ser usados quando o principal estiver indisponível e devem ser registrados na entrega.

## 3. Princípios
- GitHub é a única fonte oficial do código.
- Nenhum bot aprova o próprio trabalho como revisão final.
- Quem executa também testa; revisão cruzada não substitui testes.
- Evidência vale mais que opinião.
- Correções pequenas e seguras podem ser feitas pelo revisor; mudanças estruturais retornam ao Lead.
- Segredos, credenciais e dados sensíveis nunca entram no repositório nem nas mensagens.
- Documentação e mapa mudam junto com o sistema.

## 4. Escopo por tamanho
- **P:** mudança pequena, isolada e reversível. O Lead pode dispensar revisão cruzada, registrando o motivo.
- **M:** envolve vários arquivos, contrato ou fluxo. Exige revisão cruzada.
- **G:** altera arquitetura, dados críticos, autenticação, publicação ou vários subsistemas. Exige plano do Architect, revisões e reversão definida.

## 5. Decisões e divergências
- Divergências técnicas são resolvidas pelo Lead usando requisitos, testes e evidências.
- Divergências arquiteturais retornam ao Architect.
- Mudança de objetivo, risco de negócio ou decisão irreversível retorna ao Luis.
- Uma decisão permanente é registrada em `DECISIONS.md`.

## 6. Entrega obrigatória
Toda passagem contém: tarefa, tamanho, responsável, realizado, arquivos/áreas, contratos, testes, evidências, decisões, riscos, pendências e próximo responsável.

## 7. Publicação
O Publisher pode publicar sem aprovação manual apenas quando `QUALITY-GATES.md` estiver satisfeito. Falha em smoke test exige reversão, preservação dos logs e retorno ao Lead. O Architect só é acionado se a falha for estrutural.

## 8. Uso local e limites
- A ponte local pode ser usada para consulta e revisão, mas não é a memória oficial do produto.
- Se Claude estiver sem créditos, os bots permanecem configurados; use o fallback registrado ou aguarde a renovação.
- Arquivos de texto desta pasta devem usar UTF-8.

