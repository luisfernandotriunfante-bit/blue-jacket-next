import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { buildAiAuditJson, buildAudit } from './domain/audit'
import type { AuditItem, SourceArea, UploadedFile } from './domain/types'
import { processClientMotor, type CanonicalClient } from './domain/clientMotor'
import { processProductMotor, type CanonicalProduct, type ProductIndicators } from './domain/productMotor'
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
const productSources = [
  { id: 'internal', label: 'Cadastro interno' }, { id: 'industry', label: 'Lista da indústria' }, { id: 'stock', label: 'Estoque atual' }, { id: 'price', label: 'Preço de venda' }, { id: 'transit', label: 'Carteira em trânsito' }, { id: 'check', label: 'Conferência de estoque' },
] as const
type ClientIndicators = { totalClients: number; internal: number; portfolio: number; premises: number; complete: number }
type SavedClientMotor = { base: CanonicalClient[]; audit: AuditItem[]; indicators: ClientIndicators | null; slots: Partial<Record<(typeof clientSources)[number]['id'], UploadedFile>> }
type SavedProductMotor = { base: CanonicalProduct[]; audit: AuditItem[]; indicators: ProductIndicators | null; slots: Partial<Record<(typeof productSources)[number]['id'], UploadedFile>> }

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
  const [productAudit, setProductAudit] = useState<AuditItem[]>([])
  const [productBase, setProductBase] = useState<CanonicalProduct[]>([])
  const [productSlots, setProductSlots] = useState<Partial<Record<(typeof productSources)[number]['id'], UploadedFile>>>({})
  const [productIndicators, setProductIndicators] = useState<ProductIndicators | null>(null)
  const [productProcessing, setProductProcessing] = useState(false)
  const [productStateLoaded, setProductStateLoaded] = useState(false)
  const dailyInput = useRef<HTMLInputElement>(null)
  const motorInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const audit = useMemo(() => [...buildAudit(files).filter(item => (item.area !== 'clientes' || clientBase.length === 0) && (item.area !== 'produtos' || productBase.length === 0)), ...clientAudit, ...productAudit], [files, clientAudit, clientBase.length, productAudit, productBase.length])

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
  useEffect(() => { let active = true; void loadPersisted<SavedProductMotor>('produtos').then(saved => { if (!active || !saved) return; setProductBase(saved.base); setProductAudit(saved.audit); setProductIndicators(saved.indicators); setProductSlots(saved.slots) }).finally(() => { if (active) setProductStateLoaded(true) }); return () => { active = false } }, [])
  useEffect(() => { if (productStateLoaded) void savePersisted<SavedProductMotor>('produtos', { base: productBase, audit: productAudit, indicators: productIndicators, slots: productSlots }) }, [productStateLoaded, productBase, productAudit, productIndicators, productSlots])

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
  function productSourceChange(source: (typeof productSources)[number]['id'], event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    const uploaded: UploadedFile = { id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area: 'produtos', receivedAt: new Date().toLocaleString('pt-BR'), lastModified: file.lastModified }
    setFiles(current => [...current.filter(item => item.id !== productSlots[source]?.id), uploaded]); setRawFiles(current => ({ ...current, [uploaded.id]: file })); setProductSlots(current => ({ ...current, [source]: uploaded }))
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
  async function processProducts() {
    const selected = Object.values(productSlots).map(file => file && rawFiles[file.id]).filter((file): file is File => Boolean(file)); if (!selected.length) return
    setProductProcessing(true); setProductAudit([])
    try { const result = await processProductMotor(selected); setProductBase(result.canonicalBase); setProductAudit(result.audit); setProductIndicators(result.indicators) }
    catch { setProductAudit([{ id: 'product-read-error', level: 'action', title: 'Não foi possível ler os arquivos', instruction: 'Confira os arquivos e tente novamente.', detail: 'A base de produtos não foi alterada.', area: 'produtos' }]); setProductBase([]); setProductIndicators(null) }
    finally { setProductProcessing(false) }
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
  function downloadProductBase() { const url = URL.createObjectURL(new Blob([JSON.stringify(productBase, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'base-canonica-produtos.json'; link.click(); URL.revokeObjectURL(url) }
  function downloadProductExcel() { const sheet = XLSX.utils.json_to_sheet(productBase.map(product => ({ Agrupamento: product.groupName ?? '', Família: product.groupFamily ?? '', Código: product.internalCode ?? '', 'Código fabricante': product.manufacturerCode ?? '', EAN: product.ean ?? '', DUN: product.dun ?? '', Descrição: product.description ?? '', Embalagem: product.package ?? '', Unidade: product.unit ?? '', Marca: product.brand ?? '', Categoria: product.category ?? '', Subcategoria: product.subcategory ?? '', Departamento: product.department ?? '', Linha: product.productLine ?? '', Comprador: product.buyer ?? '', 'Classificação fiscal': product.taxClassification ?? '', 'Tipo de mercadoria': product.merchandiseType ?? '', 'Fora de linha': product.discontinued ?? '', 'Unidades por caixa': product.unitsPerBox ?? '', 'Caixas por palete': product.boxesPerPallet ?? '', 'Caixas por lastro': product.boxesPerLayer ?? '', 'Peso bruto unitário': product.grossWeightUnit ?? '', 'Peso líquido unitário': product.netWeightUnit ?? '', 'Peso bruto caixa': product.grossWeightBox ?? '', 'Peso líquido caixa': product.netWeightBox ?? '', Disponível: product.availableStock ?? '', Estoque: product.totalStock ?? '', Reservado: product.reservedStock ?? '', Bloqueado: product.blockedStock ?? '', Avariado: product.damagedStock ?? '', 'Quantidade indústria': product.industryQuantity ?? '', 'Estoque/lote': product.stockLot ?? '', Fornecedor: product.supplierName ?? '', 'Custo real': product.realCost ?? '', 'Custo financeiro': product.financialCost ?? '', 'Último custo': product.lastEntryCost ?? '', 'Venda mês': product.monthlySales ?? '', 'Venda mês anterior': product.monthlySales1 ?? '', 'Giro diário': product.dailyTurnover ?? '', 'Preço base indústria': product.industryBasePrice ?? '', 'Valor caixa indústria': product.industryBoxValue ?? '', 'Preço sem imposto': product.sellerPriceWithoutTax ?? '', 'Preço de venda': product.sellerPrice ?? '', IVA: product.iva ?? '', ICMS: product.icms ?? '', PIS: product.pis ?? '', COFINS: product.cofins ?? '', 'Em trânsito': product.inTransitQuantity ?? '', 'Valor em trânsito': product.inTransitValue ?? '', Status: product.status }))); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Produtos'); XLSX.writeFile(book, 'base-canonica-produtos.xlsx') }
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
        <div className="motor-grid">{motors.map(motor => <article className="motor-card" key={motor.id}><h3>{motor.name}</h3>{motor.id === 'produtos' ? <><div className="client-source-list">{productSources.map(source => { const uploaded = productSlots[source.id]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong><small>{uploaded ? `Atualizado em ${new Date(uploaded.lastModified ?? Date.now()).toLocaleDateString('pt-BR')}` : source.id === 'check' ? 'Opcional' : 'Ainda não enviado'}</small></span><label className="source-upload">{uploaded ? 'Trocar arquivo' : 'Adicionar arquivo'}<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" onChange={event => productSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={productProcessing || !Object.values(productSlots).some(file => file && rawFiles[file.id])} onClick={processProducts}>{productProcessing ? 'Conferindo arquivos' : 'Criar base de produtos'}</button>{productIndicators ? <div className="indicators"><span>{productIndicators.total.toLocaleString('pt-BR')} produtos</span><span>{productIndicators.inTransit.toLocaleString('pt-BR')} em trânsito</span><button type="button" onClick={downloadProductBase}>Baixar JSON</button><button type="button" onClick={downloadProductExcel}>Baixar Excel</button></div> : null}</> : motor.id === 'clientes' ? <><div className="client-source-list">{clientSources.map(source => { const uploaded = clientSlots[source.id]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong><small>{uploaded ? `Atualizado em ${new Date(uploaded.lastModified ?? Date.now()).toLocaleDateString('pt-BR')}` : 'Ainda não enviado'}</small></span><label className="source-upload">{uploaded ? 'Trocar arquivo' : 'Adicionar arquivo'}<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" onChange={event => clientSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={clientProcessing || !Object.values(clientSlots).some(file => file && rawFiles[file.id])} onClick={processClients}>{clientProcessing ? 'Conferindo arquivos' : 'Criar base de clientes'}</button>{clientIndicators ? <div className="indicators"><span>{clientIndicators.totalClients.toLocaleString('pt-BR')} clientes</span><span>{clientIndicators.complete.toLocaleString('pt-BR')} completos</span><button type="button" onClick={downloadClientBase}>Baixar JSON</button><button type="button" onClick={downloadClientExcel}>Baixar Excel</button></div> : null}</> : <><button type="button" className="add-button" onClick={() => motorInputs.current[motor.id]?.click()}>Adicionar arquivos</button><input ref={element => { motorInputs.current[motor.id] = element }} aria-label={`Adicionar arquivos de ${motor.name}`} type="file" multiple onChange={event => fileChange(motor.id, event)} /><FileList files={filesIn(motor.id)} onRemove={removeFile} compact /></>}</article>)}</div>
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
