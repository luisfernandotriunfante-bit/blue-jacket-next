# Nemo — mapa atual do sistema

## Fluxo de autoridade
```text
Luis
  ↓
Nemo Architect
  ↓ pacote arquitetural
Nemo Lead
  ├─→ Nemo Backend ─→ Nemo Backend Review ─┐
  └─→ Nemo Frontend ─→ Nemo Frontend Review ┤
                                             ↓
                                      Nemo Lead integra
                                             ↓
                                   Nemo Architect confere
                                             ↓
                                      Nemo Publisher
                                             ↓
                                      GitHub + site
```

## Fontes de informação
- GitHub: código e documentação oficial do produto.
- OpenBot: configuração, conversas e operação dos bots.
- `C:\nemo`: governança, ponte local, registros de revisão e sala histórica.

## Componentes locais conhecidos
- `ferramentas/ponte-codex.js`: comunicação Claude → GPT.
- `sala/`: interface e histórico da ponte experimental.
- `conversas/`: pedidos e respostas históricos.
- `revisao/`: pendências e revisões do protocolo antigo; manter apenas para compatibilidade até migração.
- `entregas/`: artefatos entregues localmente quando necessário.

## Regra de atualização
O Architect atualiza este mapa quando surgirem ou desaparecerem componentes, integrações, fontes de dados, ambientes ou caminhos críticos.

