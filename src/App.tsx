import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { buildAiAuditJson, buildAudit } from './domain/audit'
import type { AuditItem, SourceArea, UploadedFile } from './domain/types'
import { processClientMotor, type CanonicalClient } from './domain/clientMotor'
import { processProductMotor, type CanonicalProduct, type ProductIndicators } from './domain/productMotor'
import { processHistoryMotor, type CanonicalHistory, type HistoryIndicators } from './domain/historyMotor'
import { processMovementMotor, type CanonicalMovement, type MovementIndicators } from './domain/movementMotor'
import { processReceiptMotor, type CanonicalReceipt, type ReceiptIndicators } from './domain/receiptMotor'
import { classifyProduct } from './domain/productGrouping'
import { loadPersisted, savePersisted } from './domain/persistence'
import { detectFile } from './domain/fileDetector'

const motors: Array<{ id: Exclude<SourceArea, 'diario'>; name: string }> = [
  { id: 'produtos', name: 'Produtos' },
  { id: 'clientes', name: 'Clientes' },
  { id: 'movimentacoes', name: 'Movimentações' },
  { id: 'historico', name: 'Histórico' },
]

const areaName: Record<SourceArea, string> = { diario: 'Diários', produtos: 'Produtos', clientes: 'Clientes', movimentacoes: 'Movimentações', recebimentos: 'Chegada de notas', historico: 'Histórico' }
const clientSources = [
  { id: 'internal', label: 'Cadastro interno' },
  { id: 'portfolio', label: 'Carteira' },
  { id: 'premises', label: 'Premissas' },
] as const
const productSources = [
  { id: 'internal', label: 'Cadastro interno' }, { id: 'industry', label: 'Lista da indústria' }, { id: 'stock', label: 'Estoque atual' }, { id: 'price', label: 'Preço de venda' }, { id: 'sortiment', label: 'Sortimento' },
] as const
const historySources = [
  { id: 'sales', label: 'Vendas detalhadas do legado' }, { id: 'summary', label: 'Consolidado por cliente' },
] as const
const movementSources = [
  { id: 'sales', label: 'Vendas atuais' }, { id: 'cuts', label: 'Cortes por cliente' },
] as const
const receiptSources = [{ id: 'legacy', label: 'Notas do legado' }, { id: 'current', label: 'Entradas atuais por nota' }, { id: 'portfolio', label: 'Carteira da Colgate' }] as const
type ClientIndicators = { totalClients: number; internal: number; portfolio: number; premises: number; complete: number }
type SavedClientMotor = { base: CanonicalClient[]; audit: AuditItem[]; indicators: ClientIndicators | null; slots: Partial<Record<(typeof clientSources)[number]['id'], UploadedFile>> }
type SavedProductMotor = { base: CanonicalProduct[]; audit: AuditItem[]; indicators: ProductIndicators | null; slots: Partial<Record<(typeof productSources)[number]['id'], UploadedFile>> }
type SavedHistoryMotor = { base: CanonicalHistory[]; audit: AuditItem[]; indicators: HistoryIndicators | null; slots: Partial<Record<(typeof historySources)[number]['id'], UploadedFile[]>> }
type SavedMovementMotor = { base: CanonicalMovement[]; audit: AuditItem[]; indicators: MovementIndicators | null; slots: Partial<Record<(typeof movementSources)[number]['id'], UploadedFile[]>> }
type SavedReceiptMotor = { base: CanonicalReceipt[]; audit: AuditItem[]; indicators: ReceiptIndicators | null; slots: Partial<Record<(typeof receiptSources)[number]['id'], UploadedFile[]>> }

function fileSize(size: number) { return size < 1_000_000 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1_000_000).toFixed(1)} MB` }
const dedupeList = (files: UploadedFile[] | undefined) => (files ?? []).filter((f, i, arr) => arr.findIndex(e => e.name === f.name && e.size === f.size) === i)

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
  const [historyAudit, setHistoryAudit] = useState<AuditItem[]>([])
  const [historyBase, setHistoryBase] = useState<CanonicalHistory[]>([])
  const [historySlots, setHistorySlots] = useState<Partial<Record<(typeof historySources)[number]['id'], UploadedFile[]>>>({})
  const [historyIndicators, setHistoryIndicators] = useState<HistoryIndicators | null>(null)
  const [historyProcessing, setHistoryProcessing] = useState(false)
  const [historyStateLoaded, setHistoryStateLoaded] = useState(false)
  const [movementAudit, setMovementAudit] = useState<AuditItem[]>([])
  const [movementBase, setMovementBase] = useState<CanonicalMovement[]>([])
  const [movementSlots, setMovementSlots] = useState<Partial<Record<(typeof movementSources)[number]['id'], UploadedFile[]>>>({})
  const [movementIndicators, setMovementIndicators] = useState<MovementIndicators | null>(null)
  const [movementProcessing, setMovementProcessing] = useState(false)
  const [movementStateLoaded, setMovementStateLoaded] = useState(false)
  const [receiptAudit,setReceiptAudit]=useState<AuditItem[]>([]); const [receiptBase,setReceiptBase]=useState<CanonicalReceipt[]>([]); const [receiptSlots,setReceiptSlots]=useState<Partial<Record<(typeof receiptSources)[number]['id'],UploadedFile[]>>>({}); const [receiptIndicators,setReceiptIndicators]=useState<ReceiptIndicators|null>(null); const [receiptProcessing,setReceiptProcessing]=useState(false); const [receiptStateLoaded,setReceiptStateLoaded]=useState(false)
  const [processingAll, setProcessingAll] = useState(false)
  const dailyInput = useRef<HTMLInputElement>(null)
  const motorInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const audit = useMemo(() => [...buildAudit(files).filter(item => (item.area !== 'clientes' || clientBase.length === 0) && (item.area !== 'produtos' || productBase.length === 0) && (item.area !== 'historico' || historyBase.length === 0) && (item.area !== 'movimentacoes' || movementBase.length === 0) && (item.area !== 'recebimentos' || receiptBase.length === 0)), ...clientAudit, ...productAudit, ...historyAudit, ...movementAudit, ...receiptAudit], [files, clientAudit, clientBase.length, productAudit, productBase.length, historyAudit, historyBase.length, movementAudit, movementBase.length, receiptAudit, receiptBase.length])

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
  useEffect(() => { let active = true; void loadPersisted<SavedProductMotor>('produtos').then(saved => { if (!active || !saved) return; const base = saved.base.map(product => { const grouping = classifyProduct(product); return { ...product, groupCode: grouping.group?.code, groupName: grouping.group?.name, groupFamily: grouping.group?.family, groupStatus: grouping.status } }); setProductBase(base); setProductAudit(saved.audit); setProductIndicators(saved.indicators); setProductSlots(saved.slots) }).finally(() => { if (active) setProductStateLoaded(true) }); return () => { active = false } }, [])
  useEffect(() => { if (productStateLoaded) void savePersisted<SavedProductMotor>('produtos', { base: productBase, audit: productAudit, indicators: productIndicators, slots: productSlots }) }, [productStateLoaded, productBase, productAudit, productIndicators, productSlots])
  useEffect(() => { let active = true; void loadPersisted<SavedHistoryMotor>('historico').then(saved => { if (!active || !saved) return; setHistoryBase(saved.base); setHistoryAudit(saved.audit); setHistoryIndicators(saved.indicators); setHistorySlots(Object.fromEntries(Object.entries(saved.slots).map(([k, v]) => [k, dedupeList(v as UploadedFile[])])) as typeof saved.slots) }).finally(() => { if (active) setHistoryStateLoaded(true) }); return () => { active = false } }, [])
  useEffect(() => { if (historyStateLoaded) void savePersisted<SavedHistoryMotor>('historico', { base: historyBase, audit: historyAudit, indicators: historyIndicators, slots: historySlots }) }, [historyStateLoaded, historyBase, historyAudit, historyIndicators, historySlots])
  useEffect(() => { let active = true; void loadPersisted<SavedMovementMotor>('movimentacoes').then(saved => { if (!active || !saved) return; setMovementBase(saved.base); setMovementAudit(saved.audit); setMovementIndicators(saved.indicators); setMovementSlots(Object.fromEntries(Object.entries(saved.slots).map(([k, v]) => [k, dedupeList(v as UploadedFile[])])) as typeof saved.slots) }).finally(() => { if (active) setMovementStateLoaded(true) }); return () => { active = false } }, [])
  useEffect(() => { if (movementStateLoaded) void savePersisted<SavedMovementMotor>('movimentacoes', { base: movementBase, audit: movementAudit, indicators: movementIndicators, slots: movementSlots }) }, [movementStateLoaded, movementBase, movementAudit, movementIndicators, movementSlots])
  useEffect(()=>{let active=true;void loadPersisted<SavedReceiptMotor>('recebimentos').then(saved=>{if(!active||!saved)return;setReceiptBase(saved.base);setReceiptAudit(saved.audit);setReceiptIndicators(saved.indicators);setReceiptSlots(Object.fromEntries(Object.entries(saved.slots).map(([k,v])=>[k,dedupeList(v as UploadedFile[])])) as typeof saved.slots)}).finally(()=>{if(active)setReceiptStateLoaded(true)});return()=>{active=false}},[])
  useEffect(()=>{if(receiptStateLoaded)void savePersisted<SavedReceiptMotor>('recebimentos',{base:receiptBase,audit:receiptAudit,indicators:receiptIndicators,slots:receiptSlots})},[receiptStateLoaded,receiptBase,receiptAudit,receiptIndicators,receiptSlots])

  const findInSlot = (list: UploadedFile[] | undefined, file: File) => (list ?? []).find(e => e.name === file.name && e.size === file.size)
  async function distributeFiles(incoming: File[]) {
    const detections = await Promise.all(incoming.map(file => detectFile(file).then(detection => ({ file, detection }))))
    const newUploaded: UploadedFile[] = []
    const newRaw: Record<string, File> = {}
    const toProducts: Partial<Record<(typeof productSources)[number]['id'], UploadedFile>> = {}
    const toClients: Partial<Record<(typeof clientSources)[number]['id'], UploadedFile>> = {}
    const toHistory: Partial<Record<(typeof historySources)[number]['id'], UploadedFile[]>> = {}
    const toMovements: Partial<Record<(typeof movementSources)[number]['id'], UploadedFile[]>> = {}
    const toReceipts: Partial<Record<(typeof receiptSources)[number]['id'], UploadedFile[]>> = {}
    const idsToRemove: string[] = []
    for (const { file, detection } of detections) {
      const id = `${file.name}-${file.size}-${crypto.randomUUID()}`
      const now = new Date().toLocaleString('pt-BR')
      if (!detection) {
        newUploaded.push({ id, name: file.name, size: file.size, area: 'diario', receivedAt: now, lastModified: file.lastModified })
        newRaw[id] = file; continue
      }
      const { motor, slot } = detection
      if (motor === 'produtos') {
        const slotId = slot as (typeof productSources)[number]['id']
        const existing = productSlots[slotId]; if (existing) idsToRemove.push(existing.id)
        const uploaded: UploadedFile = { id, name: file.name, size: file.size, area: 'produtos', receivedAt: now, lastModified: file.lastModified }
        toProducts[slotId] = uploaded; newUploaded.push(uploaded); newRaw[id] = file
      } else if (motor === 'clientes') {
        const slotId = slot as (typeof clientSources)[number]['id']
        const existing = clientSlots[slotId]; if (existing) idsToRemove.push(existing.id)
        const uploaded: UploadedFile = { id, name: file.name, size: file.size, area: 'clientes', receivedAt: now, lastModified: file.lastModified }
        toClients[slotId] = uploaded; newUploaded.push(uploaded); newRaw[id] = file
      } else if (motor === 'historico') {
        const slotId = slot as (typeof historySources)[number]['id']
        const dupe = findInSlot(historySlots[slotId], file) ?? findInSlot(toHistory[slotId], file)
        if (dupe) { newRaw[dupe.id] = file; continue } // re-envio: restaura rawFile sem duplicar metadado
        const uploaded: UploadedFile = { id, name: file.name, size: file.size, area: 'historico', receivedAt: now, lastModified: file.lastModified }
        if (!toHistory[slotId]) toHistory[slotId] = []; toHistory[slotId]!.push(uploaded); newUploaded.push(uploaded); newRaw[id] = file
      } else if (motor === 'movimentacoes') {
        const slotId = slot as (typeof movementSources)[number]['id']
        const dupe = findInSlot(movementSlots[slotId], file) ?? findInSlot(toMovements[slotId], file)
        if (dupe) { newRaw[dupe.id] = file; continue }
        const uploaded: UploadedFile = { id, name: file.name, size: file.size, area: 'movimentacoes', receivedAt: now, lastModified: file.lastModified }
        if (!toMovements[slotId]) toMovements[slotId] = []; toMovements[slotId]!.push(uploaded); newUploaded.push(uploaded); newRaw[id] = file
      } else if (motor === 'recebimentos') {
        const slotId = slot as (typeof receiptSources)[number]['id']
        const dupe = findInSlot(receiptSlots[slotId], file) ?? findInSlot(toReceipts[slotId], file)
        if (dupe) { newRaw[dupe.id] = file; continue }
        const uploaded: UploadedFile = { id, name: file.name, size: file.size, area: 'recebimentos', receivedAt: now, lastModified: file.lastModified }
        if (!toReceipts[slotId]) toReceipts[slotId] = []; toReceipts[slotId]!.push(uploaded); newUploaded.push(uploaded); newRaw[id] = file
      }
    }
    if (!newUploaded.length && !idsToRemove.length && !Object.keys(newRaw).length) return
    if (newUploaded.length || idsToRemove.length) setFiles(current => [...current.filter(f => !idsToRemove.includes(f.id)), ...newUploaded])
    setRawFiles(current => { const next = { ...current }; for (const id of idsToRemove) delete next[id]; return { ...next, ...newRaw } })
    if (Object.keys(toProducts).length) setProductSlots(current => ({ ...current, ...toProducts }))
    if (Object.keys(toClients).length) setClientSlots(current => ({ ...current, ...toClients }))
    if (Object.keys(toHistory).length) setHistorySlots(current => { const next = { ...current }; for (const [k, v] of Object.entries(toHistory) as [typeof historySources[number]['id'], UploadedFile[]][]) next[k] = [...(current[k] ?? []), ...v]; return next })
    if (Object.keys(toMovements).length) setMovementSlots(current => { const next = { ...current }; for (const [k, v] of Object.entries(toMovements) as [typeof movementSources[number]['id'], UploadedFile[]][]) next[k] = [...(current[k] ?? []), ...v]; return next })
    if (Object.keys(toReceipts).length) setReceiptSlots(current => { const next = { ...current }; for (const [k, v] of Object.entries(toReceipts) as [typeof receiptSources[number]['id'], UploadedFile[]][]) next[k] = [...(current[k] ?? []), ...v]; return next })
  }
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
  function historySourceChange(source: (typeof historySources)[number]['id'], event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []); event.target.value = ''
    if (!incoming.length) return
    const uploaded = incoming.map(file => ({ id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area: 'historico' as const, receivedAt: new Date().toLocaleString('pt-BR'), lastModified: file.lastModified }))
    setFiles(current => [...current, ...uploaded])
    setRawFiles(current => ({ ...current, ...Object.fromEntries(uploaded.map((item, index) => [item.id, incoming[index]])) }))
    setHistorySlots(current => ({ ...current, [source]: [...(current[source] ?? []), ...uploaded] }))
  }
  function movementSourceChange(source: (typeof movementSources)[number]['id'], event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []); event.target.value = ''
    if (!incoming.length) return
    const uploaded = incoming.map(file => ({ id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area: 'movimentacoes' as const, receivedAt: new Date().toLocaleString('pt-BR'), lastModified: file.lastModified }))
    setFiles(current => [...current, ...uploaded])
    setRawFiles(current => ({ ...current, ...Object.fromEntries(uploaded.map((item, index) => [item.id, incoming[index]])) }))
    setMovementSlots(current => ({ ...current, [source]: [...(current[source] ?? []), ...uploaded] }))
  }
  function receiptSourceChange(source: (typeof receiptSources)[number]['id'], event: ChangeEvent<HTMLInputElement>) { const incoming=Array.from(event.target.files??[]);event.target.value='';if(!incoming.length)return;const uploaded=incoming.map(file=>({id:`${file.name}-${file.size}-${crypto.randomUUID()}`,name:file.name,size:file.size,area:'recebimentos' as const,receivedAt:new Date().toLocaleString('pt-BR'),lastModified:file.lastModified}));setFiles(current=>[...current,...uploaded]);setRawFiles(current=>({...current,...Object.fromEntries(uploaded.map((item,index)=>[item.id,incoming[index]]))}));setReceiptSlots(current=>({...current,[source]:[...(current[source]??[]),...uploaded]})) }
  function drop(area: SourceArea, event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(area, event.dataTransfer.files) }
  function removeFile(id: string) { setFiles(current => current.filter(file => file.id !== id)); setRawFiles(current => { const next = { ...current }; delete next[id]; return next }) }
  function removeHistoryFile(id: string) { removeFile(id); setHistorySlots(current => Object.fromEntries(Object.entries(current).map(([source, files]) => [source, files?.filter(file => file.id !== id)]))) }
  function removeMovementFile(id: string) { removeFile(id); setMovementSlots(current => Object.fromEntries(Object.entries(current).map(([source, files]) => [source, files?.filter(file => file.id !== id)]))) }
  function removeReceiptFile(id:string){removeFile(id);setReceiptSlots(current=>Object.fromEntries(Object.entries(current).map(([source,files])=>[source,files?.filter(file=>file.id!==id)])))}
  function removeProductSlotFile(slotId: (typeof productSources)[number]['id'], fileId: string) { removeFile(fileId); setProductSlots(current => { const next = {...current}; delete next[slotId]; return next }) }
  function removeClientSlotFile(slotId: (typeof clientSources)[number]['id'], fileId: string) { removeFile(fileId); setClientSlots(current => { const next = {...current}; delete next[slotId]; return next }) }
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
  async function processHistory() {
    const selected = Object.values(historySlots).flat().map(file => rawFiles[file.id]).filter((file): file is File => Boolean(file)); if (!selected.length) return
    setHistoryProcessing(true); setHistoryAudit([])
    try { const result = await processHistoryMotor(selected); setHistoryBase(result.canonicalBase); setHistoryAudit(result.audit); setHistoryIndicators(result.indicators) }
    catch { setHistoryAudit([{ id: 'history-read-error', level: 'action', title: 'Não foi possível ler os arquivos', instruction: 'Confira os arquivos e tente novamente.', detail: 'A base histórica não foi alterada.', area: 'historico' }]); setHistoryBase([]); setHistoryIndicators(null) }
    finally { setHistoryProcessing(false) }
  }
  async function processMovements() {
    const selected = Object.values(movementSlots).flat().map(file => rawFiles[file.id]).filter((file): file is File => Boolean(file)); if (!selected.length) return
    setMovementProcessing(true); setMovementAudit([])
    try { const result = await processMovementMotor(selected); setMovementBase(result.canonicalBase); setMovementAudit(result.audit); setMovementIndicators(result.indicators) }
    catch { setMovementAudit([{ id: 'movement-read-error', level: 'action', title: 'Não foi possível ler os arquivos', instruction: 'Confira os arquivos e tente novamente.', detail: 'A base de movimentações não foi alterada.', area: 'movimentacoes' }]); setMovementBase([]); setMovementIndicators(null) }
    finally { setMovementProcessing(false) }
  }
  async function processReceipts(){const selected=Object.values(receiptSlots).flat().map(file=>rawFiles[file.id]).filter((file):file is File=>Boolean(file));if(!selected.length)return;setReceiptProcessing(true);setReceiptAudit([]);try{const result=await processReceiptMotor(selected);setReceiptBase(result.canonicalBase);setReceiptAudit(result.audit);setReceiptIndicators(result.indicators)}catch{setReceiptAudit([{id:'receipt-read-error',level:'action',title:'Não foi possível ler os arquivos',instruction:'Confira os arquivos e tente novamente.',detail:'A base de chegada de notas não foi alterada.',area:'recebimentos'}]);setReceiptBase([]);setReceiptIndicators(null)}finally{setReceiptProcessing(false)}}
  async function processAll() {
    setProcessingAll(true)
    const toRun: Promise<void>[] = []
    if (Object.values(productSlots).some(f => f && rawFiles[f.id])) toRun.push(processProducts())
    if (Object.values(clientSlots).some(f => f && rawFiles[f.id])) toRun.push(processClients())
    if (Object.values(historySlots).flat().some(f => rawFiles[f.id])) toRun.push(processHistory())
    if (Object.values(movementSlots).flat().some(f => rawFiles[f.id])) toRun.push(processMovements())
    if (Object.values(receiptSlots).flat().some(f => rawFiles[f.id])) toRun.push(processReceipts())
    await Promise.all(toRun)
    setProcessingAll(false)
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
  function downloadProductExcel() {
    const records = productBase.map(product => ({ Agrupamento: product.groupName ?? '', Família: product.groupFamily ?? '', Código: product.internalCode ?? '', 'Código fabricante': product.manufacturerCode ?? '', EAN: product.ean ?? '', Descrição: product.description ?? '', Embalagem: product.package ?? '', Marca: product.brand ?? '', Categoria: product.category ?? '', Subcategoria: product.subcategory ?? '', 'Unidades por caixa': product.unitsPerBox ?? '', Disponível: product.availableStock ?? '', Estoque: product.totalStock ?? '', Reservado: product.reservedStock ?? '', Bloqueado: product.blockedStock ?? '', Avariado: product.damagedStock ?? '', Preço: product.sellerPrice ?? '', 'Preço sem imposto': product.sellerPriceWithoutTax ?? '', 'Quantidade em carteira': product.inTransitQuantity ?? '', 'Valor em carteira': product.inTransitValue ?? '', Status: product.status, 'Status sortimento': product.sortimentStatus ?? '', 'Ciclo de vida': product.lifestageStatus ?? '', Departamento: product.department ?? '', Linha: product.productLine ?? '', Comprador: product.buyer ?? '', Fornecedor: product.supplierName ?? '', 'Custo real': product.realCost ?? '', 'Custo financeiro': product.financialCost ?? '', 'Venda mês': product.monthlySales ?? '', 'Giro diário': product.dailyTurnover ?? '', 'Preço de referência da indústria': product.industryBasePrice ?? '', 'Peso líquido unitário': product.netWeightUnit ?? '' }))
    const essential = new Set(['Agrupamento', 'Família', 'Código', 'Descrição', 'Status'])
    const meaningful = (value: unknown) => typeof value === 'number' ? value !== 0 : String(value ?? '').trim() !== ''
    const columns = Object.keys(records[0] ?? {}).filter(column => essential.has(column) || records.some(record => meaningful(record[column as keyof typeof record])))
    const sheet = XLSX.utils.json_to_sheet(records.map(record => Object.fromEntries(columns.map(column => [column, record[column as keyof typeof record]]))))
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Produtos'); XLSX.writeFile(book, 'base-canonica-produtos.xlsx')
  }
  function downloadHistoryBase() { const url = URL.createObjectURL(new Blob([JSON.stringify(historyBase, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'base-canonica-historico.json'; link.click(); URL.revokeObjectURL(url) }
  function downloadHistoryExcel() {
    const rows = historyBase.map(record => ({ Data: record.date, Competência: record.competence, Nota: record.invoiceNumber ?? '', Sistema: 'Legado', Cliente: record.customerCode, Produto: record.productCode, Vendedor: record.sellerCode ?? '', Quantidade: record.quantity, Valor: record.salesValue, Desconto: record.discount, 'Valor líquido': record.netValue }))
    const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = Object.keys(rows[0] ?? {}).map(header => ({ wch: Math.max(14, header.length + 4) }))
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Histórico'); XLSX.writeFile(book, 'base-canonica-historico.xlsx')
  }
  function downloadMovementBase() { const url = URL.createObjectURL(new Blob([JSON.stringify(movementBase, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'base-canonica-movimentacoes.json'; link.click(); URL.revokeObjectURL(url) }
  function downloadMovementExcel() {
    const rows = movementBase.map(record => ({ Data: record.movementDate ?? '', Movimento: record.movementType, Pedido: record.orderId ?? '', Nota: record.invoiceNumber ?? '', Cliente: record.customerCode ?? '', CNPJ: record.customerDocument ?? '', 'Nome cliente': record.customerName ?? '', Produto: record.productCode ?? '', 'Código fabricante': record.manufacturerCode ?? '', Descrição: record.description ?? '', Quantidade: record.quantity ?? '', Valor: record.value ?? '', 'Status pedido': record.orderStatus ?? '', 'Tipo venda': record.saleType ?? '', 'Código vendedor': record.sellerCode ?? '', Vendedor: record.seller ?? '', Fornecedor: record.supplierName ?? '', 'Preço unitário': record.unitPrice ?? '', 'Custo financeiro atual': record.currentFinancialCost ?? '', 'Precisa redigitar': record.needsRetyping === undefined ? '' : record.needsRetyping ? 'Sim' : 'Não' }))
    const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = Object.keys(rows[0] ?? {}).map(header => ({ wch: Math.max(14, header.length + 4) }))
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Movimentações'); XLSX.writeFile(book, 'base-canonica-movimentacoes.xlsx')
  }
  function downloadReceiptBase(){const url=URL.createObjectURL(new Blob([JSON.stringify(receiptBase,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='base-canonica-chegada-notas.json';link.click();URL.revokeObjectURL(url)}
  function downloadReceiptExcel(){const rows=receiptBase.map(r=>({Status:r.status==='recebida'?'Recebida':'Em trânsito',Sistema:r.system,'Data entrada':r.entryDate??'',Nota:r.invoice??'',Fornecedor:r.supplierName??'',Produto:r.productCode??'',Descrição:r.description??'',Quantidade:r.quantity??'',Valor:r.value??'', 'Custo financeiro':r.financialCost??''}));const sheet=XLSX.utils.json_to_sheet(rows);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Chegada de notas');XLSX.writeFile(book,'base-canonica-chegada-notas.xlsx')}
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
        <div className="quick-upload" role="button" tabIndex={0} onClick={() => dailyInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void distributeFiles(Array.from(event.dataTransfer.files)) }}><strong>Solte todos os arquivos aqui</strong><span>ou escolha os arquivos</span><input ref={dailyInput} aria-label="Adicionar arquivos diários" type="file" multiple onChange={event => { if (event.target.files) void distributeFiles(Array.from(event.target.files)); event.target.value = '' }} /></div>
        {(Object.values(productSlots).some(f => f && rawFiles[f.id]) || Object.values(clientSlots).some(f => f && rawFiles[f.id]) || Object.values(historySlots).flat().some(f => rawFiles[f.id]) || Object.values(movementSlots).flat().some(f => rawFiles[f.id]) || Object.values(receiptSlots).flat().some(f => rawFiles[f.id])) ? <button className="process-button" type="button" disabled={processingAll || productProcessing || clientProcessing || historyProcessing || movementProcessing || receiptProcessing} onClick={() => void processAll()} style={{marginBottom: '16px'}}>{processingAll ? 'Processando todos os motores…' : 'Processar todos os motores'}</button> : null}
        <FileList files={filesIn('diario')} onRemove={removeFile} />
        <h2 className="section-title">MOTORES</h2>
        <div className="motor-grid">{motors.map(motor => <article className="motor-card" key={motor.id}><h3>{motor.name}</h3>{motor.id === 'produtos' ? <><div className="client-source-list">{productSources.map(source => { const uploaded = productSlots[source.id]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong>{uploaded ? <small style={{display:'flex',gap:'6px',alignItems:'center'}}>{uploaded.name} <button type="button" style={{border:0,background:'none',color:'var(--red)',fontWeight:700,padding:0,cursor:'pointer'}} onClick={()=>removeProductSlotFile(source.id, uploaded.id)}>Remover</button></small> : <small>Ainda não enviado</small>}</span><label className="source-upload">Adicionar arquivo<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" onChange={event => productSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={productProcessing || !Object.values(productSlots).some(file => file && rawFiles[file.id])} onClick={processProducts}>{productProcessing ? 'Conferindo arquivos' : 'Criar base de produtos'}</button>{productIndicators ? <div className="indicators"><span>{productIndicators.total.toLocaleString('pt-BR')} produtos</span><span>{productIndicators.inTransit.toLocaleString('pt-BR')} em trânsito</span><button type="button" onClick={downloadProductBase}>Baixar JSON</button><button type="button" onClick={downloadProductExcel}>Baixar Excel</button></div> : null}</> : motor.id === 'clientes' ? <><div className="client-source-list">{clientSources.map(source => { const uploaded = clientSlots[source.id]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong>{uploaded ? <small style={{display:'flex',gap:'6px',alignItems:'center'}}>{uploaded.name} <button type="button" style={{border:0,background:'none',color:'var(--red)',fontWeight:700,padding:0,cursor:'pointer'}} onClick={()=>removeClientSlotFile(source.id, uploaded.id)}>Remover</button></small> : <small>Ainda não enviado</small>}</span><label className="source-upload">Adicionar arquivo<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" onChange={event => clientSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={clientProcessing || !Object.values(clientSlots).some(file => file && rawFiles[file.id])} onClick={processClients}>{clientProcessing ? 'Conferindo arquivos' : 'Criar base de clientes'}</button>{clientIndicators ? <div className="indicators"><span>{clientIndicators.totalClients.toLocaleString('pt-BR')} clientes</span><span>{clientIndicators.complete.toLocaleString('pt-BR')} completos</span><button type="button" onClick={downloadClientBase}>Baixar JSON</button><button type="button" onClick={downloadClientExcel}>Baixar Excel</button></div> : null}</> : motor.id === 'historico' ? <><div className="client-source-list">{historySources.map(source => { const uploaded = historySlots[source.id] ?? []; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong>{uploaded.length ? uploaded.map(file => <small key={file.id} style={{display:'flex',gap:'6px',alignItems:'center'}}>{file.name} <button type="button" style={{border:0,background:'none',color:'var(--red)',fontWeight:700,padding:0,cursor:'pointer'}} onClick={()=>removeHistoryFile(file.id)}>Remover</button></small>) : <small>{source.id === 'summary' ? 'Opcional' : 'Ainda não enviado'}</small>}</span><label className="source-upload">Adicionar arquivo<input aria-label={`Adicionar ${source.label}`} type="file" accept=".txt" multiple onChange={event => historySourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={historyProcessing || !Object.values(historySlots).flat().some(file => rawFiles[file.id])} onClick={processHistory}>{historyProcessing ? 'Conferindo arquivos' : 'Criar base histórica'}</button>{historyIndicators ? <div className="indicators"><span>{historyIndicators.competencies.toLocaleString('pt-BR')} competências</span><span>{historyIndicators.salesLines.toLocaleString('pt-BR')} vendas</span><button type="button" onClick={downloadHistoryBase}>Baixar JSON</button><button type="button" onClick={downloadHistoryExcel}>Baixar Excel</button></div> : null}</> : motor.id === 'movimentacoes' ? <><div className="client-source-list">{movementSources.map(source => { const uploaded = movementSlots[source.id] ?? []; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong>{uploaded.length ? uploaded.map(file => <small key={file.id} style={{display:'flex',gap:'6px',alignItems:'center'}}>{file.name} <button type="button" style={{border:0,background:'none',color:'var(--red)',fontWeight:700,padding:0,cursor:'pointer'}} onClick={()=>removeMovementFile(file.id)}>Remover</button></small>) : <small>Ainda não enviado</small>}</span><label className="source-upload">Adicionar arquivo<input aria-label={`Adicionar ${source.label}`} type="file" accept=".xls,.xlsx" multiple onChange={event => movementSourceChange(source.id, event)} /></label></div> })}</div><button className="process-button" type="button" disabled={movementProcessing || !Object.values(movementSlots).flat().some(file => rawFiles[file.id])} onClick={processMovements}>{movementProcessing ? 'Conferindo arquivos' : 'Criar base de movimentações'}</button>{movementIndicators ? <div className="indicators"><span>{movementIndicators.sales.toLocaleString('pt-BR')} vendas faturadas</span><span>{movementIndicators.pendingRetyping.toLocaleString('pt-BR')} para redigitar</span><button type="button" onClick={downloadMovementBase}>Baixar JSON</button><button type="button" onClick={downloadMovementExcel}>Baixar Excel</button></div> : null}</> : <><button type="button" className="add-button" onClick={() => motorInputs.current[motor.id]?.click()}>Adicionar arquivos</button><input ref={element => { motorInputs.current[motor.id] = element }} aria-label={`Adicionar arquivos de ${motor.name}`} type="file" multiple onChange={event => fileChange(motor.id, event)} /><FileList files={filesIn(motor.id)} onRemove={removeFile} compact /></>}</article>)}</div>
        <article className="motor-card"><h3>Chegada de notas</h3><div className="client-source-list">{receiptSources.map(source => { const uploaded=receiptSlots[source.id]??[]; return <div className="client-source" key={source.id}><span><strong>{source.label}</strong>{uploaded.length ? uploaded.map(file=><small key={file.id} style={{display:'flex',gap:'6px',alignItems:'center'}}>{file.name} <button type="button" style={{border:0,background:'none',color:'var(--red)',fontWeight:700,padding:0,cursor:'pointer'}} onClick={()=>removeReceiptFile(file.id)}>Remover</button></small>) : <small>Ainda não enviado</small>}</span><label className="source-upload">Adicionar arquivo<input type="file" multiple accept={source.id==='legacy'?'.txt':'.xls,.xlsx'} onChange={event=>receiptSourceChange(source.id,event)} /></label></div>})}</div><button className="process-button" type="button" disabled={receiptProcessing||!Object.values(receiptSlots).flat().some(file=>rawFiles[file.id])} onClick={processReceipts}>{receiptProcessing?'Conferindo arquivos':'Criar base de chegada'}</button>{receiptIndicators?<div className="indicators"><span>{receiptIndicators.received.toLocaleString('pt-BR')} recebimentos</span><span>{receiptIndicators.inTransit.toLocaleString('pt-BR')} em trânsito</span><button type="button" onClick={downloadReceiptBase}>Baixar JSON</button><button type="button" onClick={downloadReceiptExcel}>Baixar Excel</button></div>:null}</article>
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
