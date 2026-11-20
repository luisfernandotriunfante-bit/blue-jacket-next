import type { AuditItem, SourceArea, UploadedFile } from './types'

const areaLabel: Record<SourceArea, string> = {
  diario: 'arquivos diários',
  produtos: 'Produtos',
  clientes: 'Clientes',
  movimentacoes: 'Movimentações',
  recebimentos: 'Chegada de notas',
  historico: 'Histórico',
}

// Relatórios que cada etapa reconhece, usados para dizer ao usuário qual
// arquivo específico falta em vez de um aviso genérico de "adicione arquivos".
const expectedReports: Record<SourceArea, string[]> = {
  diario: [],
  produtos: ['Cadastro interno (286)', 'Lista da indústria', 'Estoque atual (1118)', 'Preço de venda (8011)', 'Sub-marcas (8013)', 'Sortimento nacional'],
  clientes: ['Cadastro interno', 'Carteira de clientes', 'Roteiro geral', 'Pirâmide ativa'],
  movimentacoes: ['Vendas atuais', 'Cortes por cliente (consulta de corte de mercadorias)'],
  recebimentos: ['Relação de notas fiscais (legado)', 'Entradas atuais (218)', 'Carteira da indústria'],
  historico: ['Vendas detalhadas do legado', 'Catálogo Milênio'],
}

export function buildAudit(files: UploadedFile[]): AuditItem[] {
  const areas: SourceArea[] = ['diario', 'produtos', 'clientes', 'movimentacoes', 'recebimentos', 'historico']
  return areas.map(area => {
    const count = files.filter(file => file.area === area).length
    if (count > 0) return { id: area, level: 'ok', title: `${areaLabel[area]} recebido${count > 1 ? 's' : ''}`, instruction: 'Pronto para conferir.', detail: `${count} arquivo${count > 1 ? 's foram enviados' : ' foi enviado'} para esta etapa. Quando o motor for criado, ele conferirá essas informações antes de usar a base.`, area }
    const reports = expectedReports[area]
    if (area === 'diario') {
      return {
        id: area, level: 'action', title: `${areaLabel[area]} pendentes`,
        instruction: 'Confira se o nome e o formato do arquivo correspondem a um relatório reconhecido (produtos, clientes, movimentações, recebimentos ou histórico) e reenvie.',
        detail: 'Esta categoria reúne arquivos que o sistema não conseguiu classificar automaticamente em nenhum motor. Não há uma lista fixa de nomes esperados aqui.',
        aiDetail: 'Pedir ao usuário o nome do arquivo e as primeiras linhas/colunas para identificar manualmente a qual motor ele pertence (produtos, clientes, movimentações, recebimentos ou histórico); não presumir o motor sem essa informação.',
        area,
      }
    }
    return {
      id: area, level: 'action', title: `${areaLabel[area]} pendente`,
      instruction: `Envie um destes relatórios: ${reports.join(', ')}.`,
      detail: `Nenhum arquivo de ${areaLabel[area]} foi recebido ainda. Relatórios aceitos nesta etapa: ${reports.join(', ')}.`,
      aiDetail: `Pedir ao usuário um destes relatórios específicos, no formato original do sistema de origem (sem editar colunas): ${reports.join(', ')}.`,
      area,
    }
  })
}

export function buildAiAuditJson(files: UploadedFile[], audit: AuditItem[]) {
  return {
    type: 'red_jacket_audit',
    generated_at: new Date().toISOString(),
    purpose: 'Resumo claro para uma IA ajudar a corrigir pendências do painel.',
    current_stage: 'Preparação dos motores',
    files_received: files.map(file => ({ name: file.name, area: areaLabel[file.area], received_at: file.receivedAt })),
    pending_or_attention: audit.filter(item => item.level !== 'ok').map(item => ({
      area: areaLabel[item.area],
      user_message: item.title,
      what_the_user_needs_to_do: item.instruction,
      plain_language_context: item.detail,
      technical_context_for_ai: item.aiDetail ?? 'Não inventar dados. Solicitar o arquivo ou a regra manual correspondente e registrar a decisão na auditoria.',
    })),
    rule: 'A base canônica interna será JSON. Planilhas Excel serão geradas para conferência e entrega humana.',
  }
}
