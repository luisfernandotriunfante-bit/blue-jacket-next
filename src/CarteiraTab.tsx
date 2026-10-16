import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'
import { readRcas, type RcaRecord } from './RcaManager'
import { msGeo, MS_W, MS_H, type CityGeo } from './msGeo'

/* ── helpers ──────────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}
const brlFull = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }
const today = new Date().toISOString().slice(0, 10)
function daysSince(dateStr: string): number {
  if (!dateStr) return -1
  return Math.max(0, Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000))
}
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

const cityKeys = Object.keys(msGeo)
const cityNameMap = new Map<string, string>()
for (const k of cityKeys) cityNameMap.set(normalize(msGeo[k].n), k)

function matchCity(rawCity: string): string | null {
  if (!rawCity) return null
  const n = normalize(rawCity)
  if (cityNameMap.has(n)) return cityNameMap.get(n)!
  for (const [norm, key] of cityNameMap) {
    if (norm.includes(n) || n.includes(norm)) return key
  }
  return null
}

const RAMP = ['var(--accent-dim, #e8998f)', 'var(--accent-mid, #d4574c)', 'var(--red, #b3211b)', 'var(--accent-deep, #7d120e)']
function bin(v: number, max: number): number {
  if (max <= 0) return 0
  const r = v / max
  if (r <= 0.25) return 0
  if (r <= 0.5) return 1
  if (r <= 0.75) return 2
  return 3
}

type Mode = 'rot' | 'nao' | 'sem'

interface SellerData {
  code: string
  name: string
  supervisor: string
  totalClients: number
  totalVisits: number
  cities: Record<string, { clients: number; fat: number }>
  clientList: Record<string, ClientRow[]>
}

interface ClientRow {
  name: string
  document: string
  code: string
  city: string
  district: string
  channel: string
  range: string
  network: string
  cluster: string
  fat: number
  lastDate: string
  routed: boolean
  rcaCode: string
  rcaName: string
  hasCadastro: boolean
}

/* ── KpiCard ──────────────────────────────────────────── */
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

/* ── Component ────────────────────────────────────────── */
export function CarteiraTab({ clientBase, movementBase, activeComp }: {
  clientBase: CanonicalClient[]
  movementBase: CanonicalMovement[]
  activeComp: string
}) {
  const [mode, setMode] = useState<Mode>('rot')
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [rcas, setRcas] = useState<RcaRecord[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRcas(readRcas())
    const h = () => setRcas(readRcas())
    window.addEventListener('rj-rcas-changed', h)
    return () => window.removeEventListener('rj-rcas-changed', h)
  }, [])

  useEffect(() => { setSelectedSeller(null); setSelectedCity(null); setExpandedClient(null) }, [mode])

  const rcaMap = useMemo(() => {
    const m = new Map<string, RcaRecord>()
    for (const r of rcas) m.set(r.code, r)
    return m
  }, [rcas])

  /* month range */
  const [y, mo] = activeComp.split('-').map(Number)
  const monthStart = `${activeComp}-01`
  const curComp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthEnd = activeComp >= curComp ? today : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`

  /* movements by customer */
  const movsByCustomer = useMemo(() => {
    const m = new Map<string, CanonicalMovement[]>()
    for (const mv of movementBase) {
      const key = mv.customerCode ?? mv.customerDocument ?? ''
      if (!key) continue
      const arr = m.get(key) ?? []
      arr.push(mv)
      m.set(key, arr)
    }
    return m
  }, [movementBase])

  /* build client rows */
  const allClients = useMemo<ClientRow[]>(() => {
    return clientBase.map(c => {
      const code = c.winthorCode ?? c.document
      const allMovs = movsByCustomer.get(code) ?? movsByCustomer.get(c.document) ?? []
      const monthMovs = allMovs.filter(m => { const d = m.movementDate ?? ''; return d >= monthStart && d <= monthEnd })
      let fat = 0
      for (const m of monthMovs) {
        if (m.movementType === 'venda_faturada') fat += m.value ?? 0
        else if (m.movementType === 'devolucao') fat -= m.value ?? 0
      }
      let lastDate = ''
      for (const m of allMovs) { const d = m.movementDate ?? ''; if (d > lastDate) lastDate = d }
      const hasCadastro = c.sources.includes('Cadastro interno')
      return {
        name: c.legalName ?? c.tradeName ?? c.document,
        document: c.document,
        code,
        city: c.city ?? '',
        district: c.district ?? '',
        channel: c.channelType ?? '',
        range: c.premiseRange ?? '',
        network: c.premiseNetwork ?? '',
        cluster: c.premiseCluster ?? '',
        fat,
        lastDate,
        routed: !!(c.visitFrequency || c.visitDay),
        rcaCode: c.rcaCode ?? '',
        rcaName: c.rcaName ?? c.representative ?? '',
        hasCadastro,
      }
    })
  }, [clientBase, movsByCustomer, monthStart, monthEnd])

  /* sellers */
  const sellers = useMemo<SellerData[]>(() => {
    const map = new Map<string, SellerData>()
    for (const c of allClients) {
      if (!c.routed || !c.rcaCode) continue
      const code = c.rcaCode
      const rca = rcaMap.get(code)
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: rca?.name ?? c.rcaName ?? `RCA ${code}`,
          supervisor: rca?.supervisor ?? '',
          totalClients: 0,
          totalVisits: 0,
          cities: {},
          clientList: {},
        })
      }
      const s = map.get(code)!
      s.totalClients++
      s.totalVisits++
      const ck = matchCity(c.city)
      if (ck) {
        if (!s.cities[ck]) s.cities[ck] = { clients: 0, fat: 0 }
        s.cities[ck].clients++
        s.cities[ck].fat += c.fat
        if (!s.clientList[ck]) s.clientList[ck] = []
        s.clientList[ck].push(c)
      }
    }
    return [...map.values()].sort((a, b) => {
      const cmp = a.supervisor.localeCompare(b.supervisor)
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
    })
  }, [allClients, rcaMap])

  /* non-routed clients by city */
  const naoByCity = useMemo(() => {
    const m: Record<string, ClientRow[]> = {}
    for (const c of allClients) {
      if (c.routed) continue
      if (!c.hasCadastro) continue
      const ck = matchCity(c.city)
      if (!ck) continue
      if (!m[ck]) m[ck] = []
      m[ck].push(c)
    }
    return m
  }, [allClients])

  /* clients without internal registration by city */
  const semByCity = useMemo(() => {
    const m: Record<string, ClientRow[]> = {}
    for (const c of allClients) {
      if (c.hasCadastro) continue
      const ck = matchCity(c.city)
      if (!ck) continue
      if (!m[ck]) m[ck] = []
      m[ck].push(c)
    }
    return m
  }, [allClients])

  /* sellers indexed by city */
  const sellersByCity = useMemo(() => {
    const m: Record<string, SellerData[]> = {}
    for (const s of sellers) {
      for (const ck of Object.keys(s.cities)) {
        if (!m[ck]) m[ck] = []
        m[ck].push(s)
      }
    }
    return m
  }, [sellers])

  const sel = selectedSeller ? sellers.find(s => s.code === selectedSeller) ?? null : null

  /* counts */
  const naoCount = useMemo(() => Object.values(naoByCity).reduce((s, l) => s + l.length, 0), [naoByCity])
  const semCount = useMemo(() => Object.values(semByCity).reduce((s, l) => s + l.length, 0), [semByCity])

  /* active data for nao/sem modes */
  const activeData = mode === 'nao' ? naoByCity : mode === 'sem' ? semByCity : {}

  /* filtered seller list */
  const filteredSellers = useMemo(() => {
    if (!search) return sellers
    const q = search.toLowerCase()
    return sellers.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q) || s.supervisor.toLowerCase().includes(q))
  }, [sellers, search])

  /* filtered city list for nao/sem */
  const filteredCities = useMemo(() => {
    const data = mode === 'nao' ? naoByCity : semByCity
    const keys = Object.keys(data).sort((a, b) => (data[b]?.length ?? 0) - (data[a]?.length ?? 0))
    if (!search) return keys
    const q = search.toLowerCase()
    return keys.filter(k => msGeo[k].n.toLowerCase().includes(q))
  }, [mode, naoByCity, semByCity, search])

  /* painting logic */
  const cityColors = useMemo<Record<string, string>>(() => {
    const colors: Record<string, string> = {}
    if (mode === 'rot') {
      if (sel) {
        const vals = Object.values(sel.cities).map(c => c.clients)
        const max = Math.max(...vals, 1)
        for (const [ck, v] of Object.entries(sel.cities)) {
          colors[ck] = RAMP[bin(v.clients, max)]
        }
      } else {
        const byC: Record<string, number> = {}
        for (const s of sellers) for (const ck of Object.keys(s.cities)) byC[ck] = (byC[ck] ?? 0) + 1
        const max = Math.max(...Object.values(byC), 1)
        for (const [ck, n] of Object.entries(byC)) colors[ck] = RAMP[bin(n, max)]
      }
    } else {
      const data = mode === 'nao' ? naoByCity : semByCity
      const vals = Object.values(data).map(l => l.length)
      const max = Math.max(...vals, 1)
      for (const [ck, l] of Object.entries(data)) colors[ck] = RAMP[bin(l.length, max)]
    }
    return colors
  }, [mode, sel, sellers, naoByCity, semByCity])

  /* tooltip */
  const showTip = useCallback((e: React.MouseEvent, ck: string) => {
    const tip = tipRef.current
    const svg = svgRef.current
    if (!tip || !svg) return
    const r = svg.parentElement!.getBoundingClientRect()
    let html = `<b>${msGeo[ck].n}</b>`
    if (mode === 'rot') {
      if (sel) {
        const v = sel.cities[ck]
        if (v) html += `<br>${v.clients} clientes · ${brlFull(v.fat)}`
      } else {
        const sl = sellersByCity[ck] ?? []
        html += `<br>${sl.length ? sl.length + ' vendedor' + (sl.length > 1 ? 'es' : '') + ': ' + sl.map(s => s.name.split(' ')[0]).join(', ') : 'Sem vendedor no roteiro'}`
      }
    } else {
      const d = activeData[ck] ?? []
      html += `<br>${d.length} cliente${d.length !== 1 ? 's' : ''} ${mode === 'nao' ? 'sem roteiro' : 'sem cadastro'}`
    }
    tip.innerHTML = html
    tip.style.display = 'block'
    let x = e.clientX - r.left + 12, yy = e.clientY - r.top + 12
    if (x > r.width - 260) x -= 270
    tip.style.left = x + 'px'
    tip.style.top = yy + 'px'
  }, [mode, sel, sellersByCity, activeData])

  const hideTip = useCallback(() => {
    if (tipRef.current) tipRef.current.style.display = 'none'
  }, [])

  const clickCity = useCallback((ck: string) => {
    if (mode === 'rot') {
      if (sel && sel.cities[ck]) {
        setExpandedClient(expandedClient === ck ? null : ck)
      }
    } else {
      setSelectedCity(selectedCity === ck ? null : ck)
    }
  }, [mode, sel, selectedCity, expandedClient])

  /* history for a client */
  const clientHistory = useCallback((code: string, doc: string) => {
    return (movsByCustomer.get(code) ?? movsByCustomer.get(doc) ?? []).sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? '')).slice(0, 30)
  }, [movsByCustomer])

  const MOV_LABEL: Record<string, string> = { venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução', bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada' }

  /* side panel content */
  const renderSide = () => {
    if (mode === 'rot') {
      if (sel) {
        const cityKeys = Object.keys(sel.cities).sort((a, b) => sel.cities[b].clients - sel.cities[a].clients)
        return (
          <div className="carteira-side">
            <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{sel.name}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>
              <span>Cód. {sel.code}</span>
              <span>Sup. {sel.supervisor}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, marginBottom: 12 }}>
              <span><strong>{sel.totalClients}</strong> clientes</span>
              <span><strong>{cityKeys.length}</strong> cidades</span>
              <span><strong>{kpiCurrency(Object.values(sel.cities).reduce((s, c) => s + c.fat, 0))}</strong> faturado</span>
            </div>
            {cityKeys.map(ck => {
              const city = sel.cities[ck]
              const clients = sel.clientList[ck] ?? []
              const isOpen = expandedClient === ck
              return (
                <details key={ck} open={isOpen} onToggle={e => { if ((e.target as HTMLDetailsElement).open) setExpandedClient(ck); else if (expandedClient === ck) setExpandedClient(null) }}>
                  <summary style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', fontSize: 13, padding: '7px 0', cursor: 'pointer', borderTop: '1px solid var(--border)', listStyle: 'none' }}>
                    <span>{msGeo[ck]?.n ?? ck}</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.7 }}>{city.clients} cli · {kpiCurrency(city.fat)}</span>
                  </summary>
                  <ul style={{ margin: '2px 0 8px', padding: 0, listStyle: 'none', maxHeight: 300, overflow: 'auto', borderLeft: '2px solid var(--red, #b3211b)' }}>
                    {clients.map(c => (
                      <li key={c.document} style={{ padding: '4px 8px', fontSize: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 8px' }}>
                        <span>{c.name}<br /><small style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 11 }}>{c.document}</small></span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{c.fat > 0 ? kpiCurrency(c.fat) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            })}
          </div>
        )
      }
      /* general overview */
      const supMap = new Map<string, { total: number; sellers: number; cities: Set<string> }>()
      for (const s of sellers) {
        const sup = s.supervisor || 'Sem supervisor'
        if (!supMap.has(sup)) supMap.set(sup, { total: 0, sellers: 0, cities: new Set() })
        const d = supMap.get(sup)!
        d.total += s.totalClients
        d.sellers++
        for (const ck of Object.keys(s.cities)) d.cities.add(ck)
      }
      return (
        <div className="carteira-side">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Visão geral</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, marginBottom: 12 }}>
            <span><strong>{sellers.length}</strong> vendedores</span>
            <span><strong>{allClients.filter(c => c.routed).length}</strong> clientes roterizados</span>
          </div>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Supervisor</th><th style={{ textAlign: 'right' }}>Vend.</th><th style={{ textAlign: 'right' }}>Clientes</th><th style={{ textAlign: 'right' }}>Cidades</th></tr></thead>
            <tbody>
              {[...supMap.entries()].sort((a, b) => b[1].total - a[1].total).map(([sup, d]) => (
                <tr key={sup}><td>{sup}</td><td style={{ textAlign: 'right' }}>{d.sellers}</td><td style={{ textAlign: 'right' }}>{d.total}</td><td style={{ textAlign: 'right' }}>{d.cities.size}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    /* nao / sem mode */
    if (selectedCity) {
      const clients = activeData[selectedCity] ?? []
      return (
        <div className="carteira-side">
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{msGeo[selectedCity]?.n ?? selectedCity}</h2>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            <strong>{clients.length}</strong> {mode === 'nao' ? 'clientes sem roteiro' : 'clientes sem cadastro interno'}
          </div>
          {(sellersByCity[selectedCity] ?? []).length > 0 && (
            <>
              <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', margin: '8px 0 4px' }}>Vendedores na cidade</h3>
              {(sellersByCity[selectedCity] ?? []).map(s => (
                <div key={s.code} style={{ padding: '4px 0', fontSize: 12, borderTop: '1px solid var(--border)' }}>
                  {s.name} <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>({s.cities[selectedCity]?.clients ?? 0} cli)</span>
                </div>
              ))}
            </>
          )}
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', margin: '12px 0 4px' }}>Clientes</h3>
          {clients.map(c => (
            <details key={c.document} style={{ borderTop: '1px solid var(--border)' }}>
              <summary style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', fontSize: 13, padding: '6px 0', cursor: 'pointer', listStyle: 'none' }}>
                <span>{c.name}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>{c.fat > 0 ? kpiCurrency(c.fat) : '—'}</span>
              </summary>
              <div style={{ padding: '4px 0 8px 8px', fontSize: 12, borderLeft: '2px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '3px 14px', marginBottom: 8 }}>
                  <span>CNPJ: <strong style={{ fontFamily: 'monospace' }}>{c.document}</strong></span>
                  {c.channel && <span>Canal: <strong>{c.channel}</strong></span>}
                  {c.range && <span>Faixa: <strong>{c.range}</strong></span>}
                  {c.network && <span>Rede: <strong>{c.network}</strong></span>}
                  {c.cluster && <span>Cluster: <strong>{c.cluster}</strong></span>}
                  {c.lastDate && <span>Última compra: <strong>{fmtDay(c.lastDate)}</strong></span>}
                  {c.rcaCode && <span>RCA: <strong>{c.rcaCode}</strong></span>}
                </div>
                {(() => {
                  const hist = clientHistory(c.code, c.document)
                  if (!hist.length) return <div style={{ color: 'var(--text-dim)' }}>Sem movimentações</div>
                  return (
                    <table className="data-table" style={{ fontSize: 11 }}>
                      <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                      <tbody>
                        {hist.map((m, i) => (
                          <tr key={i}><td>{m.movementDate ? fmtDay(m.movementDate) : ''}</td><td>{MOV_LABEL[m.movementType] ?? m.movementType}</td><td>{m.description ?? m.productCode ?? ''}</td><td style={{ textAlign: 'right' }}>{m.value != null ? brlFull(m.value) : ''}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            </details>
          ))}
        </div>
      )
    }
    /* general view for nao/sem */
    const data = mode === 'nao' ? naoByCity : semByCity
    const sorted = Object.keys(data).sort((a, b) => data[b].length - data[a].length)
    return (
      <div className="carteira-side">
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{mode === 'nao' ? 'Clientes sem roteiro' : 'Sem cadastro interno'}</h2>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          <strong>{mode === 'nao' ? naoCount : semCount}</strong> clientes em <strong>{sorted.length}</strong> cidades
        </div>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr><th>Cidade</th><th style={{ textAlign: 'right' }}>Clientes</th></tr></thead>
          <tbody>
            {sorted.slice(0, 30).map(ck => (
              <tr key={ck} onClick={() => setSelectedCity(ck)} style={{ cursor: 'pointer' }}><td>{msGeo[ck]?.n ?? ck}</td><td style={{ textAlign: 'right' }}>{data[ck].length}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Modes */}
      <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>Carteira</span>
        <button type="button" className={`stock-nav-btn${mode === 'rot' ? ' on' : ''}`} onClick={() => setMode('rot')}>
          Roterizados <small style={{ opacity: 0.7, fontFamily: 'monospace', marginLeft: 4 }}>{sellers.length}</small>
        </button>
        <button type="button" className={`stock-nav-btn${mode === 'nao' ? ' on' : ''}`} onClick={() => setMode('nao')}>
          Não roterizados <small style={{ opacity: 0.7, fontFamily: 'monospace', marginLeft: 4 }}>{naoCount}</small>
        </button>
        <button type="button" className={`stock-nav-btn${mode === 'sem' ? ' on' : ''}`} onClick={() => setMode('sem')}>
          Sem cadastro <small style={{ opacity: 0.7, fontFamily: 'monospace', marginLeft: 4 }}>{semCount}</small>
        </button>
      </header>

      {/* Grid: rail | map | side */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 320px', gap: 0, overflow: 'hidden' }} className="carteira-grid">
        {/* Left rail */}
        <aside style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <input
            type="search"
            placeholder={mode === 'rot' ? 'Buscar vendedor…' : 'Buscar cidade…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ margin: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', font: 'inherit' }}
          />
          {mode === 'rot' && (
            <button
              type="button"
              onClick={() => { setSelectedSeller(null); setExpandedClient(null) }}
              style={{ margin: '0 10px 6px', padding: '7px 8px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 4, background: !selectedSeller ? 'var(--red, #b3211b)' : 'none', color: !selectedSeller ? '#fff' : 'var(--text)', cursor: 'pointer', font: 'inherit', fontWeight: 500 }}
            >
              <span>Visão geral</span>
              <small style={{ fontFamily: 'monospace', opacity: 0.8 }}>{sellers.length}</small>
            </button>
          )}
          <div style={{ overflow: 'auto', padding: '0 6px 10px', flex: 1 }}>
            {mode === 'rot' ? (
              (() => {
                let lastSup = ''
                return filteredSellers.map(s => {
                  const showSup = s.supervisor !== lastSup
                  lastSup = s.supervisor
                  return (
                    <div key={s.code}>
                      {showSup && <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', padding: '12px 8px 4px' }}>{s.supervisor || 'Sem supervisor'}</div>}
                      <button
                        type="button"
                        onClick={() => { setSelectedSeller(s.code); setExpandedClient(null) }}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', border: 0, background: selectedSeller === s.code ? 'var(--red, #b3211b)' : 'none', color: selectedSeller === s.code ? '#fff' : 'var(--text)', font: 'inherit', padding: '7px 8px', borderRadius: 4, cursor: 'pointer' }}
                      >
                        <span>{s.name}</span>
                        <small style={{ fontFamily: 'monospace', opacity: 0.8, whiteSpace: 'nowrap' }}>{s.totalClients}</small>
                      </button>
                    </div>
                  )
                })
              })()
            ) : (
              filteredCities.map(ck => (
                <button
                  key={ck}
                  type="button"
                  onClick={() => setSelectedCity(selectedCity === ck ? null : ck)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', border: 0, background: selectedCity === ck ? 'var(--red, #b3211b)' : 'none', color: selectedCity === ck ? '#fff' : 'var(--text)', font: 'inherit', padding: '7px 8px', borderRadius: 4, cursor: 'pointer' }}
                >
                  <span>{msGeo[ck].n}</span>
                  <small style={{ fontFamily: 'monospace', opacity: 0.8, whiteSpace: 'nowrap' }}>{activeData[ck]?.length ?? 0}</small>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Map */}
        <div style={{ position: 'relative', overflow: 'auto', padding: 8 }}>
          <svg ref={svgRef} viewBox={`0 0 ${MS_W} ${MS_H}`} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
            {cityKeys.map(ck => {
              const geo = msGeo[ck]
              const color = cityColors[ck]
              const isSelected = (mode === 'rot' && sel && expandedClient === ck) || (mode !== 'rot' && selectedCity === ck)
              return (
                <path
                  key={ck}
                  d={geo.d}
                  fill={color ?? 'var(--bg-card, #ece3e1)'}
                  stroke={isSelected ? 'var(--text)' : 'var(--bg, #fff)'}
                  strokeWidth={isSelected ? 2.5 : 0.8}
                  style={{ cursor: color ? 'pointer' : 'default', transition: 'fill 0.15s' }}
                  onMouseMove={e => showTip(e, ck)}
                  onMouseLeave={hideTip}
                  onClick={() => { if (color) clickCity(ck) }}
                />
              )
            })}
            {/* Labels for colored cities */}
            {Object.keys(cityColors).map(ck => (
              <text
                key={`lbl-${ck}`}
                x={msGeo[ck].c[0]}
                y={msGeo[ck].c[1] + 5}
                textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 500, fill: 'var(--text)', paintOrder: 'stroke', stroke: 'var(--bg-card, #fff)', strokeWidth: 3, pointerEvents: 'none' }}
              >
                {msGeo[ck].n}
              </text>
            ))}
          </svg>
          <div ref={tipRef} style={{ position: 'absolute', pointerEvents: 'none', background: 'var(--text)', color: 'var(--bg)', padding: '6px 9px', borderRadius: 4, fontSize: 12, maxWidth: 260, display: 'none', zIndex: 2 }} />
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', padding: '6px 8px 2px', fontSize: 12, color: 'var(--text-dim)' }}>
            {RAMP.map((r, i) => (
              <span key={i}><span style={{ display: 'inline-block', width: 14, height: 10, background: r, marginRight: 3, verticalAlign: -1 }} />{i === 0 ? 'menor' : i === 3 ? 'maior' : ''}</span>
            ))}
            <span><span style={{ display: 'inline-block', width: 14, height: 10, background: 'var(--bg-card, #ece3e1)', marginRight: 3, verticalAlign: -1 }} />sem dados</span>
          </div>
        </div>

        {/* Side panel */}
        <aside style={{ borderLeft: '1px solid var(--border)', padding: 14, overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
          {renderSide()}
        </aside>
      </div>

      {/* KPIs */}
      <div className="kpi-row" style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
        <KpiCard label="Vendedores" value={sellers.length.toString()} />
        <KpiCard label="Roterizados" value={allClients.filter(c => c.routed).length.toLocaleString('pt-BR')} sub={`${allClients.length ? ((allClients.filter(c => c.routed).length / allClients.length) * 100).toFixed(1) : 0}%`} />
        <KpiCard label="Sem roteiro" value={naoCount.toLocaleString('pt-BR')} />
        <KpiCard label="Sem cadastro" value={semCount.toLocaleString('pt-BR')} />
        <KpiCard label="Total carteira" value={allClients.length.toLocaleString('pt-BR')} />
      </div>

      <style>{`
        @media (max-width: 1000px) {
          .carteira-grid { grid-template-columns: 1fr !important; }
          .carteira-grid > aside:first-child { max-height: 200px; border-right: none !important; border-bottom: 1px solid var(--border); }
          .carteira-grid > aside:last-child { max-height: none; border-left: none !important; border-top: 1px solid var(--border); }
        }
        .carteira-side details summary::-webkit-details-marker { display: none; }
        .carteira-side details summary { list-style: none; }
        .carteira-side details summary > span:first-child::before { content: '+'; display: inline-block; width: 14px; font-weight: 500; color: var(--red, #b3211b); }
        .carteira-side details[open] summary > span:first-child::before { content: '−'; }
      `}</style>
    </div>
  )
}
