import * as XLSX from 'xlsx'
import type { AuditItem } from './types'

export type CanonicalReceipt = { id: string; status: 'recebida' | 'em_transito'; system: 'legado' | 'atual' | 'industria'; entryDate?: string; issueDate?: string; invoice?: string; supplierDocument?: string; supplierName?: string; operation?: string; productCode?: string; description?: string; quantity?: number; unitPrice?: number; financialCost?: number; value?: number; sources: string[] }
export type ReceiptIndicators = { received: number; inTransit: number; currentItems: number; legacyNotes: number }
export type ReceiptMotorResult = { canonicalBase: CanonicalReceipt[]; audit: AuditItem[]; indicators: ReceiptIndicators }

export type InvoiceGroup = {
  invoice: string
  displayInvoice: string
  items: CanonicalReceipt[]
  date?: string
  supplier?: string
  totalQty: number
  totalValue: number
}

export function normNfKey(nf: string): string {
  return nf.replace(/\*/g, '').replace(/^0+/, '').split('-')[0] ?? ''
}

export function groupReceiptsByInvoice(base: CanonicalReceipt[]): {
  receivedGroups: InvoiceGroup[]
  openTransitGroups: InvoiceGroup[]
} {
  const receivedNFs = new Set<string>()
  for (const r of base) {
    if (r.status === 'recebida' && r.invoice) { const k = normNfKey(r.invoice); if (k) receivedNFs.add(k) }
  }
  const recMap = new Map<string, CanonicalReceipt[]>()
  for (const r of base.filter(r => r.status === 'recebida')) {
    const key = r.invoice ?? `_${r.entryDate ?? ''}_${r.productCode ?? ''}`
    if (!recMap.has(key)) recMap.set(key, [])
    recMap.get(key)!.push(r)
  }
  const receivedGroups: InvoiceGroup[] = Array.from(recMap.entries())
    .map(([invoice, items]) => ({ invoice, displayInvoice: items[0]?.invoice ?? 'Sem nota', items, date: items[0]?.entryDate, supplier: items[0]?.supplierName, totalQty: items.reduce((s, r) => s + (r.quantity ?? 0), 0), totalValue: items.reduce((s, r) => s + (r.value ?? 0), 0) }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const transMap = new Map<string, CanonicalReceipt[]>()
  for (const r of base.filter(r => r.status === 'em_transito').sort((a, b) => (a.entryDate ?? '').localeCompare(b.entryDate ?? ''))) {
    const nfNorm = r.invoice ? normNfKey(r.invoice) : null
    if (nfNorm && receivedNFs.has(nfNorm)) continue
    const key = r.invoice ?? `_${r.entryDate ?? ''}_${r.productCode ?? ''}`
    if (!transMap.has(key)) transMap.set(key, [])
    transMap.get(key)!.push(r)
  }
  const openTransitGroups: InvoiceGroup[] = Array.from(transMap.entries())
    .map(([invoice, items]) => ({ invoice, displayInvoice: items[0]?.invoice ?? 'Sem nota', items, date: items[0]?.entryDate, supplier: items[0]?.supplierName, totalQty: items.reduce((s, r) => s + (r.quantity ?? 0), 0), totalValue: items.reduce((s, r) => s + (r.value ?? 0), 0) }))
  return { receivedGroups, openTransitGroups }
}

export function computeDailyReceiptRate(base: CanonicalReceipt[]): Map<string, number> {
  const cutoff12m = Date.now() - 365 * 86_400_000
  const qty12m = new Map<string, number>()
  for (const r of base) {
    if (r.status !== 'recebida' || !r.productCode || !r.quantity || !r.entryDate) continue
    const ms = new Date(r.entryDate).getTime()
    if (!Number.isFinite(ms) || ms < cutoff12m) continue
    qty12m.set(r.productCode, (qty12m.get(r.productCode) ?? 0) + r.quantity)
  }
  const result = new Map<string, number>()
  for (const [c, qty] of qty12m) result.set(c, qty / 365)
  return result
}
type Row = unknown[]
const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const text=(v:unknown)=>{const x=String(v??'').trim();return x||undefined}
const code=(v:unknown)=>{const x=String(v??'').replace(/\*/g,'').replace(/\.0$/,'').replace(/\s/g,'').replace(/^0+(?=\d)/,'');return x||undefined}
const nfCode=(v:unknown)=>{const s=String(v??'').replace(/\*/g,'').trim();const b=s.split('-')[0]!.replace(/^0+/,'');return b||undefined}
const num=(v:unknown)=>{const x=String(v??'').replace(/\*/g,'').trim();const y=x.includes(',')&&x.includes('.')?(x.lastIndexOf(',')<x.lastIndexOf('.')?x.replace(/,/g,''):x.replace(/\./g,'').replace(',','.')):x.replace(',','.');const n=Number(y);return Number.isFinite(n)?n:undefined}
const date=(v:unknown)=>{const m=String(v??'').match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);return m?`${m[3].length===2?'20'+m[3]:m[3]}-${m[2]}-${m[1]}`:undefined}
const audit=(id:string,title:string,instruction:string,detail:string,level:AuditItem['level']='ok',aiDetail?:string):AuditItem=>({id,title,instruction,detail,level,aiDetail,area:'recebimentos'})

export async function processReceiptMotor(files: File[]):Promise<ReceiptMotorResult>{
 const base:CanonicalReceipt[]=[];const audits:AuditItem[]=[];let legacy=0,current=0,transit=0
 for(const file of files){
  const isText=file.name.toLowerCase().endsWith('.txt')
  if(isText){const s=(await file.text()).replace(/\u0000/g,'');if(!/relacao\s+de\s+notas\s+fiscais/i.test(s)){audits.push(audit(`receipt-layout-${crypto.randomUUID()}`,'Um arquivo não foi reconhecido','Envie a relação de notas do legado.','O conteúdo não corresponde ao formato esperado.','action',`O arquivo "${file.name}" não contém o texto "RELAÇÃO DE NOTAS FISCAIS" esperado para as notas do legado. Pedir ao usuário a relação de notas fiscais do sistema legado, sem edições.`));continue}const re=/^\s*(\d+)\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(.+?)\s+(\d+\.\d+)\s+(\d+)\s+([\d.,-]+)\s+/;for(const line of s.split(/\r?\n/)){const m=line.match(re);if(!m)continue;const[,invoice,issue,entry,doc,name,operation,,value]=m;base.push({id:`LEGADO:${invoice}:${entry}`,status:'recebida',system:'legado',invoice,issueDate:date(issue),entryDate:date(entry),supplierDocument:doc,supplierName:name.trim(),operation,value:num(value),sources:['Notas do legado']});legacy++}continue}
  const book=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});for(const sheetName of book.SheetNames){const rows=XLSX.utils.sheet_to_json<Row>(book.Sheets[sheetName],{header:1,defval:'',raw:false});if(rows.some(r=>norm(r[0]).includes('relentradademercadoria'))){let head:Row=[];for(let i=0;i<rows.length;i++){const r=rows[i];if(norm(r[0])==='dtentrada'&&norm(r[4])==='notafiscal'){head=rows[i+1]??[];continue}if(norm(r[4])!=='codigo'||norm(r[5])!=='produto')continue;for(i++;i<rows.length;i++){const item=rows[i];if(norm(item[0])==='dtentrada'||norm(item[4])==='cpagar'){i--;break}const productCode=code(item[4]);if(!productCode||!date(head[0]))continue;base.push({id:`ATUAL:${code(head[4])}:${productCode}:${current}`,status:'recebida',system:'atual',entryDate:date(head[0]),issueDate:date(head[8]),invoice:code(head[4]),supplierDocument:code(head[18]),supplierName:text(head[12]),productCode,description:text(item[5]),quantity:num(item[15]),unitPrice:num(item[17]),financialCost:num(item[20]),value:num(head[21]),sources:['Entradas atuais']});current++}}continue}const header=rows.find(r=>norm(r[0])==='orderdate'&&norm(r[4])==='material'&&norm(r[6])==='orderqty');if(header){
  const start=rows.indexOf(header)+1
  const valueColByHeader=(header as Row).findIndex(cell=>{const n=norm(cell);return n.includes('valor')||n.includes('value')||n.includes('amount')})
  const valueColFound=valueColByHeader>=0
  const valueCol=valueColFound?valueColByHeader:8
  let transitBefore=transit
  let anyNonZeroValue=false
  for(const r of rows.slice(start)){
    const productCode=code(r[4]),qty=(num(r[6])??0)+(num(r[7])??0)
    if(!productCode||qty<=0)continue
    const value=num(r[valueCol])??0
    if(value!==0)anyNonZeroValue=true
    base.push({id:`TRANSITO:${productCode}:${r[0]}:${transit}`,status:'em_transito',system:'industria',entryDate:date(r[0]),productCode,description:text(r[5]),quantity:qty,value,invoice:nfCode(r[9]),sources:['Carteira da Colgate']})
    transit++
  }
  if(transit>transitBefore&&(!valueColFound||!anyNonZeroValue)){
    const detail=valueColFound
      ? `A coluna de valor foi encontrada pelo cabeçalho, mas todos os valores lidos no arquivo "${file.name}" vieram zerados.`
      : `Nenhuma coluna com cabeçalho "valor", "value" ou "amount" foi encontrada na carteira do arquivo "${file.name}" (mesma linha de ORDER DATE/MATERIAL/ORDER QTY). Usei a posição 9 (coluna I) como respaldo, mas os valores vieram zerados.`
    audits.push(audit('receipt-transit-value-missing','Valor da carteira não foi lido','Confira a coluna de valor da carteira no arquivo e reenvie.',detail,'action',`${detail} A quantidade e a nota continuam sendo usadas normalmente; só o valor em R$ da carteira em trânsito ficou 0.`))
  }
  continue
}if(rows.length)audits.push(audit(`receipt-layout-${crypto.randomUUID()}`,'Um arquivo não foi reconhecido','Confira o relatório e envie novamente.','O conteúdo não corresponde a notas ou carteira no formato esperado.','action',`A aba "${sheetName}" do arquivo "${file.name}" não bateu com nenhum dos 2 formatos reconhecidos (entradas atuais: título "Rel. Entrada de Mercadoria"; carteira da indústria: cabeçalho com ORDER DATE/MATERIAL/ORDER QTY). Pedir ao usuário para confirmar qual desses relatórios é esse arquivo.`))}}
 if(legacy)audits.push(audit('receipt-legacy','Notas do legado organizadas',`${legacy.toLocaleString('pt-BR')} nota(s) recebida(s).`,'O relatório do legado não possui itens por nota.'))
 if(current)audits.push(audit('receipt-current','Entradas atuais organizadas',`${current.toLocaleString('pt-BR')} item(ns) de nota recebida(s).`,'Cada item mantém nota, fornecedor e custo financeiro atual.'))
 if(transit)audits.push(audit('receipt-transit','Carteira da Colgate organizada',`${transit.toLocaleString('pt-BR')} item(ns) aguardando chegada.`,'A carteira não altera estoque nem é tratada como nota recebida.'))
 if(!base.length)audits.push(audit('receipt-none','Nenhuma nota foi encontrada','Envie as notas do legado, entradas atuais ou carteira.','Nenhum dado foi usado.','action','Nenhum arquivo bateu com notas do legado, entradas atuais (218) ou carteira da indústria. Pedir ao usuário um desses 3 relatórios específicos, no formato original.'))
 return{canonicalBase:base.sort((a,b)=>(a.entryDate??'').localeCompare(b.entryDate??'')),audit:audits,indicators:{received:legacy+current,inTransit:transit,currentItems:current,legacyNotes:legacy}}
}
