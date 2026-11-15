import type { AuditItem, SourceArea, UploadedFile } from './types'

type AreaMeta = { label: string; recebido: string; pendente: string }

const areaMeta: Record<SourceArea, AreaMeta> = {
  diario:        { label: 'arquivos diários',  recebido: 'recebidos', pendente: 'pendentes' },
  produtos:      { label: 'Produtos',          recebido: 'recebidos', pendente: 'pendentes' },
  clientes:      { label: 'Clientes',          recebido: 'recebidos', pendente: 'pendentes' },
  movimentacoes: { label: 'Movimentações',     recebido: 'recebidas', pendente: 'pendentes' },
  recebimentos:  { label: 'Chegada de notas',  recebido: 'recebida',  pendente: 'pendente'  },
  historico:     { label: 'Histórico',         recebido: 'recebido',  pendente: 'pendente'  },
}

export function buildAudit(files: UploadedFile[]): AuditItem[] {
  const areas: SourceArea[] = ['diario', 'produtos', 'clientes', 'movimentacoes', 'recebimentos', 'historico']
  return areas.map(area => {
    const { label, recebido, pendente } = areaMeta[area]
    const count = files.filter(file => file.area === area).length
    if (count > 0) {
      return {
        id: area, level: 'ok',
        title: `${label} ${recebido}`,
        instruction: 'Pronto para conferir.',
        detail: `${count} arquivo${count > 1 ? 's foram enviados' : ' foi enviado'} para esta etapa. Quando o motor for criado, ele conferirá essas informações antes de usar a base.`,
        area,
      }
    }
    return {
      id: area, level: 'action',
      title: `${label} ${pendente}`,
      instruction: 'Adicione os arquivos quando estiverem disponíveis.',
      detail: 'Ainda não há arquivos nesta etapa. Isso não é um erro: o sistema só precisa deles antes de gerar a base correspondente.',
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
    files_received: files.map(file => ({ name: file.name, area: areaMeta[file.area].label, received_at: file.receivedAt })),
    pending_or_attention: audit.filter(item => item.level !== 'ok').map(item => ({
      area: areaMeta[item.area].label,
      user_message: item.title,
      what_the_user_needs_to_do: item.instruction,
      plain_language_context: item.detail,
      technical_context_for_ai: item.aiDetail ?? 'Não inventar dados. Solicitar o arquivo ou a regra manual correspondente e registrar a decisão na auditoria.',
    })),
    rule: 'A base canônica interna será JSON. Planilhas Excel serão geradas para conferência e entrega humana.',
  }
}
