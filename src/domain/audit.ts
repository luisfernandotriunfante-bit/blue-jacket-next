import type { AuditItem, SourceArea, UploadedFile } from './types'

const areaLabel: Record<SourceArea, string> = {
  diario: 'arquivos diários',
  produtos: 'Produtos',
  clientes: 'Clientes',
  movimentacoes: 'Movimentações',
  historico: 'Histórico',
}

export function buildAudit(files: UploadedFile[]): AuditItem[] {
  const areas: SourceArea[] = ['diario', 'produtos', 'clientes', 'movimentacoes', 'historico']
  return areas.map(area => {
    const count = files.filter(file => file.area === area).length
    if (count > 0) return { id: area, level: 'ok', title: `${areaLabel[area]} recebido${count > 1 ? 's' : ''}`, instruction: 'Pronto para conferir.', detail: `${count} arquivo${count > 1 ? 's foram enviados' : ' foi enviado'} para esta etapa. Quando o motor for criado, ele conferirá essas informações antes de usar a base.`, area }
    return { id: area, level: 'action', title: `${areaLabel[area]} pendente${area === 'diario' ? 's' : ''}`, instruction: 'Adicione os arquivos quando estiverem disponíveis.', detail: 'Ainda não há arquivos nesta etapa. Isso não é um erro: o sistema só precisa deles antes de gerar a base correspondente.', area }
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
