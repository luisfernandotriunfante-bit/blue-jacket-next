import { useState, useMemo } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'

/* ── formatters ──────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(2)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}
const brlFull = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }

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

/* ── KpiCard ─────────────────────────────────────────── */
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {sub && <div className="kpi-ring-row"><span className="kpi-pct">{sub}</span></div>}
      </div>
    </div>
  )
}

/* ── ClientesTab ─────────────────────────────────────── */
export function ClientesTab({ movementBase, clientBase, monthLabel, activeComp }: {
  movementBase: CanonicalMovement[]
  clientBase: CanonicalClient[]
  monthLabel: string
  activeComp: string
}) {
  const [search, setSearch] = useState('')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [filterRange, setFilterRange] = useState<string[]>([])
  const [filterNetwork, setFilterNetwork] = useState<string[]>([])
  const [filterProfile, setFilterProfile] = useState<string[]>([])
  const [filterSource, setFilterSource] = useState<string[]>([])
  const [filterChannel, setFilterChannel] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState<string | null>(null)

  const clientLookup = useMemo(() => {
    const m = new Map<string, CanonicalClient>()
    for (const c of clientBase) {
      if (c.winthorCode) m.set(c.winthorCode, c)
      m.set(c.document, c)
    }
    return m
  }, [clientBase])

  const { monthStart, monthEnd } = useMemo(() => {
    const [y, mo] = activeComp.split('-').map(Number)
    const monthStart = `${activeComp}-01`
    const now = new Date()
    const curComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = activeComp >= curComp
      ? now.toISOString().slice(0, 10)
      : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`
    return { monthStart, monthEnd }
  }, [activeComp])

  const monthBase = useMemo(() =>
    movementBase.filter(m => { const d = m.movementDate ?? ''; return d >= monthStart && d <= monthEnd })
  , [movementBase, monthStart, monthEnd])

  const movsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    for (const m of movementBase) {
      if (!m.customerCode) continue
      if (!map.has(m.customerCode)) map.set(m.customerCode, [])
      map.get(m.customerCode)!.push(m)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? ''))
    }
    return map
  }, [movementBase])

  const lastFatDate = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of movementBase) {
      if (m.movementType !== 'venda_faturada' || !m.customerCode || !m.movementDate) continue
      const ex = map.get(m.customerCode)
      if (!ex || m.movementDate > ex) map.set(m.customerCode, m.movementDate)
    }
    return map
  }, [movementBase])

  const positivados = useMemo(() => {
    const map = new Map<string, { code: string; name: string; fat: number; afat: number; seller: string; lastDate: string; range: string; network: string; profile: string; channel: string; sources: string[] }>()
    for (const m of monthBase) {
      const code = m.customerCode ?? ''; if (!code) continue
      if (m.movementType === 'venda_faturada' || m.movementType === 'a_faturar') {
        if (!map.has(code)) {
          const cli = clientLookup.get(code) ?? clientLookup.get(m.customerDocument ?? '')
          map.set(code, { code, name: m.customerName ?? code, fat: 0, afat: 0, seller: m.seller ?? m.sellerCode ?? '—', lastDate: m.movementDate ?? '', range: cli?.premiseRange ?? '', network: cli?.premiseNetwork ?? '', profile: cli?.premiseProfile ?? '', channel: cli?.channelType ?? '', sources: cli?.sources ?? [] })
        }
      } else if (m.movementType === 'devolucao') {
        if (!map.has(code)) continue
      } else {
        continue
      }
      const e = map.get(code)!
      if (m.movementType === 'venda_faturada') e.fat += m.value ?? 0
      else if (m.movementType === 'devolucao') e.fat += m.value ?? 0
      else e.afat += m.value ?? 0
      if ((m.movementDate ?? '') > e.lastDate) {
        e.lastDate = m.movementDate ?? ''
        e.seller = m.seller ?? m.sellerCode ?? e.seller
      }
    }
    return [...map.values()].sort((a, b) => b.fat - a.fat)
  }, [monthBase, clientLookup])

  const totalFat = useMemo(() => positivados.reduce((s, p) => s + p.fat, 0), [positivados])

  const availableRanges = useMemo(() => [...new Set(positivados.map(p => p.range).filter(Boolean))].sort(), [positivados])
  const availableNetworks = useMemo(() => [...new Set(positivados.map(p => p.network).filter(Boolean))].sort(), [positivados])
  const availableProfiles = useMemo(() => [...new Set(positivados.map(p => p.profile).filter(Boolean))].sort(), [positivados])
  const availableSources = useMemo(() => [...new Set(positivados.flatMap(p => p.sources))].sort(), [positivados])
  const availableChannels = useMemo(() => [...new Set(positivados.map(p => p.channel).filter(Boolean))].sort(), [positivados])
  const hasActiveFilter = filterRange.length > 0 || filterNetwork.length > 0 || filterProfile.length > 0 || filterSource.length > 0 || filterChannel.length > 0

  const q = search.toLowerCase()
  const filteredPosit = positivados.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q) && !p.seller.toLowerCase().includes(q)) return false
    if (filterRange.length && !filterRange.includes(p.range)) return false
    if (filterNetwork.length && !filterNetwork.includes(p.network)) return false
    if (filterProfile.length && !filterProfile.includes(p.profile)) return false
    if (filterSource.length && !filterSource.some(s => p.sources.includes(s))) return false
    if (filterChannel.length && !filterChannel.includes(p.channel)) return false
    return true
  })

  function toggleCustomer(code: string) {
    setExpandedCustomer(prev => prev === code ? null : code)
  }

  if (!movementBase.length) {
    return (
      <section className="content">
        <div className="so-empty">
          <p>Nenhuma movimentação importada ainda.</p>
          <small>Importe na aba <strong>Administração</strong>.</small>
        </div>
      </section>
    )
  }

  return (
    <section className="content">
      <div className="stock-kpis" style={{ marginBottom: 20 }}>
        <KpiCard label="Positivados" value={String(positivados.length)} />
        <KpiCard label="Faturado total" value={kpiCurrency(totalFat)} />
      </div>

      <div className="cl-toolbar">
        <input
          className="stock-search"
          placeholder="Buscar cliente, código, vendedor…"
          value={search}
          onChange={e => { setSearch(e.target.value); setExpandedCustomer(null) }}
          style={{ flex: 1 }}
        />
      </div>

      <div className="pf-filters-row" style={{ marginBottom: 8 }} onClick={() => setOpenFilter(null)}>
        {availableRanges.length > 0 && (
          <FilterDrop label="Faixa" options={availableRanges} selected={filterRange} onSelect={v => { setFilterRange(v); setExpandedCustomer(null) }} open={openFilter === 'range'} onToggle={() => setOpenFilter(openFilter === 'range' ? null : 'range')} />
        )}
        {availableNetworks.length > 0 && (
          <FilterDrop label="Rede" options={availableNetworks} selected={filterNetwork} onSelect={v => { setFilterNetwork(v); setExpandedCustomer(null) }} open={openFilter === 'network'} onToggle={() => setOpenFilter(openFilter === 'network' ? null : 'network')} />
        )}
        {availableProfiles.length > 0 && (
          <FilterDrop label="Perfil" options={availableProfiles} selected={filterProfile} onSelect={v => { setFilterProfile(v); setExpandedCustomer(null) }} open={openFilter === 'profile'} onToggle={() => setOpenFilter(openFilter === 'profile' ? null : 'profile')} />
        )}
        {availableChannels.length > 0 && (
          <FilterDrop label="Canal" options={availableChannels} selected={filterChannel} onSelect={v => { setFilterChannel(v); setExpandedCustomer(null) }} open={openFilter === 'channel'} onToggle={() => setOpenFilter(openFilter === 'channel' ? null : 'channel')} />
        )}
        {availableSources.length > 0 && (
          <FilterDrop label="Fonte" options={availableSources} selected={filterSource} onSelect={v => { setFilterSource(v); setExpandedCustomer(null) }} open={openFilter === 'source'} onToggle={() => setOpenFilter(openFilter === 'source' ? null : 'source')} />
        )}
        {hasActiveFilter && (
          <button type="button" className="pf-clear-btn" onClick={e => { e.stopPropagation(); setFilterRange([]); setFilterNetwork([]); setFilterProfile([]); setFilterSource([]); setFilterChannel([]) }}>
            Limpar filtros
          </button>
        )}
      </div>

      <div className="notas-section" style={{ marginBottom: 24 }}>
        <div className="notas-section-head">
          <span className="notas-section-title">Positivados · {monthLabel}</span>
          <small style={{ color: 'var(--muted)', fontSize: 11 }}>clique numa linha para ver histórico</small>
        </div>
        <div>
          <table className="gr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Cliente</th>
                <th className="n-right">Faturado</th>
                <th className="n-right">A faturar</th>
                <th>Vendedor</th>
                <th className="n-right">Dias s/ compra</th>
                <th>Último mov.</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosit.map((p, i) => {
                const isExpanded = expandedCustomer === p.code
                const lastFat = lastFatDate.get(p.code) ?? p.lastDate
                const dias = lastFat ? daysSince(lastFat) : -1
                const history = movsByCustomer.get(p.code) ?? []

                return <>
                  <tr
                    key={p.code}
                    className={`gr-row cl-expandable-row${isExpanded ? ' cl-row-expanded' : ''}`}
                    onClick={() => toggleCustomer(p.code)}
                  >
                    <td className="gr-rank">#{i + 1}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.code}</td>
                    <td>
                      <div className="gr-seller-name">{p.name}</div>
                    </td>
                    <td className="n-right" style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(p.fat)}</td>
                    <td className="n-right" style={{ color: p.afat > 0 ? 'var(--red)' : 'var(--muted)', fontSize: 12 }}>
                      {p.afat > 0 ? kpiCurrency(p.afat) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{p.seller}</td>
                    <td className="n-right">
                      {dias >= 0
                        ? <span className={`cl-dias-badge ${dias <= 7 ? 'cl-dias-ok' : dias <= 30 ? 'cl-dias-mid' : 'cl-dias-warn'}`}>{dias}d</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.lastDate ? fmtDay(p.lastDate) : '—'}</td>
                  </tr>
                  {isExpanded && history.length > 0 && (
                    <tr key={`${p.code}-hist`} className="cl-history-row">
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div className="cl-history-wrap">
                          <div className="cl-history-head">
                            <span className="so-chart-tag">HISTÓRICO · {p.name}</span>
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{history.length} movimentações</span>
                          </div>
                          <div>
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
                                {history.map((m, mi) => (
                                  <tr key={mi} className={`so-dm-row so-dm-${m.movementType}`}>
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
                      </td>
                    </tr>
                  )}
                </>
              })}
              {!filteredPosit.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum cliente positivado este mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
    <div className="pf-filter-drop" onClick={e => e.stopPropagation()}>
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
