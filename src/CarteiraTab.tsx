import { useState, useMemo, useCallback, useEffect } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'
import { readRcas, type RcaRecord } from './RcaManager'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`
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

type PexFilter = 'todos' | 'pex' | 'nao-pex'

interface SellerSummary {
  code: string
  name: string
  supervisor: string
  totalClients: number
  routedClients: number
  notRoutedClients: number
  pexClients: number
  totalFaturado: number
  totalAFaturar: number
  clientCodes: string[]
  goal: number | null
  class: string
}

interface ClientDetail {
  document: string
  winthorCode: string
  name: string
  tradeName: string
  city: string
  district: string
  address: string
  rcaCode: string
  rcaName: string
  latitude: number | null
  longitude: number | null
  visitFrequency: string
  visitDay: string
  daysWithoutPurchase: number
  isRouted: boolean
  isPex: boolean
  premiseCluster: string
  premiseRange: string
  channelType: string
  premiseProfile: string
  premiseNetwork: string
  totalFaturado: number
  totalAFaturar: number
  lastPurchaseDate: string
  movementCount: number
}

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

export function CarteiraTab({ clientBase, movementBase, activeComp }: {
  clientBase: CanonicalClient[]
  movementBase: CanonicalMovement[]
  activeComp: string
}) {
  const [pexFilter, setPexFilter] = useState<PexFilter>('todos')
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tabela' | 'mapa'>('tabela')
  const [rcas, setRcas] = useState<RcaRecord[]>([])

  useEffect(() => {
    setRcas(readRcas())
    const handler = () => setRcas(readRcas())
    window.addEventListener('rj-rcas-changed', handler)
    return () => window.removeEventListener('rj-rcas-changed', handler)
  }, [])

  const rcaMap = useMemo(() => {
    const m = new Map<string, RcaRecord>()
    for (const r of rcas) m.set(r.code, r)
    return m
  }, [rcas])

  const [y, mo] = activeComp.split('-').map(Number)
  const monthStart = `${activeComp}-01`
  const curComp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthEnd = activeComp >= curComp
    ? today
    : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`

  const movsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    for (const m of movementBase) {
      const key = m.customerCode ?? m.customerDocument ?? ''
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return map
  }, [movementBase])

  const monthMovsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    for (const m of movementBase) {
      const d = m.movementDate ?? ''
      if (d < monthStart || d > monthEnd) continue
      const key = m.customerCode ?? m.customerDocument ?? ''
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return map
  }, [movementBase, monthStart, monthEnd])

  const isPexClient = useCallback((c: CanonicalClient) => {
    return !!(c.premiseCluster || c.premiseRange || c.channelType || c.premiseProfile)
  }, [])

  const clientDetails = useMemo(() => {
    const details: ClientDetail[] = []
    for (const c of clientBase) {
      const isPex = isPexClient(c)
      if (pexFilter === 'pex' && !isPex) continue
      if (pexFilter === 'nao-pex' && isPex) continue

      const code = c.winthorCode ?? c.document
      const allMovs = movsByCustomer.get(code) ?? movsByCustomer.get(c.document) ?? []
      const monthMovs = monthMovsByCustomer.get(code) ?? monthMovsByCustomer.get(c.document) ?? []

      let lastDate = ''
      for (const m of allMovs) {
        const d = m.movementDate ?? ''
        if (d > lastDate) lastDate = d
      }

      let fat = 0, aFat = 0
      for (const m of monthMovs) {
        if (m.movementType === 'venda_faturada') fat += m.value ?? 0
        else if (m.movementType === 'a_faturar') aFat += m.value ?? 0
        else if (m.movementType === 'devolucao') fat -= m.value ?? 0
      }

      const lat = c.latitude ? parseFloat(c.latitude) : null
      const lng = c.longitude ? parseFloat(c.longitude) : null

      details.push({
        document: c.document,
        winthorCode: c.winthorCode ?? '',
        name: c.legalName ?? c.tradeName ?? c.document,
        tradeName: c.tradeName ?? '',
        city: c.city ?? '',
        district: c.district ?? '',
        address: c.address ?? '',
        rcaCode: c.rcaCode ?? '',
        rcaName: c.rcaName ?? c.representative ?? '',
        latitude: lat && !isNaN(lat) ? lat : null,
        longitude: lng && !isNaN(lng) ? lng : null,
        visitFrequency: c.visitFrequency ?? '',
        visitDay: c.visitDay ?? '',
        daysWithoutPurchase: c.daysWithoutPurchase ? parseInt(c.daysWithoutPurchase) : (lastDate ? daysSince(lastDate) : -1),
        isRouted: !!(c.visitFrequency || c.visitDay),
        isPex,
        premiseCluster: c.premiseCluster ?? '',
        premiseRange: c.premiseRange ?? '',
        channelType: c.channelType ?? '',
        premiseProfile: c.premiseProfile ?? '',
        premiseNetwork: c.premiseNetwork ?? '',
        totalFaturado: fat,
        totalAFaturar: aFat,
        lastPurchaseDate: lastDate,
        movementCount: allMovs.length,
      })
    }
    return details
  }, [clientBase, pexFilter, movsByCustomer, monthMovsByCustomer, isPexClient])

  const sellerSummaries = useMemo(() => {
    const map = new Map<string, SellerSummary>()
    for (const c of clientDetails) {
      const code = c.rcaCode || '000'
      const rca = rcaMap.get(code)
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: rca?.name ?? c.rcaName ?? (code === '000' ? 'Sem vendedor' : `RCA ${code}`),
          supervisor: rca?.supervisor ?? '',
          totalClients: 0,
          routedClients: 0,
          notRoutedClients: 0,
          pexClients: 0,
          totalFaturado: 0,
          totalAFaturar: 0,
          clientCodes: [],
          goal: rca?.goal ?? null,
          class: rca?.class ?? '',
        })
      }
      const s = map.get(code)!
      s.totalClients++
      if (c.isRouted) s.routedClients++
      else s.notRoutedClients++
      if (c.isPex) s.pexClients++
      s.totalFaturado += c.totalFaturado
      s.totalAFaturar += c.totalAFaturar
      s.clientCodes.push(c.winthorCode || c.document)
    }
    return [...map.values()].sort((a, b) => b.totalFaturado - a.totalFaturado)
  }, [clientDetails, rcaMap])

  const filteredSellers = useMemo(() => {
    if (!search) return sellerSummaries
    const q = search.toLowerCase()
    return sellerSummaries.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.code.includes(q) ||
      s.supervisor.toLowerCase().includes(q)
    )
  }, [sellerSummaries, search])

  const selectedSellerClients = useMemo(() => {
    if (!selectedSeller) return clientDetails
    return clientDetails.filter(c => (c.rcaCode || '000') === selectedSeller)
  }, [clientDetails, selectedSeller])

  const filteredClients = useMemo(() => {
    if (!search && selectedSeller) return selectedSellerClients
    if (!search) return clientDetails
    const q = search.toLowerCase()
    const list = selectedSeller ? selectedSellerClients : clientDetails
    return list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.tradeName.toLowerCase().includes(q) ||
      c.winthorCode.includes(q) ||
      c.document.includes(q) ||
      c.city.toLowerCase().includes(q)
    )
  }, [search, selectedSeller, selectedSellerClients, clientDetails])

  const mapClients = useMemo(() =>
    filteredClients.filter(c => c.latitude !== null && c.longitude !== null),
    [filteredClients]
  )

  const mapCenter = useMemo<[number, number]>(() => {
    if (mapClients.length === 0) return [-14.235, -51.925]
    const lat = mapClients.reduce((s, c) => s + c.latitude!, 0) / mapClients.length
    const lng = mapClients.reduce((s, c) => s + c.longitude!, 0) / mapClients.length
    return [lat, lng]
  }, [mapClients])

  const totalCarteira = clientDetails.length
  const totalRouted = clientDetails.filter(c => c.isRouted).length
  const totalPex = clientDetails.filter(c => c.isPex).length
  const totalFat = clientDetails.reduce((s, c) => s + c.totalFaturado, 0)
  const totalWithCoords = clientDetails.filter(c => c.latitude !== null).length

  const clientMovHistory = useCallback((code: string, doc: string) => {
    return movsByCustomer.get(code) ?? movsByCustomer.get(doc) ?? []
  }, [movsByCustomer])

  const MOV_LABEL: Record<string, string> = {
    venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução',
    bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className={`stock-nav-btn${!selectedSeller ? ' on' : ''}`} onClick={() => { setSelectedSeller(null); setExpandedClient(null) }}>
            Vendedores
          </button>
          {selectedSeller && (
            <button type="button" className="stock-nav-btn on" style={{ opacity: 0.8 }}>
              {sellerSummaries.find(s => s.code === selectedSeller)?.name ?? selectedSeller}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className={`stock-nav-btn${pexFilter === 'todos' ? ' on' : ''}`} onClick={() => setPexFilter('todos')}>Todos</button>
          <button type="button" className={`stock-nav-btn${pexFilter === 'pex' ? ' on' : ''}`} onClick={() => setPexFilter('pex')}>PEX</button>
          <button type="button" className={`stock-nav-btn${pexFilter === 'nao-pex' ? ' on' : ''}`} onClick={() => setPexFilter('nao-pex')}>Não PEX</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className={`stock-nav-btn${viewMode === 'tabela' ? ' on' : ''}`} onClick={() => setViewMode('tabela')}>Tabela</button>
          <button type="button" className={`stock-nav-btn${viewMode === 'mapa' ? ' on' : ''}`} onClick={() => setViewMode('mapa')}>Mapa</button>
        </div>
        <input
          type="search"
          placeholder="Buscar vendedor, cliente, cidade…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', minWidth: 180 }}
        />
      </header>

      {/* KPIs */}
      <div className="kpi-row" style={{ padding: '12px 16px 0' }}>
        <KpiCard label="Carteira" value={totalCarteira.toLocaleString('pt-BR')} sub={`${sellerSummaries.length} vendedores`} />
        <KpiCard label="Roterizados" value={totalRouted.toLocaleString('pt-BR')} sub={`${totalCarteira ? ((totalRouted / totalCarteira) * 100).toFixed(1) : 0}%`} />
        <KpiCard label="PEX" value={totalPex.toLocaleString('pt-BR')} sub={`${totalCarteira ? ((totalPex / totalCarteira) * 100).toFixed(1) : 0}%`} />
        <KpiCard label="Faturado no mês" value={kpiCurrency(totalFat)} />
        <KpiCard label="Com coordenadas" value={totalWithCoords.toLocaleString('pt-BR')} sub={`${totalCarteira ? ((totalWithCoords / totalCarteira) * 100).toFixed(1) : 0}%`} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {viewMode === 'mapa' ? (
          <div style={{ height: 'calc(100vh - 250px)', minHeight: 400, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {mapClients.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                Nenhum cliente com coordenadas {pexFilter !== 'todos' ? `(filtro: ${pexFilter})` : ''}
              </div>
            ) : (
              <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }} key={`${mapCenter[0]}-${mapCenter[1]}`}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapClients.map(c => (
                  <CircleMarker
                    key={c.document}
                    center={[c.latitude!, c.longitude!]}
                    radius={Math.max(4, Math.min(12, Math.log10(c.totalFaturado + 1) * 2))}
                    pathOptions={{
                      color: c.totalFaturado > 0 ? '#22c55e' : c.isRouted ? '#3b82f6' : '#ef4444',
                      fillColor: c.totalFaturado > 0 ? '#22c55e' : c.isRouted ? '#3b82f6' : '#ef4444',
                      fillOpacity: 0.7,
                      weight: 1,
                    }}
                  >
                    <Popup>
                      <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
                        <strong>{c.name}</strong><br />
                        {c.tradeName && <>{c.tradeName}<br /></>}
                        Código: {c.winthorCode}<br />
                        CNPJ: {c.document}<br />
                        {c.city && <>Cidade: {c.city}<br /></>}
                        {c.district && <>Bairro: {c.district}<br /></>}
                        RCA: {c.rcaCode} — {c.rcaName || 'N/A'}<br />
                        Faturado: {brlFull(c.totalFaturado)}<br />
                        {c.visitFrequency && <>Frequência: {c.visitFrequency}<br /></>}
                        {c.visitDay && <>Dia visita: {c.visitDay}<br /></>}
                        {c.lastPurchaseDate && <>Última compra: {fmtDay(c.lastPurchaseDate)}<br /></>}
                        {c.isPex && <>PEX: {c.premiseCluster} · {c.channelType}<br /></>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginRight: 4 }} />Comprou no mês</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginRight: 4 }} />Roteirizado</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', marginRight: 4 }} />Sem roteiro/compra</span>
              <span>{mapClients.length} clientes no mapa</span>
            </div>
          </div>
        ) : !selectedSeller ? (
          /* Seller summary table */
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Vendedor</th>
                  <th>Supervisor</th>
                  <th style={{ textAlign: 'right' }}>Clientes</th>
                  <th style={{ textAlign: 'right' }}>Roterizados</th>
                  <th style={{ textAlign: 'right' }}>Não roterizado</th>
                  <th style={{ textAlign: 'right' }}>PEX</th>
                  <th style={{ textAlign: 'right' }}>Faturado</th>
                  <th style={{ textAlign: 'right' }}>A faturar</th>
                  <th style={{ textAlign: 'right' }}>Meta</th>
                  <th style={{ textAlign: 'right' }}>% Meta</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.map(s => {
                  const pctMeta = s.goal && s.goal > 0 ? (s.totalFaturado / s.goal) * 100 : null
                  return (
                    <tr key={s.code} onClick={() => { setSelectedSeller(s.code); setSearch('') }} style={{ cursor: 'pointer' }}>
                      <td>{s.code}</td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.supervisor}</td>
                      <td style={{ textAlign: 'right' }}>{s.totalClients}</td>
                      <td style={{ textAlign: 'right' }}>{s.routedClients}</td>
                      <td style={{ textAlign: 'right' }}>{s.notRoutedClients}</td>
                      <td style={{ textAlign: 'right' }}>{s.pexClients}</td>
                      <td style={{ textAlign: 'right' }}>{kpiCurrency(s.totalFaturado)}</td>
                      <td style={{ textAlign: 'right' }}>{kpiCurrency(s.totalAFaturar)}</td>
                      <td style={{ textAlign: 'right' }}>{s.goal ? kpiCurrency(s.goal) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {pctMeta !== null ? (
                          <span style={{ color: pctMeta >= 100 ? '#22c55e' : pctMeta >= 70 ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                            {pctMeta.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{filteredSellers.reduce((s, x) => s + x.totalClients, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{filteredSellers.reduce((s, x) => s + x.routedClients, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{filteredSellers.reduce((s, x) => s + x.notRoutedClients, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{filteredSellers.reduce((s, x) => s + x.pexClients, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{kpiCurrency(filteredSellers.reduce((s, x) => s + x.totalFaturado, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{kpiCurrency(filteredSellers.reduce((s, x) => s + x.totalAFaturar, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{kpiCurrency(filteredSellers.reduce((s, x) => s + (x.goal ?? 0), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* Client list for selected seller */
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={() => { setSelectedSeller(null); setExpandedClient(null) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                ← Voltar para vendedores
              </button>
              <span style={{ color: 'var(--text-dim)' }}>
                {filteredClients.length} clientes
              </span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Cidade</th>
                    <th>Bairro</th>
                    <th style={{ textAlign: 'center' }}>Roterizado</th>
                    <th style={{ textAlign: 'center' }}>PEX</th>
                    <th style={{ textAlign: 'right' }}>Faturado</th>
                    <th style={{ textAlign: 'right' }}>Dias s/ compra</th>
                    <th style={{ textAlign: 'right' }}>Última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(c => {
                    const isExpanded = expandedClient === c.document
                    const movs = isExpanded ? clientMovHistory(c.winthorCode, c.document) : []
                    return (
                      <tr key={c.document} style={{ cursor: 'pointer' }} onClick={() => setExpandedClient(isExpanded ? null : c.document)}>
                        <td>{c.winthorCode}</td>
                        <td>
                          <div>
                            <strong>{c.name}</strong>
                            {c.tradeName && c.tradeName !== c.name && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.tradeName}</div>}
                            {isExpanded && (
                              <div style={{ marginTop: 8, padding: 12, background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 20px', marginBottom: 12 }}>
                                  <span>CNPJ: <strong>{c.document}</strong></span>
                                  <span>Endereço: <strong>{c.address}</strong></span>
                                  {c.visitFrequency && <span>Frequência: <strong>{c.visitFrequency}</strong></span>}
                                  {c.visitDay && <span>Dia visita: <strong>{c.visitDay}</strong></span>}
                                  {c.channelType && <span>Canal: <strong>{c.channelType}</strong></span>}
                                  {c.premiseCluster && <span>Cluster: <strong>{c.premiseCluster}</strong></span>}
                                  {c.premiseRange && <span>Faixa: <strong>{c.premiseRange}</strong></span>}
                                  {c.premiseProfile && <span>Perfil: <strong>{c.premiseProfile}</strong></span>}
                                  {c.premiseNetwork && <span>Rede: <strong>{c.premiseNetwork}</strong></span>}
                                  {c.latitude !== null && <span>Coordenadas: <strong>{c.latitude?.toFixed(5)}, {c.longitude?.toFixed(5)}</strong></span>}
                                </div>
                                {movs.length > 0 && (
                                  <table className="data-table" style={{ fontSize: 11 }}>
                                    <thead>
                                      <tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Vendedor</th><th style={{ textAlign: 'right' }}>Qtd</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                                    </thead>
                                    <tbody>
                                      {movs.sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? '')).slice(0, 50).map((m, i) => (
                                        <tr key={i}>
                                          <td>{m.movementDate ? fmtDay(m.movementDate) : ''}</td>
                                          <td>{MOV_LABEL[m.movementType] ?? m.movementType}</td>
                                          <td>{m.description ?? m.productCode ?? ''}</td>
                                          <td>{m.seller ?? m.sellerCode ?? ''}</td>
                                          <td style={{ textAlign: 'right' }}>{m.quantity ?? ''}</td>
                                          <td style={{ textAlign: 'right' }}>{m.value != null ? brlFull(m.value) : ''}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                {movs.length === 0 && <div style={{ color: 'var(--text-dim)' }}>Nenhuma movimentação registrada</div>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{c.city}</td>
                        <td>{c.district}</td>
                        <td style={{ textAlign: 'center' }}>{c.isRouted ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{c.isPex ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{c.totalFaturado > 0 ? kpiCurrency(c.totalFaturado) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{c.daysWithoutPurchase >= 0 ? c.daysWithoutPurchase : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{c.lastPurchaseDate ? fmtDay(c.lastPurchaseDate) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
