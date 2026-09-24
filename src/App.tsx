import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react'
import { buildAiAuditJson, buildAudit } from './domain/audit'
import type { AuditItem, SourceArea, UploadedFile } from './domain/types'

const motors: Array<{ id: Exclude<SourceArea, 'diario'>; name: string }> = [
  { id: 'produtos', name: 'Produtos' },
  { id: 'clientes', name: 'Clientes' },
  { id: 'movimentacoes', name: 'Movimentações' },
  { id: 'historico', name: 'Histórico' },
]

const areaName: Record<SourceArea, string> = { diario: 'Diários', produtos: 'Produtos', clientes: 'Clientes', movimentacoes: 'Movimentações', historico: 'Histórico' }

function fileSize(size: number) { return size < 1_000_000 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1_000_000).toFixed(1)} MB` }

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [tab, setTab] = useState<'uploads' | 'auditoria'>('uploads')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [activeNotice, setActiveNotice] = useState<AuditItem | null>(null)
  const dailyInput = useRef<HTMLInputElement>(null)
  const motorInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const audit = useMemo(() => buildAudit(files), [files])

  function addFiles(area: SourceArea, incoming: FileList | File[]) {
    const next = Array.from(incoming).map(file => ({ id: `${file.name}-${file.size}-${crypto.randomUUID()}`, name: file.name, size: file.size, area, receivedAt: new Date().toLocaleString('pt-BR') }))
    setFiles(current => [...current, ...next])
  }
  function fileChange(area: SourceArea, event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(area, event.target.files); event.target.value = '' }
  function drop(area: SourceArea, event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(area, event.dataTransfer.files) }
  function removeFile(id: string) { setFiles(current => current.filter(file => file.id !== id)) }
  function downloadAiJson() {
    const body = JSON.stringify(buildAiAuditJson(files, audit), null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auditoria-blue-jacket.json'; link.click(); URL.revokeObjectURL(url)
  }
  const filesIn = (area: SourceArea) => files.filter(file => file.area === area)

  return <div className={`app theme-${theme}`}>
    <aside className="sidebar"><div className="brand">BLUE JACKET</div><button className="nav-item active" type="button">Administração</button><div className="sidebar-bottom"><button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button></div></aside>
    <main className="main">
      <header className="topbar"><h1>ADMINISTRAÇÃO</h1><nav className="tabs" aria-label="Administração"><button className={tab === 'uploads' ? 'selected' : ''} onClick={() => setTab('uploads')} type="button">Uploads</button><button className={tab === 'auditoria' ? 'selected' : ''} onClick={() => setTab('auditoria')} type="button">Auditoria</button></nav></header>
      {tab === 'uploads' ? <section className="content">
        <h2>ARQUIVOS DIÁRIOS</h2>
        <div className="quick-upload" role="button" tabIndex={0} onClick={() => dailyInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => drop('diario', event)}><strong>Solte todos os arquivos aqui</strong><span>ou escolha os arquivos</span><input ref={dailyInput} aria-label="Adicionar arquivos diários" type="file" multiple onChange={event => fileChange('diario', event)} /></div>
        <FileList files={filesIn('diario')} onRemove={removeFile} />
        <h2 className="section-title">MOTORES</h2>
        <div className="motor-grid">{motors.map(motor => <article className="motor-card" key={motor.id}><h3>{motor.name}</h3><button type="button" className="add-button" onClick={() => motorInputs.current[motor.id]?.click()}>Adicionar arquivos</button><input ref={element => { motorInputs.current[motor.id] = element }} aria-label={`Adicionar arquivos de ${motor.name}`} type="file" multiple onChange={event => fileChange(motor.id, event)} /><FileList files={filesIn(motor.id)} onRemove={removeFile} compact /></article>)}</div>
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
