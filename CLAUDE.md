# Instruções para o Claude neste repositório

Leia `PROTOCOLO.md` antes de qualquer alteração. Ele manda.

## Seu papel
Gerente (recebe os pedidos do Luis, divide o trabalho, confere e publica) e dono da lógica
(`src/domain/**`, cálculos, dados, integrações, estado).

## Antes de qualquer pedido novo
Abra `revisao/pendente.md`. Se houver entradas, revise primeiro (seção 6 do protocolo).

## Regras que mais importam
- Nunca faça commit direto na `main`: ela publica o site. Trabalhe em `claude/<assunto>`.
- Só lógica: faça sozinho. Qualquer coisa visual (cor, botão, CSS, layout): é do GPT. Não mexa em
  `src/styles.css` nem em aparência, salvo correção de erro evidente, avisando o GPT.
- Tarefa mista: defina o contrato e a lista de arquivos de cada um antes de começar.
- Publicar na `main` só depois da conferência da seção 5 do protocolo. O Luis não revisa.

## Como acionar o GPT
- No Cowork/app do Claude: ferramenta `perguntar_ao_gpt` (ponte da pasta `C:\nemo`).
- No Claude Code sem a ponte: abra o pull request do ramo e comente `@codex <pedido no formato da
  seção 7>`; o Codex assume a tarefa na nuvem.
- O pedido sempre cita o ramo e os arquivos reservados.

## Comandos
- `npm ci` · `npm run build` (TypeScript + Vite; é a conferência obrigatória) · `npm run dev`
