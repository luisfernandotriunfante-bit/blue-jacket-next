import { useState, useMemo, useCallback } from 'react'
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
  fatTotal3m: number
  avgMonth3m: number
  lastPurchaseDate: string
  daysSincePurchase: number
  monthsWithPurchase: number
  purchasedEveryMonth: boolean
}

export function CadastroClienteTab({ clientBase, movementBase, activeComp }: {
  clientBase: CanonicalClient[]
  movementBase: CanonicalMovement[]
  activeComp: string
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterPex, setFilterPex] = useState<'all' | 'pex' | 'nao-pex'>('all')
  const [filterRange, setFilterRange] = useState('all')
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [filterRouted, setFilterRouted] = useState<'all' | 'sim' | 'nao'>('all')
  const [pexSet, setPexSet] = useState<Set<string>>(new Set())
  const [pexText, setPexText] = useState('')
  const [showPexUpload, setShowPexUpload] = useState(false)

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

      let lastPurchaseDate = ''
      for (const m of allMovs) {
        if (m.movementType !== 'venda_faturada') continue
        const d = m.movementDate ?? ''
        if (d > lastPurchaseDate) lastPurchaseDate = d
      }

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
      if (filterPex === 'pex' && !isPex) return false
      if (filterPex === 'nao-pex' && isPex) return false
      if (filterRange !== 'all' && r.range !== filterRange) return false
      if (filterNetwork !== 'all' && r.network !== filterNetwork) return false
      if (filterRouted === 'sim' && !r.routed) return false
      if (filterRouted === 'nao' && r.routed) return false
      return true
    })
  }, [rows, q, pexSet, filterPex, filterRange, filterNetwork, filterRouted])

  const handlePexUpload = useCallback(() => {
    const docs = pexText.split(/[\n,;]+/).map(s => s.replace(/\D/g, '')).filter(d => d.length === 11 || d.length === 14)
    if (!docs.length) return
    setPexSet(prev => { const next = new Set(prev); for (const d of docs) next.add(d); return next })
    setPexText('')
    setShowPexUpload(false)
  }, [pexText])

  const togglePex = useCallback((doc: string) => {
    setPexSet(prev => { const next = new Set(prev); if (next.has(doc)) next.delete(doc); else next.add(doc); return next })
  }, [])

  const history = useMemo(() => {
    if (!expanded) return []
    const code = rows.find(r => r.document === expanded)?.code
    const movs = movsByCustomer.get(code ?? '') ?? movsByCustomer.get(expanded) ?? []
    return [...movs].sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? ''))
  }, [expanded, rows, movsByCustomer])

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
              {pexSet.size > 0 && <button type="button" className="cad-pex-clear" onClick={() => setPexSet(new Set())}>Limpar PEX</button>}
            </div>
          </div>
        )}

        <fieldset className="pf-range">
          <legend>PEX</legend>
          <div>
            {(['all', 'pex', 'nao-pex'] as const).map(v => (
              <button key={v} type="button" className={filterPex === v ? 'is-active' : ''} onClick={() => { setFilterPex(v); setExpanded(null) }}>
                {v === 'all' ? 'Todos' : v === 'pex' ? 'PEX' : 'Não PEX'}
              </button>
            ))}
          </div>
        </fieldset>

        {availableRanges.length > 0 && (
          <fieldset className="pf-range">
            <legend>Faixa</legend>
            <div>
              <button type="button" className={filterRange === 'all' ? 'is-active' : ''} onClick={() => { setFilterRange('all'); setExpanded(null) }}>Todas</button>
              {availableRanges.map(r => (
                <button key={r} type="button" className={filterRange === r ? 'is-active' : ''} onClick={() => { setFilterRange(r); setExpanded(null) }}>{r}</button>
              ))}
            </div>
          </fieldset>
        )}

        {availableNetworks.length > 0 && (
          <fieldset className="pf-range">
            <legend>Rede</legend>
            <div>
              <select className="pf-select" value={filterNetwork} onChange={e => { setFilterNetwork(e.target.value); setExpanded(null) }}>
                <option value="all">Todas as redes</option>
                {availableNetworks.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </fieldset>
        )}

        <fieldset className="pf-range">
          <legend>Roteirizado</legend>
          <div>
            {(['all', 'sim', 'nao'] as const).map(v => (
              <button key={v} type="button" className={filterRouted === v ? 'is-active' : ''} onClick={() => { setFilterRouted(v); setExpanded(null) }}>
                {v === 'all' ? 'Todos' : v === 'sim' ? 'Sim' : 'Não'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Count */}
      <div className="stock-count">
        <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
        cliente{filtered.length !== 1 ? 's' : ''}
        {rows.length !== filtered.length && ` de ${rows.length.toLocaleString('pt-BR')}`}
        {pexSet.size > 0 && <span style={{ marginLeft: 12, color: 'var(--red)', fontWeight: 700 }}>{pexSet.size} PEX</span>}
      </div>

      {/* List */}
      <div className="stock-list stock-list--cadastro">
        <div className="stock-head">
          <span>Cliente</span>
          <span className="sc-num">Média 3m</span>
          <span className="sc-num">Dias s/ compra</span>
        </div>
        {filtered.length === 0 && (
          <p className="empty" style={{ padding: '24px 16px', color: 'var(--muted)', textAlign: 'center' }}>Nenhum cliente encontrado.</p>
        )}
        {filtered.map(r => {
          const isExpanded = expanded === r.document
          const isPex = pexSet.has(r.document)
          return (
            <div key={r.document}>
              <div
                className={`stock-row${isExpanded ? ' sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isExpanded ? null : r.document)}
                onKeyDown={e => e.key === 'Enter' && setExpanded(isExpanded ? null : r.document)}
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
                  {r.avgMonth3m > 0
                    ? <strong className="c-blue">{kpiCurrency(r.avgMonth3m)}</strong>
                    : <strong className="c-muted">—</strong>}
                </span>
                <span className="sc-num">
                  {r.daysSincePurchase >= 0
                    ? <span className={`cl-dias-badge ${r.daysSincePurchase <= 30 ? 'cl-dias-ok' : r.daysSincePurchase <= 90 ? 'cl-dias-mid' : 'cl-dias-warn'}`}>{r.daysSincePurchase}d</span>
                    : <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>nunca</span>}
                </span>
              </div>

              {isExpanded && (
                <div className="cad-detail">
                  <div className="cad-sections">
                    <div className="cad-section">
                      <h4>Informações Gerais</h4>
                      <div className="cad-fields">
                        <Field label="Razão Social" value={r.legalName} />
                        <Field label="Nome Fantasia" value={r.name} />
                        <Field label="CNPJ/CPF" value={r.document} />
                        <Field label="Código" value={r.code} />
                        <Field label="Cidade" value={r.city} />
                        <Field label="Bairro" value={r.district} />
                        <Field label="Endereço" value={r.address} />
                        <Field label="Filial" value={r.branch} />
                        <Field label="Tipo Cobrança" value={r.billingType} />
                        <Field label="Fontes" value={r.sources.join(', ')} />
                      </div>
                    </div>

                    <div className="cad-section">
                      <h4>Comercial</h4>
                      <div className="cad-fields">
                        <Field label="Vendedor" value={r.rcaCode ? `${r.rcaCode}${r.rcaName ? ` — ${r.rcaName}` : ''}` : ''} />
                        <Field label="Supervisor" value={r.supervisor} />
                        <Field label="Frequência Visita" value={r.visitFrequency} />
                        <Field label="Dia Visita" value={r.visitDay} />
                        <Field label="Roteirizado" value={r.routed ? 'Sim' : 'Não'} />
                      </div>
                    </div>

                    <div className="cad-section">
                      <h4>Indicadores</h4>
                      <div className="cad-fields">
                        <Field label="Fat. 3 Meses" value={r.fatTotal3m > 0 ? brlFull(r.fatTotal3m) : '—'} highlight={r.fatTotal3m > 0} />
                        <Field label="Média Mensal 3m" value={r.avgMonth3m > 0 ? brlFull(r.avgMonth3m) : '—'} highlight={r.avgMonth3m > 0} />
                        <Field label="Média Pirâmide 12m" value={r.premiseAvg12m != null ? brlFull(r.premiseAvg12m) : '—'} />
                        <Field label="Dias sem Compra" value={r.daysSincePurchase >= 0 ? `${r.daysSincePurchase} dias` : 'Nunca comprou'} warn={r.daysSincePurchase > 90} />
                        <Field label="Última Compra" value={r.lastPurchaseDate ? fmtDay(r.lastPurchaseDate) : 'Nunca'} />
                        <Field label="Compra Todo Mês" value={r.purchasedEveryMonth ? 'Sim' : 'Não'} highlight={r.purchasedEveryMonth} />
                        <Field label="Meses com Compra" value={`${r.monthsWithPurchase}/3`} />
                      </div>
                    </div>

                    <div className="cad-section">
                      <h4>Classificação</h4>
                      <div className="cad-fields">
                        <Field label="Faixa" value={r.range} />
                        <Field label="Canal" value={r.channel} />
                        <Field label="Cluster" value={r.cluster} />
                        <Field label="Perfil" value={r.profile} />
                        <Field label="Rede" value={r.network} />
                        <div className="cad-field">
                          <span className="cad-field-label">PEX</span>
                          <button
                            type="button"
                            className={`cad-pex-toggle${isPex ? ' on' : ''}`}
                            onClick={e => { e.stopPropagation(); togglePex(r.document) }}
                          >
                            {isPex ? 'PEX ✓' : 'Não PEX'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="cad-history">
                      <div className="cl-history-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="so-chart-tag">Histórico · {r.name}</span>
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
              )}
            </div>
          )
        })}
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
