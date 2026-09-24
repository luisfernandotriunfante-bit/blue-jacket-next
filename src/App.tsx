import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { buildAiAuditJson, buildAudit } from './domain/audit'
import type { AuditItem, SourceArea, UploadedFile } from './domain/types'
import { processClientMotor, type CanonicalClient } from './domain/clientMotor'
import { loadPersisted, savePersisted } from './domain/persistence'

const motors: Array<{ id: Exclude<SourceArea, 'diario'>; name: string }> = [
  { id: 'produtos', name: 'Produtos' },
  { id: 'clientes', name: 'Clientes' },
  { id: 'movimentacoes', name: 'Movimentações' },
  { id: 'historico', name: 'Histórico' },
]

const areaName: Record<SourceArea, string> = { diario: 'Diários', produtos: 'Produtos', clientes: 'Clientes', movimentacoes: 'Movimentações', historico: 'Histórico' }
const clientSources = [
  { id: 'internal', label: 'Cadastro interno' },
  { id: 'portfolio', label: 'Carteira' },
  { id: 'premises', label: 'Premissas' },
] as const
type ClientIndicators = { totalClients: number; internal: number; portfolio: number; premises: number; complete: number }
type SavedClientMotor = { base: CanonicalClient[]; audit: AuditItem[]; indicators: ClientIndicators | null; slots: Partial<Record<(typeof clientSources)[number]['id'], UploadedFile>> }

function fileSize(size: number) { return size < 1_000_000 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1_000_000).toFixed(1)} MB` }

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [tab, setTab] = useState<'uploads' | 'auditoria'>('uploads')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [rawFiles, setRawFiles] = useState<Record<string, File>>({})
  const [activeNotice, setActiveNotice] = useState<AuditItem | null>(null)
  const [clientAudit, setClientAudit] = useState<AuditItem[]>([])
  const [clientBase, setClientBase] = useState<CanonicalClient[]>([])
  const [clientSlots, setClientSlots] = useState<Partial<Record<(typeof clientSources)[number]['id'], UploadedFile>>>({})
  const [clientIndicators, setClientIndicators] = useState<ClientIndicators | null>(null)
  const [clientProcessing, setClientProcessing] = useState(false)
  const [clientStateLoaded, setClientStateLoaded] = useState(false)
  const dailyInput = useRef<HTMLInputElement>(null)
  const motorInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const audit = useMemo(() => [...buildAudit(files).filter(item => item.area !== 'clientes' || clientBase.length === 0), ...clientAudit], [files, clientAudit, clientBase.length])

  useEffect(() => {
    let active = true
    void loadPersisted<SavedClientMotor>('clientes').then(saved => {
      if (!active || !saved) return
      setClientBase(saved.base); setClientAudit(saved.audit); setClientIndicators(saved.indicators); setClientSlots(saved.slots)
    }).finally(() => { if (active) setClientStateLoaded(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!clientStateLoaded) return
    void savePersisted<SavedClientMotor>('clientes', { base: clientBase, audit: clientAudit, indicators: clientIndicators, slots: clientSlots })
  }, [clientStateLoaded, clientBase, clientAudit, clientIndicators, clientSlots])

  function addFiles(area: SourceArea, incoming: FileList | File[]) {
    const next = Array.from(incoming).map(file => ({ id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area, receivedAt: new Date().toLocaleString('pt-BR'), lastModified: file.lastModified }))
    setFiles(current => [...current, ...next])
    setRawFiles(current => Object.assign({}, current, Object.fromEntries(next.map((item, index) => [item.id, Array.from(incoming)[index]]))))
  }
  function fileChange(area: SourceArea, event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(area, event.target.files); event.target.value = '' }
  function clientSourceChange(source: (typeof clientSources)[number]['id'], event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const uploaded: UploadedFile = { id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area: 'clientes', receivedAt: new Date().toLocaleString('pt-BR'), lastModified: file.lastModified }
    setFiles(current => [...current.filter(item => item.id !== clientSlots[source]?.id), uploaded])
    setRawFiles(current => ({ ...current, [uploaded.id]: file }))
    setClientSlots(current => ({ ...current, [source]: uploaded }))
  }
  function drop(area: SourceArea, event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(area, event.dataTransfer.files) }
  function removeFile(id: string) { setFiles(current => current.filter(file => file.id !== id)); setRawFiles(current => { const next = { ...current }; delete next[id]; return next }) }
  async function processClients() {
    const selected = Object.values(clientSlots).map(file => file && rawFiles[file.id]).filter((file): file is File => Boolean(file))
    if (!selected.length) return
    setClientProcessing(true); setClientAudit([])
    try { const result = await processClientMotor(selected); setClientAudit(result.audit); setClientBase(result.canonicalBase); setClientIndicators(result.indicators) }
    catch { setClientAudit([{ id: 'client-read-error', level: 'action', title: 'Não foi possível ler os arquivos', instruction: 'Confira os arquivos e tente novamente.', detail: 'A base de clientes não foi alterada.', area: 'clientes' }]); setClientBase([]); setClientIndicators(null) }
    finally { setClientProcessing(false) }
  }
  function downloadClientBase() { const url = URL.createObjectURL(new Blob([JSON.stringify(clientBase, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'base-canonica-clientes.json'; link.click(); URL.revokeObjectURL(url) }
  function downloadClientExcel() {
    const rows = clientBase.map(client => ({
      Documento: client.document, Código: client.winthorCode ?? '', Cliente: client.legalName ?? '', Fantasia: client.tradeName ?? '', Cidade: client.city ?? '',
      'Código RCA': client.rcaCode ?? '', Atividade: client.commercialActivity ?? '', Bairro: client.district ?? '', Endereço: client.address ?? '',
      Latitude: client.latitude ?? '', Longitude: client.longitude ?? '', Frequência: client.visitFrequency ?? '', Visita: client.visitDay ?? '', 'Dias sem comprar': client.daysWithoutPurchase ?? '',
      Semestre: client.premiseSemester ?? '', Ambiente: client.premiseEnvironment ?? '', Faixa: client.premiseRange ?? '', Estado: client.premiseState ?? '',
      Cluster: client.premiseCluster ?? '', 'Média 12 meses': client.premiseAverage12Months ?? '', Perfil: client.premiseProfile ?? '', Rede: client.premiseNetwork ?? '',
    }))
    const sheet = XLSX.utils.json_to_sheet(rows)
    sheet['!cols'] = Object.keys(rows[0] ?? {}).map(header => ({ wch: Math.max(14, Math.min(36, header.length + 7)) }))
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Clientes'); XLSX.writeFile(book, 'base-canonica-clientes.xlsx')
  }
  function downloadAiJson() {
    const body = JSON.stringify(buildAiAuditJson(files, audit), null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auditoria-red-jacket.json'; link.click(); URL.revokeObjectURL(url)
  }
  const filesIn = (area: SourceArea) => files.filter(file => file.area === area)

  return <div className={`app theme-${theme}`}>
    <aside className="sidebar"><div className="brand">RED JACKET</div><button className="nav-item active" type="button">Administração</button><div className="sidebar-bottom"><button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button></div></aside>
    <main className="main">
      <header className="topbar"><h1>ADMINISTRAÇÃO</h1><nav className="tabs" aria-label="Administração"><button className={tab === 'uploads' ? 'selected' : ''} onClick={() => setTab('uploads')} type="button">Uploads</button><button className={tab === 'auditoria' ? 'selected' : ''} onClick={() => setTab('auditoria')} type="button">Auditoria</button></nav></header>
      {tab === 'uploads' ? <section className="content">
        <h2>ARQUIVOS DIÁRIOS</h2>
        <div className="quick-upload" role="button" tabIndex={0} onClick={() => dailyInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => drop('diario', event)}><strong>Solte todos os arquivos aqui</strong><span>ou escolha os arquivos</span><input ref={dailyInput} aria-label="Adicionar arquivos diários" type="file" multiple onChange={event => fileChange('diario', event)} /></div>
        <FileList files={filesIn('diario')} onRemove={removeFile} />
        <h2 className="section-title">MOTORES</h2>
        <div className="motor-grid">{motors.map(motor => <article className="motor-card" key={motor.id}><h3>{motor.name}</h3>{motor.id === 'clientes' ? <><div className="client-source-list">{clientSources.map(source => { const uploaded = clientSlots[source.id]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong><small>{uploaded ? `Atualizado em ${new Date(uploaded.lastModified ?? Date.now()).toLocaleDateString('pt-BR')}` : 'Ainda não enviado'}</small></span><label className="source-upload">{uploaded ? 'Trocar arquivo' : 'Adicionar arquivo'}<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" onChange={event => clientSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={clientProcessing || !Object.values(clientSlots).some(file => file && rawFiles[file.id])} onClick={processClients}>{clientProcessing ? 'Conferindo arquivos' : 'Criar base de clientes'}</button>{clientIndicators ? <div className="indicators"><span>{clientIndicators.totalClients.toLocaleString('pt-BR')} clientes</span><span>{clientIndicators.complete.toLocaleString('pt-BR')} completos</span><button type="button" onClick={downloadClientBase}>Baixar JSON</button><button type="button" onClick={downloadClientExcel}>Baixar Excel</button></div> : null}</> : <><button type="button" className="add-button" onClick={() => motorInputs.current[motor.id]?.click()}>Adicionar arquivos</button><input ref={element => { motorInputs.current[motor.id] = element }} aria-label={`Adicionar arquivos de ${motor.name}`} type="file" multiple onChange={event => fileChange(motor.id, event)} /><FileList files={filesIn(motor.id)} onRemove={removeFile} compact /></>}</article>)}</div>
      </section> : <section className="content">
        <div className="audit-heading"><h2>AUDITORIA</h2><button className="secondary-button" type="button" onClick={downloadAiJson}>Gerar resumo para IA</button></div>
        <div className="notice-list">{audit.map(item => <button className={`notice ${item.level}`} key={item.id} type="button" onClick={() => setActiveNotice(item)}><span>{item.title}</span><small>{item.instruction}</small></button>)}</div>
      </section>}
    </main>
    {activeNotice ? <div className="modal-backdrop" onMouseDown={() => setActiveNotice(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="notice-title" onMouseDown={event => event.stopPropagation()}><button className="close" aria-label="Fechar" type="button" onClick={() => setActiveNotice(null)}>×</button><h2 id="notice-title">{activeNotice.title}</h2><p>{activeNotice.detail}</p><strong>{activeNotice.instruction}</strong></section></div> : null}
  </div>
}

function FileList({ files, onRemove, compact = false }: { files: UploadedFile[]; onRemove: (id: string) => void; compact?: boolean }) {
  if (!files.length) return <p className={compact ? 'empty compact' : 'empty'}>Nenhum arquivo adicionado.</p>
  return <ul className={compact ? 'file-list compact' : 'file-list'}>{files.map(file => <li key={file.id}><span><strong>{file.name}</strong><small>{fileSize(file.size)} · {areaName[file.area]}</small></span><button type="button" aria-label={`Remover ${file.name}`} onClick={() => onRemove(file.id)}>Remover</button></li>)}</ul>
}
