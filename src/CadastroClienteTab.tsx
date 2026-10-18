import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CanonicalClient } from './domain/clientMotor'
import type { CanonicalMovement } from './domain/movementMotor'

const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(2)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}
const brlFull = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d }

const today = new Date().toISOString().slice(0, 10)
function daysSince(dateStr: string): number {
  if (!dateStr) return -1
  const diff = new Date(today).getTime() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

const MOV_LABEL: Partial<Record<string, string>> = {
  venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução',
  bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada',
}

interface CadastroRow {
  document: string
  code: string
  name: string
  legalName: string
  city: string
  district: string
  address: string
  network: string
  range: string
  cluster: string
  channel: string
  profile: string
  rcaCode: string
  rcaName: string
  supervisor: string
  branch: string
  billingType: string
  visitFrequency: string
  visitDay: string
  premiseAvg12m: number | undefined
  routed: boolean
  hasCadastro: boolean
  sources: string[]
  fatTotal: number
  avgMensal: number
  mesesComDados: number
  fatTotal3m: number
  avgMonth3m: number
  lastPurchaseDate: string
  daysSincePurchase: number
  monthsWithPurchase: number
  purchasedEveryMonth: boolean
}

export function CadastroClienteTab({ clientBase, movementBase, activeComp, pexSet, onPexChange }: {
  clientBase: CanonicalClient[]
  movementBase: CanonicalMovement[]
  activeComp: string
  pexSet: Set<string>
  onPexChange: (s: Set<string>) => void
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterPex, setFilterPex] = useState<string[]>([])
  const [filterRange, setFilterRange] = useState<string[]>([])
  const [filterNetwork, setFilterNetwork] = useState<string[]>([])
  const [filterRouted, setFilterRouted] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [pexText, setPexText] = useState('')
  const [showPexUpload, setShowPexUpload] = useState(false)

  useEffect(() => {
    if (!openFilter) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.pf-filter-drop')) setOpenFilter(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openFilter])

  const { y, mo, monthEnd } = useMemo(() => {
    const [y, mo] = activeComp.split('-').map(Number)
    const now = new Date()
    const curComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = activeComp >= curComp
      ? now.toISOString().slice(0, 10)
      : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`
    return { y, mo, monthEnd }
  }, [activeComp])

  const threeMonthRange = useMemo(() => {
    const d = new Date(y, mo - 1, 1)
    d.setMonth(d.getMonth() - 2)
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { start, end: monthEnd }
  }, [y, mo, monthEnd])

  const threeMonths = useMemo(() => {
    const months: string[] = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(y, mo - 1 - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }, [y, mo])

  const movsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    for (const m of movementBase) {
      const key = m.customerCode ?? m.customerDocument
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return map
  }, [movementBase])

  const rows = useMemo<CadastroRow[]>(() => {
    return clientBase.map(c => {
      const code = c.winthorCode ?? c.document
      const allMovs = movsByCustomer.get(code) ?? movsByCustomer.get(c.document) ?? []
      const movs3m = allMovs.filter(m => { const d = m.movementDate ?? ''; return d >= threeMonthRange.start && d <= threeMonthRange.end })

      let fatTotal3m = 0
      for (const m of movs3m) {
        if (m.movementType === 'venda_faturada') fatTotal3m += m.value ?? 0
        else if (m.movementType === 'devolucao') fatTotal3m -= m.value ?? 0
      }

      let fatTotal = 0
      let lastPurchaseDate = ''
      const activeMonths = new Set<string>()
      for (const m of allMovs) {
        const d = m.movementDate ?? ''
        if (d > lastPurchaseDate && m.movementType === 'venda_faturada') lastPurchaseDate = d
        if (m.movementType === 'venda_faturada') { fatTotal += m.value ?? 0; if (d) activeMonths.add(d.slice(0, 7)) }
        else if (m.movementType === 'devolucao') fatTotal -= m.value ?? 0
      }
      const mesesComDados = activeMonths.size || 1

      const purchaseMonths = new Set<string>()
      for (const m of movs3m) {
        if (m.movementType === 'venda_faturada' && m.movementDate) {
          purchaseMonths.add(m.movementDate.slice(0, 7))
        }
      }
      const monthsWithPurchase = threeMonths.filter(mo => purchaseMonths.has(mo)).length

      return {
        document: c.document,
        code,
        name: c.tradeName ?? c.legalName ?? c.document,
        legalName: c.legalName ?? '',
        city: c.city ?? '',
        district: c.district ?? '',
        address: c.address ?? '',
        network: c.premiseNetwork ?? '',
        range: c.premiseRange ?? '',
        cluster: c.premiseCluster ?? '',
        channel: c.channelType ?? '',
        profile: c.premiseProfile ?? '',
        rcaCode: c.rcaCode ?? '',
        rcaName: c.rcaName ?? '',
        supervisor: c.supervisor ?? '',
        branch: c.branch ?? '',
        billingType: c.billingType ?? '',
        visitFrequency: c.visitFrequency ?? '',
        visitDay: c.visitDay ?? '',
        premiseAvg12m: c.premiseAverage12Months,
        routed: !!(c.visitFrequency || c.visitDay),
        hasCadastro: c.sources.includes('Cadastro interno'),
        sources: c.sources,
        fatTotal,
        avgMensal: fatTotal / mesesComDados,
        mesesComDados,
        fatTotal3m,
        avgMonth3m: fatTotal3m / 3,
        lastPurchaseDate,
        daysSincePurchase: daysSince(lastPurchaseDate),
        monthsWithPurchase,
        purchasedEveryMonth: monthsWithPurchase === 3,
      }
    }).sort((a, b) => b.fatTotal3m - a.fatTotal3m)
  }, [clientBase, movsByCustomer, threeMonthRange, threeMonths])

  const availableRanges = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.range) set.add(r.range)
    return [...set].sort()
  }, [rows])

  const availableNetworks = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.network) set.add(r.network)
    return [...set].sort()
  }, [rows])

  const q = search.toLowerCase()
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (q && !r.document.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !r.legalName.toLowerCase().includes(q) && !r.network.toLowerCase().includes(q) && !r.city.toLowerCase().includes(q) && !r.rcaCode.toLowerCase().includes(q) && !r.rcaName.toLowerCase().includes(q)) return false
      const isPex = pexSet.has(r.document)
      if (filterPex.length > 0) {
        const want = filterPex[0]
        if (want === 'PEX' && !isPex) return false
        if (want === 'Não PEX' && isPex) return false
      }
      if (filterRange.length > 0 && !filterRange.includes(r.range)) return false
      if (filterNetwork.length > 0 && !filterNetwork.includes(r.network)) return false
      if (filterRouted.length > 0) {
        const want = filterRouted[0]
        if (want === 'Sim' && !r.routed) return false
        if (want === 'Não' && r.routed) return false
      }
      return true
    })
  }, [rows, q, pexSet, filterPex, filterRange, filterNetwork, filterRouted])

  const handlePexUpload = useCallback(() => {
    const docs = pexText.split(/[\n,;]+/).map(s => s.replace(/\D/g, '')).filter(d => d.length === 11 || d.length === 14)
    if (!docs.length) return
    const next = new Set(pexSet); for (const d of docs) next.add(d)
    onPexChange(next)
    setPexText('')
    setShowPexUpload(false)
  }, [pexText, pexSet, onPexChange])

  const togglePex = useCallback((doc: string) => {
    const next = new Set(pexSet); if (next.has(doc)) next.delete(doc); else next.add(doc)
    onPexChange(next)
  }, [pexSet, onPexChange])

  const selectedRow = useMemo(() => expanded ? rows.find(r => r.document === expanded) : undefined, [expanded, rows])

  const history = useMemo(() => {
    if (!expanded || !selectedRow) return []
    const movs = movsByCustomer.get(selectedRow.code) ?? movsByCustomer.get(expanded) ?? []
    return [...movs].sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? ''))
  }, [expanded, selectedRow, movsByCustomer])

  return (
    <section className="content">
      {/* Toolbar */}
      <div className="stock-toolbar">
        <div className="pf-bar">
          <input
            className="pf-input"
            placeholder="Buscar por CNPJ, código, nome, rede, cidade, vendedor…"
            value={search}
            onChange={e => { setSearch(e.target.value); setExpanded(null) }}
          />
          <button
            type="button"
            className="pf-select"
            style={{ minWidth: 'auto', padding: '0 14px', cursor: 'pointer', background: showPexUpload ? 'var(--red)' : undefined, color: showPexUpload ? '#fff' : undefined, border: showPexUpload ? '1px solid var(--red)' : undefined }}
            onClick={() => setShowPexUpload(v => !v)}
          >
            {showPexUpload ? 'Fechar' : 'Importar PEX'}
          </button>
        </div>

        {showPexUpload && (
          <div className="cad-upload-area">
            <textarea
              className="cad-upload-textarea"
              placeholder="Cole aqui os CNPJs (um por linha, separados por vírgula ou ponto-e-vírgula)…"
              value={pexText}
              onChange={e => setPexText(e.target.value)}
              rows={4}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="cad-pex-btn" onClick={handlePexUpload}>Marcar como PEX</button>
              {pexSet.size > 0 && <small style={{ color: 'var(--muted)' }}>{pexSet.size} cliente{pexSet.size !== 1 ? 's' : ''} marcado{pexSet.size !== 1 ? 's' : ''} como PEX</small>}
              {pexSet.size > 0 && <button type="button" className="cad-pex-clear" onClick={() => onPexChange(new Set())}>Limpar PEX</button>}
            </div>
          </div>
        )}

        <div className="pf-filters-row">
          <FilterDrop label="PEX" options={['PEX', 'Não PEX']} selected={filterPex} onSelect={v => { setFilterPex(v); setExpanded(null) }} single open={openFilter === 'pex'} onToggle={() => setOpenFilter(openFilter === 'pex' ? null : 'pex')} />
          {availableRanges.length > 0 && (
            <FilterDrop label="Faixa" options={availableRanges} selected={filterRange} onSelect={v => { setFilterRange(v); setExpanded(null) }} open={openFilter === 'range'} onToggle={() => setOpenFilter(openFilter === 'range' ? null : 'range')} />
          )}
          {availableNetworks.length > 0 && (
            <FilterDrop label="Rede" options={availableNetworks} selected={filterNetwork} onSelect={v => { setFilterNetwork(v); setExpanded(null) }} open={openFilter === 'network'} onToggle={() => setOpenFilter(openFilter === 'network' ? null : 'network')} />
          )}
          <FilterDrop label="Roteirizado" options={['Sim', 'Não']} selected={filterRouted} onSelect={v => { setFilterRouted(v); setExpanded(null) }} single open={openFilter === 'routed'} onToggle={() => setOpenFilter(openFilter === 'routed' ? null : 'routed')} />
        </div>
      </div>

      {/* Count */}
      <div className="stock-count">
        <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
        cliente{filtered.length !== 1 ? 's' : ''}
        {rows.length !== filtered.length && ` de ${rows.length.toLocaleString('pt-BR')}`}
        {pexSet.size > 0 && <span style={{ marginLeft: 12, color: 'var(--red)', fontWeight: 700 }}>{pexSet.size} PEX</span>}
      </div>

      {/* Layout: list + side panel */}
      <div className={`cad-layout${expanded ? ' has-detail' : ''}`}>
        {/* List */}
        <div className="stock-list stock-list--cadastro">
          <div className="stock-head">
            <span>Cliente</span>
            <span className="sc-num">Fat. 3 Meses</span>
            <span className="sc-num">Dias s/ compra</span>
          </div>
          {filtered.length === 0 && (
            <p className="empty" style={{ padding: '24px 16px', color: 'var(--muted)', textAlign: 'center' }}>Nenhum cliente encontrado.</p>
          )}
          {filtered.map(r => {
            const isSelected = expanded === r.document
            const isPex = pexSet.has(r.document)
            return (
              <div
                key={r.document}
                className={`stock-row${isSelected ? ' sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isSelected ? null : r.document)}
                onKeyDown={e => e.key === 'Enter' && setExpanded(isSelected ? null : r.document)}
              >
                <span className="sc-desc">
                  <span className="p-name">{r.name}</span>
                  <span className="p-meta" style={{ gap: 6, marginTop: 2 }}>
                    <code>{r.code}</code>
                    <span style={{ color: 'var(--muted)' }}>{r.document}</span>
                    {r.city && <span>{r.city}</span>}
                  </span>
                  <span className="p-meta" style={{ gap: 5, marginTop: 3 }}>
                    {isPex && <span className="badge-pex">PEX</span>}
                    {r.range && <span className="cad-badge-range">Faixa {r.range}</span>}
                    {r.network && <span className="cad-badge-net">{r.network}</span>}
                    {r.routed && <span className="cad-badge-rot">Roteirizado</span>}
                    {!r.hasCadastro && <span className="cad-badge-ext">Sem cadastro</span>}
                  </span>
                </span>
                <span className="sc-num">
                  {r.fatTotal3m > 0
                    ? <strong className="c-blue">{kpiCurrency(r.fatTotal3m)}</strong>
                    : r.premiseAvg12m != null && r.premiseAvg12m > 0
                      ? <strong style={{ color: 'var(--muted)', fontSize: 11 }}>CG {kpiCurrency(r.premiseAvg12m)}</strong>
                      : <strong className="c-muted">—</strong>}
                </span>
                <span className="sc-num">
                  {r.daysSincePurchase >= 0
                    ? <span className={`cl-dias-badge ${r.daysSincePurchase <= 30 ? 'cl-dias-ok' : r.daysSincePurchase <= 90 ? 'cl-dias-mid' : 'cl-dias-warn'}`}>{r.daysSincePurchase}d</span>
                    : <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>nunca</span>}
                </span>
              </div>
            )
          })}
        </div>

        {/* Side panel */}
        {selectedRow && (
          <aside className="cad-side-panel">
            <div className="cad-side-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{selectedRow.name}</h3>
                  <small>{selectedRow.document} · {selectedRow.code}</small>
                </div>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }} onClick={() => setExpanded(null)}>✕</button>
              </div>
            </div>
            <div className="cad-side-body">
              <div className="cad-section">
                <h4>Informações Gerais</h4>
                <div className="cad-fields">
                  <Field label="Razão Social" value={selectedRow.legalName} />
                  <Field label="Nome Fantasia" value={selectedRow.name} />
                  <Field label="CNPJ/CPF" value={selectedRow.document} />
                  <Field label="Código" value={selectedRow.code} />
                  <Field label="Cidade" value={selectedRow.city} />
                  <Field label="Bairro" value={selectedRow.district} />
                  <Field label="Endereço" value={selectedRow.address} />
                  <Field label="Filial" value={selectedRow.branch} />
                  <Field label="Tipo Cobrança" value={selectedRow.billingType} />
                  <Field label="Fontes" value={selectedRow.sources.join(', ')} />
                </div>
              </div>

              <div className="cad-section">
                <h4>Comercial</h4>
                <div className="cad-fields">
                  <Field label="Vendedor" value={selectedRow.rcaCode ? `${selectedRow.rcaCode}${selectedRow.rcaName ? ` — ${selectedRow.rcaName}` : ''}` : ''} />
                  <Field label="Supervisor" value={selectedRow.supervisor} />
                  <Field label="Frequência Visita" value={selectedRow.visitFrequency} />
                  <Field label="Dia Visita" value={selectedRow.visitDay} />
                  <Field label="Roteirizado" value={selectedRow.routed ? 'Sim' : 'Não'} />
                </div>
              </div>

              <div className="cad-section">
                <h4>Indicadores</h4>
                <div className="cad-fields">
                  <Field label="Fat. Total Interno" value={selectedRow.fatTotal > 0 ? brlFull(selectedRow.fatTotal) : '—'} highlight={selectedRow.fatTotal > 0} />
                  <Field label="Média Mensal Interno" value={selectedRow.avgMensal > 0 ? brlFull(selectedRow.avgMensal) : '—'} highlight={selectedRow.avgMensal > 0} />
                  <Field label="Meses c/ Dados" value={`${selectedRow.mesesComDados}`} />
                  <Field label="Fat. 3m Interno" value={selectedRow.fatTotal3m > 0 ? brlFull(selectedRow.fatTotal3m) : '—'} highlight={selectedRow.fatTotal3m > 0} />
                  <Field label="Média 3m Interno" value={selectedRow.avgMonth3m > 0 ? brlFull(selectedRow.avgMonth3m) : '—'} highlight={selectedRow.avgMonth3m > 0} />
                  <Field label="Colgate Mercado 3m" value={selectedRow.premiseAvg12m != null ? brlFull(selectedRow.premiseAvg12m) : '—'} />
                  <Field label="Dias sem Compra" value={selectedRow.daysSincePurchase >= 0 ? `${selectedRow.daysSincePurchase} dias` : 'Nunca comprou'} warn={selectedRow.daysSincePurchase > 90} />
                  <Field label="Última Compra" value={selectedRow.lastPurchaseDate ? fmtDay(selectedRow.lastPurchaseDate) : 'Nunca'} />
                  <Field label="Compra Todo Mês" value={selectedRow.purchasedEveryMonth ? 'Sim' : 'Não'} highlight={selectedRow.purchasedEveryMonth} />
                  <Field label="Meses com Compra" value={`${selectedRow.monthsWithPurchase}/3`} />
                </div>
              </div>

              <div className="cad-section">
                <h4>Classificação</h4>
                <div className="cad-fields">
                  <Field label="Faixa" value={selectedRow.range} />
                  <Field label="Canal" value={selectedRow.channel} />
                  <Field label="Cluster" value={selectedRow.cluster} />
                  <Field label="Perfil" value={selectedRow.profile} />
                  <Field label="Rede" value={selectedRow.network} />
                  <div className="cad-field">
                    <span className="cad-field-label">PEX</span>
                    <button
                      type="button"
                      className={`cad-pex-toggle${pexSet.has(selectedRow.document) ? ' on' : ''}`}
                      onClick={e => { e.stopPropagation(); togglePex(selectedRow.document) }}
                    >
                      {pexSet.has(selectedRow.document) ? 'PEX ✓' : 'Não PEX'}
                    </button>
                  </div>
                </div>
              </div>

              {history.length > 0 && (
                <div className="cad-history">
                  <div className="cl-history-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="so-chart-tag">Histórico</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{history.length} movimentações</span>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
                    <table className="so-day-detail-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Produto</th>
                          <th>Vendedor</th>
                          <th className="n-right">Qtd</th>
                          <th className="n-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((m, i) => (
                          <tr key={i} className={`so-dm-row so-dm-${m.movementType}`}>
                            <td style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{m.movementDate ? fmtDay(m.movementDate) : '—'}</td>
                            <td><span className={`so-mov-badge so-mov-${m.movementType}`}>{MOV_LABEL[m.movementType] ?? m.movementType}</span></td>
                            <td className="so-dm-product">{m.description ?? m.productCode ?? '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--muted)' }}>{m.seller ?? m.sellerCode ?? '—'}</td>
                            <td className="n-right so-dm-qty">{m.quantity != null ? m.quantity.toLocaleString('pt-BR') : '—'}</td>
                            <td className="n-right so-dm-value">{m.value != null ? brlFull(m.value) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}

function Field({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="cad-field">
      <span className="cad-field-label">{label}</span>
      <span className={`cad-field-value${highlight ? ' cad-highlight' : ''}${warn ? ' cad-warn' : ''}`}>{value || '—'}</span>
    </div>
  )
}

function FilterDrop({ label, options, selected, onSelect, single, open, onToggle }: {
  label: string
  options: string[]
  selected: string[]
  onSelect: (vals: string[]) => void
  single?: boolean
  open: boolean
  onToggle: () => void
}) {
  const [q, setQ] = useState('')
  const fq = q.toLowerCase()
  const vis = fq ? options.filter(o => o.toLowerCase().includes(fq)) : options
  return (
    <div className="pf-filter-drop">
      <button type="button" className={`pf-filter-btn${selected.length > 0 ? ' has-value' : ''}${open ? ' open' : ''}`} onClick={onToggle}>
        {label}
        {selected.length > 0 && <span className="pf-filter-count">{selected.length}</span>}
        <span className="pf-arrow">▼</span>
      </button>
      {open && (
        <div className="pf-filter-panel" onClick={e => e.stopPropagation()}>
          {options.length > 8 && (
            <input className="pf-panel-search" placeholder="Filtrar..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
          )}
          {single ? (
            <>
              <label><input type="radio" name={`fd-${label}`} checked={selected.length === 0} onChange={() => { onSelect([]); onToggle() }} /> Todos</label>
              {vis.map(o => (
                <label key={o}><input type="radio" name={`fd-${label}`} checked={selected.includes(o)} onChange={() => { onSelect([o]); onToggle() }} /> {o}</label>
              ))}
            </>
          ) : (
            <>
              {selected.length > 0 && (
                <label style={{ color: 'var(--red)', fontWeight: 600 }}><input type="checkbox" checked={false} onChange={() => onSelect([])} /> Limpar</label>
              )}
              {vis.map(o => (
                <label key={o}><input type="checkbox" checked={selected.includes(o)} onChange={() => {
                  const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]
                  onSelect(next)
                }} /> {o}</label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
