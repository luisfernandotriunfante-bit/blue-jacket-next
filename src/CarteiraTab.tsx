import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'
import { readRcas, type RcaRecord } from './RcaManager'
import { msGeo, MS_W, MS_H } from './msGeo'

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

const RAMP = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)']
const GREEN_DONE = '#22c55e'
function bin(v: number, max: number): number {
  if (max <= 1) return 2
  return Math.min(4, Math.floor((v - 1) / max * 5))
}

type Mode = 'rot' | 'nao' | 'sem'
type PexFilter = 'all' | 'pex' | 'nao-pex'

interface SellerData {
  code: string
  name: string
  supervisor: string
  totalClients: number
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
  profile: string
  sources: string[]
  fat: number
  fat3m: number
  avg3m: number
  fatTotal: number
  avgMensal: number
  mesesComDados: number
  premiseAvg12m: number | undefined
  lastDate: string
  routed: boolean
  rcaCode: string
  rcaName: string
  hasCadastro: boolean
}

/* ── Component ────────────────────────────────────────── */
export function CarteiraTab({ clientBase, movementBase, activeComp, pexSet }: {
  clientBase: CanonicalClient[]
  movementBase: CanonicalMovement[]
  activeComp: string
  pexSet: Set<string>
}) {
  const [mode, setMode] = useState<Mode>('rot')
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [rcas, setRcas] = useState<RcaRecord[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [pexFilter, setPexFilter] = useState<PexFilter>('all')
  const [filterRange, setFilterRange] = useState<string[]>([])
  const [filterNetwork, setFilterNetwork] = useState<string[]>([])
  const [filterProfile, setFilterProfile] = useState<string[]>([])
  const [filterSource, setFilterSource] = useState<string[]>([])
  const [filterChannel, setFilterChannel] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRcas(readRcas())
    const h = () => setRcas(readRcas())
    window.addEventListener('rj-rcas-changed', h)
    return () => window.removeEventListener('rj-rcas-changed', h)
  }, [])

  useEffect(() => { setSelectedSeller(null); setSelectedCity(null); setExpandedClient(null); setPexFilter('all'); setFilterRange([]); setFilterNetwork([]); setFilterProfile([]); setFilterSource([]); setFilterChannel([]); setOpenFilter(null) }, [mode])

  const rcaMap = useMemo(() => {
    const m = new Map<string, RcaRecord>()
    for (const r of rcas) if (r.active) {
      const key = r.code.replace(/\D/g, '').replace(/^0+/, '') || r.code
      m.set(key, r)
    }
    return m
  }, [rcas])

  const [y, mo] = activeComp.split('-').map(Number)
  const monthStart = `${activeComp}-01`
  const curComp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthEnd = activeComp >= curComp ? today : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`

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

  const threeMonthRange = useMemo(() => {
    const d = new Date(y, mo - 1, 1)
    d.setMonth(d.getMonth() - 2)
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { start, end: monthEnd }
  }, [y, mo, monthEnd])

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
      const movs3m = allMovs.filter(m => { const d = m.movementDate ?? ''; return d >= threeMonthRange.start && d <= threeMonthRange.end })
      let fat3m = 0
      for (const m of movs3m) {
        if (m.movementType === 'venda_faturada') fat3m += m.value ?? 0
        else if (m.movementType === 'devolucao') fat3m -= m.value ?? 0
      }
      let lastDate = ''
      let fatTotal = 0
      const activeMonths = new Set<string>()
      for (const m of allMovs) {
        const d = m.movementDate ?? ''
        if (d > lastDate) lastDate = d
        if (m.movementType === 'venda_faturada') { fatTotal += m.value ?? 0; if (d) activeMonths.add(d.slice(0, 7)) }
        else if (m.movementType === 'devolucao') fatTotal -= m.value ?? 0
      }
      const mesesComDados = activeMonths.size || 1
      const hasCadastro = c.sources.some(s => s !== 'Pirâmide')
      const resolvedRca = c.rcaCodes?.find(r => rcaMap.has(r.code))
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
        profile: c.premiseProfile ?? '',
        sources: c.sources ?? [],
        fat,
        fat3m,
        avg3m: fat3m / 3,
        fatTotal,
        avgMensal: fatTotal / mesesComDados,
        mesesComDados: activeMonths.size,
        premiseAvg12m: c.premiseAverage12Months,
        lastDate,
        routed: c.sources.includes('Roteiro geral'),
        rcaCode: resolvedRca?.code ?? c.rcaCode ?? '',
        rcaName: resolvedRca?.name ?? c.rcaName ?? c.representative ?? '',
        hasCadastro,
      }
    })
  }, [clientBase, movsByCustomer, monthStart, monthEnd, threeMonthRange, rcaMap])

  const availableRanges = useMemo(() => [...new Set(allClients.map(c => c.range).filter(Boolean))].sort(), [allClients])
  const availableNetworks = useMemo(() => [...new Set(allClients.map(c => c.network).filter(Boolean))].sort(), [allClients])
  const availableProfiles = useMemo(() => [...new Set(allClients.map(c => c.profile).filter(Boolean))].sort(), [allClients])
  const availableSources = useMemo(() => [...new Set(allClients.flatMap(c => c.sources))].sort(), [allClients])
  const availableChannels = useMemo(() => [...new Set(allClients.map(c => c.channel).filter(Boolean))].sort(), [allClients])

  const hasActiveFilter = filterRange.length > 0 || filterNetwork.length > 0 || filterProfile.length > 0 || filterSource.length > 0 || filterChannel.length > 0

  const applyFilters = useCallback((list: ClientRow[]) => {
    if (!hasActiveFilter) return list
    return list.filter(c => {
      if (filterRange.length && !filterRange.includes(c.range)) return false
      if (filterNetwork.length && !filterNetwork.includes(c.network)) return false
      if (filterProfile.length && !filterProfile.includes(c.profile)) return false
      if (filterSource.length && !filterSource.some(s => c.sources.includes(s))) return false
      if (filterChannel.length && !filterChannel.includes(c.channel)) return false
      return true
    })
  }, [hasActiveFilter, filterRange, filterNetwork, filterProfile, filterSource, filterChannel])

  const filteredClients = useMemo(() => hasActiveFilter ? applyFilters(allClients) : allClients, [allClients, hasActiveFilter, applyFilters])

  const sellers = useMemo<SellerData[]>(() => {
    const map = new Map<string, SellerData>()
    for (const c of filteredClients) {
      if (!c.routed || !c.rcaCode) continue
      if (!rcaMap.has(c.rcaCode)) continue
      const code = c.rcaCode
      const rca = rcaMap.get(code)!
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: rca.name || `RCA ${code}`,
          supervisor: rca.supervisor ?? '',
          totalClients: 0,
          cities: {},
          clientList: {},
        })
      }
      const s = map.get(code)!
      s.totalClients++
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
  }, [filteredClients, rcaMap])

  const naoByCity = useMemo(() => {
    const m: Record<string, ClientRow[]> = {}
    for (const c of filteredClients) {
      if (c.routed && rcaMap.has(c.rcaCode)) continue
      if (!c.hasCadastro) continue
      const ck = matchCity(c.city)
      if (!ck) continue
      if (!m[ck]) m[ck] = []
      m[ck].push(c)
    }
    return m
  }, [filteredClients, rcaMap])

  const semByCity = useMemo(() => {
    const m: Record<string, ClientRow[]> = {}
    for (const c of filteredClients) {
      if (c.hasCadastro) continue
      const ck = matchCity(c.city)
      if (!ck) continue
      if (!m[ck]) m[ck] = []
      m[ck].push(c)
    }
    return m
  }, [filteredClients])

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

  const isPex = useCallback((c: ClientRow) => pexSet.has(c.document), [pexSet])

  const filteredNaoByCity = useMemo(() => {
    if (pexFilter === 'all') return naoByCity
    const m: Record<string, ClientRow[]> = {}
    for (const [ck, clients] of Object.entries(naoByCity)) {
      const f = clients.filter(c => pexFilter === 'pex' ? isPex(c) : !isPex(c))
      if (f.length) m[ck] = f
    }
    return m
  }, [naoByCity, pexFilter, isPex])

  const filteredSemByCity = useMemo(() => {
    if (pexFilter === 'all') return semByCity
    const m: Record<string, ClientRow[]> = {}
    for (const [ck, clients] of Object.entries(semByCity)) {
      const f = clients.filter(c => pexFilter === 'pex' ? isPex(c) : !isPex(c))
      if (f.length) m[ck] = f
    }
    return m
  }, [semByCity, pexFilter, isPex])

  const naoCount = useMemo(() => {
    const base = filteredClients.filter(c => !(c.routed && rcaMap.has(c.rcaCode)) && c.hasCadastro)
    if (pexFilter === 'all') return base.length
    return base.filter(c => pexFilter === 'pex' ? isPex(c) : !isPex(c)).length
  }, [filteredClients, rcaMap, pexFilter, isPex])
  const semCount = useMemo(() => {
    const base = filteredClients.filter(c => !c.hasCadastro)
    if (pexFilter === 'all') return base.length
    return base.filter(c => pexFilter === 'pex' ? isPex(c) : !isPex(c)).length
  }, [filteredClients, pexFilter, isPex])
  const activeData = mode === 'nao' ? filteredNaoByCity : mode === 'sem' ? filteredSemByCity : {}

  const cityCompletion = useMemo(() => {
    if (mode === 'rot') return {} as Record<string, { total: number; assigned: number }>
    const result: Record<string, { total: number; assigned: number }> = {}
    for (const [ck, clients] of Object.entries(activeData)) {
      const assigned = clients.filter(c => assignments[c.document]).length
      result[ck] = { total: clients.length, assigned }
    }
    return result
  }, [mode, activeData, assignments])

  const totalAssigned = useMemo(() => {
    let a = 0, t = 0
    for (const v of Object.values(cityCompletion)) { a += v.assigned; t += v.total }
    return { assigned: a, total: t }
  }, [cityCompletion])

  const assignSeller = useCallback((clientDoc: string, sellerCode: string) => {
    setAssignments(prev => {
      const next = { ...prev }
      if (sellerCode) next[clientDoc] = sellerCode
      else delete next[clientDoc]
      return next
    })
  }, [])

  const downloadReport = useCallback(() => {
    const rows: string[][] = [['Cliente', 'CNPJ', 'Cidade', 'Canal', 'Faixa', 'Rede', 'Vendedor Atribuído', 'Cód. Vendedor', 'Supervisor', 'Fat. Mês Atual', 'Fat. 3m Interno', 'Média 3m Interno', 'Média Mensal Interno', 'Meses c/ Dados', 'Colgate Mercado 3m']]
    for (const [ck, clients] of Object.entries(activeData)) {
      for (const c of clients) {
        const selCode = assignments[c.document]
        if (!selCode) continue
        const seller = sellers.find(s => s.code === selCode)
        rows.push([c.name, c.document, msGeo[ck]?.n ?? ck, c.channel, c.range, c.network, seller?.name ?? '', selCode, seller?.supervisor ?? '', c.fat.toFixed(2), c.fat3m.toFixed(2), c.avg3m.toFixed(2), c.avgMensal.toFixed(2), String(c.mesesComDados), c.premiseAvg12m != null ? c.premiseAvg12m.toFixed(2) : ''])
      }
    }
    if (rows.length <= 1) return
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roteirizacao-${mode}-${activeComp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeData, assignments, sellers, mode, activeComp])

  const filteredSellers = useMemo(() => {
    if (!search) return sellers
    const q = search.toLowerCase()
    return sellers.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q) || s.supervisor.toLowerCase().includes(q))
  }, [sellers, search])

  const filteredCities = useMemo(() => {
    const data = mode === 'nao' ? filteredNaoByCity : filteredSemByCity
    const keys = Object.keys(data).sort((a, b) => (data[b]?.length ?? 0) - (data[a]?.length ?? 0))
    if (!search) return keys
    const q = search.toLowerCase()
    return keys.filter(k => msGeo[k].n.toLowerCase().includes(q))
  }, [mode, filteredNaoByCity, filteredSemByCity, search])

  /* painting */
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
      const data = activeData
      const vals = Object.values(data).map(l => l.length)
      const max = Math.max(...vals, 1)
      for (const [ck, l] of Object.entries(data)) {
        const comp = cityCompletion[ck]
        if (comp && comp.total > 0 && comp.assigned === comp.total) {
          colors[ck] = GREEN_DONE
        } else {
          colors[ck] = RAMP[bin(l.length, max)]
        }
      }
    }
    return colors
  }, [mode, sel, sellers, activeData, cityCompletion])

  const maxLegend = useMemo(() => {
    if (mode === 'rot') {
      if (sel) return Math.max(...Object.values(sel.cities).map(c => c.clients), 1)
      const byC: Record<string, number> = {}
      for (const s of sellers) for (const ck of Object.keys(s.cities)) byC[ck] = (byC[ck] ?? 0) + 1
      return Math.max(...Object.values(byC), 1)
    }
    return Math.max(...Object.values(activeData).map(l => l.length), 1)
  }, [mode, sel, sellers, activeData])

  /* tooltip */
  const showTip = useCallback((e: React.MouseEvent, ck: string) => {
    const tip = tipRef.current
    const svg = svgRef.current
    if (!tip || !svg) return
    const container = svg.parentElement!
    const r = container.getBoundingClientRect()
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
      const comp = cityCompletion[ck]
      html += `<br>${d.length} cliente${d.length !== 1 ? 's' : ''} ${mode === 'nao' ? 'sem roteiro' : 'sem cadastro'}`
      if (comp && comp.assigned > 0) html += `<br>${comp.assigned}/${comp.total} atribuído${comp.assigned !== 1 ? 's' : ''}${comp.assigned === comp.total ? ' ✓' : ''}`
    }
    tip.innerHTML = html
    tip.style.display = 'block'
    let x = e.clientX - r.left + 12
    let yy = e.clientY - r.top + 12
    if (x > r.width - 270) x -= 280
    if (yy > r.height - 60) yy -= 70
    tip.style.left = x + 'px'
    tip.style.top = yy + 'px'
  }, [mode, sel, sellersByCity, activeData])

  const hideTip = useCallback(() => {
    if (tipRef.current) tipRef.current.style.display = 'none'
  }, [])

  const clickCity = useCallback((ck: string) => {
    if (mode === 'rot') {
      if (sel) {
        if (sel.cities[ck]) setExpandedClient(expandedClient === ck ? null : ck)
      } else {
        const sl = sellersByCity[ck]
        if (sl?.length === 1) {
          setSelectedSeller(sl[0].code)
          setExpandedClient(null)
        } else if (sl?.length) {
          setSelectedCity(selectedCity === ck ? null : ck)
        }
      }
    } else {
      setSelectedCity(selectedCity === ck ? null : ck)
    }
  }, [mode, sel, selectedCity, expandedClient, sellersByCity])

  const clientHistory = useCallback((code: string, doc: string) => {
    return (movsByCustomer.get(code) ?? movsByCustomer.get(doc) ?? []).sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? '')).slice(0, 30)
  }, [movsByCustomer])

  const MOV_LABEL: Record<string, string> = { venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução', bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada' }

  /* division table data */
  const divisionTable = useMemo(() => {
    const divs = new Map<string, { total: number; rot: number; noRoute: number; noRca: number; sem: number }>()
    for (const c of filteredClients) {
      const div = c.channel || 'Outros'
      if (!divs.has(div)) divs.set(div, { total: 0, rot: 0, noRoute: 0, noRca: 0, sem: 0 })
      const d = divs.get(div)!
      d.total++
      if (c.routed && rcaMap.has(c.rcaCode)) d.rot++
      else if (c.hasCadastro) {
        if (c.routed) d.noRca++
        else d.noRoute++
      }
      else d.sem++
    }
    return [...divs.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [filteredClients, rcaMap])

  /* side panel */
  const renderSide = () => {
    if (mode === 'rot') {
      if (sel) {
        const ckList = Object.keys(sel.cities).sort((a, b) => sel.cities[b].clients - sel.cities[a].clients)
        const maxC = Math.max(...ckList.map(ck => sel.cities[ck].clients), 1)
        return (
          <div className="crt-side">
            <h2 className="crt-side-h2">{sel.name}</h2>
            <div className="crt-meta">
              <span>Cód. {sel.code}</span>
              {sel.supervisor && <span>Sup. {sel.supervisor}</span>}
            </div>
            <div className="crt-meta">
              <span><b>{sel.totalClients}</b> clientes</span>
              <span><b>{ckList.length}</b> cidades</span>
              <span><b>{kpiCurrency(Object.values(sel.cities).reduce((s, c) => s + c.fat, 0))}</b> faturado</span>
            </div>
            <div className="crt-rows">
              {ckList.map(ck => {
                const city = sel.cities[ck]
                const clients = sel.clientList[ck] ?? []
                const isOpen = expandedClient === ck
                return (
                  <details key={ck} className="crt-det" open={isOpen} onToggle={e => { if ((e.target as HTMLDetailsElement).open) setExpandedClient(ck); else if (expandedClient === ck) setExpandedClient(null) }}>
                    <summary>
                      <span>{msGeo[ck]?.n ?? ck}</span>
                      <span>{city.clients} cli · {kpiCurrency(city.fat)}</span>
                      <div className="crt-bar"><i style={{ width: `${city.clients / maxC * 100}%` }} /></div>
                    </summary>
                    <ul className="crt-cli">
                      {clients.map(c => (
                        <li key={c.document}>
                          <span>{c.name}<br /><small>{c.document}</small></span>
                          <span className="crt-v">{c.fat > 0 ? kpiCurrency(c.fat) : c.premiseAvg12m != null && c.premiseAvg12m > 0 ? `CG ${kpiCurrency(c.premiseAvg12m)}` : '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )
              })}
            </div>
          </div>
        )
      }
      if (selectedCity && sellersByCity[selectedCity]) {
        const sl = sellersByCity[selectedCity]
        return (
          <div className="crt-side">
            <h2 className="crt-side-h2">{msGeo[selectedCity]?.n ?? selectedCity}</h2>
            <div className="crt-meta"><span><b>{sl.length}</b> vendedor{sl.length > 1 ? 'es' : ''} na cidade</span></div>
            {sl.map(s => (
              <button key={s.code} type="button" onClick={() => { setSelectedSeller(s.code); setSelectedCity(null); setExpandedClient(null) }} className="crt-city-seller">
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="crt-sub">Cód. {s.code} · {s.cities[selectedCity]?.clients ?? 0} clientes</div>
              </button>
            ))}
          </div>
        )
      }
      /* overview */
      const topCities = cityKeys.map(ck => ({ ck, n: (sellersByCity[ck] ?? []).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8)
      const coveredCities = cityKeys.filter(ck => sellersByCity[ck]?.length).length
      const totDiv = divisionTable.reduce((a, [, d]) => ({ total: a.total + d.total, rot: a.rot + d.rot, noRoute: a.noRoute + d.noRoute, noRca: a.noRca + d.noRca, sem: a.sem + d.sem }), { total: 0, rot: 0, noRoute: 0, noRca: 0, sem: 0 })
      return (
        <div className="crt-side">
          <h2 className="crt-side-h2">Visão geral</h2>
          <div className="crt-meta">
            <span><b>{sellers.length}</b> vendedores</span>
            <span><b>{coveredCities}</b> cidades atendidas</span>
          </div>
          <p className="crt-note">Cidades com mais vendedores no mesmo roteiro:</p>
          <div className="crt-rows">
            {topCities.map(({ ck, n }) => (
              <div key={ck} className="crt-row" onClick={() => { setSelectedCity(ck) }} style={{ cursor: 'pointer' }}>
                <span>{msGeo[ck].n}</span>
                <span>{n} vendedor{n > 1 ? 'es' : ''}</span>
                <div className="crt-bar"><i style={{ width: `${n / topCities[0].n * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <h3 className="crt-h3">Clientes na carteira</h3>
          <table className="crt-tb">
            <thead>
              <tr><th>Canal</th><th>Total</th><th>Rot.</th><th title="Não aparece no Roteiro">Fora rot.</th><th title="No Roteiro mas RCA não cadastrado">RCA n/cad.</th><th>Sem cad.</th></tr>
            </thead>
            <tbody>
              {divisionTable.map(([div, d]) => (
                <tr key={div}><td>{div}</td><td>{d.total}</td><td>{d.rot}</td><td>{d.noRoute}</td><td>{d.noRca}</td><td>{d.sem}</td></tr>
              ))}
              <tr className="crt-tb-total"><td><b>Total</b></td><td><b>{totDiv.total}</b></td><td><b>{totDiv.rot}</b></td><td><b>{totDiv.noRoute}</b></td><td><b>{totDiv.noRca}</b></td><td><b>{totDiv.sem}</b></td></tr>
            </tbody>
          </table>
          <p className="crt-note">Escolha um vendedor para ver onde ele atua e quais clientes atende em cada cidade.</p>
        </div>
      )
    }
    /* nao / sem mode */
    if (selectedCity) {
      const clients = activeData[selectedCity] ?? []
      const cityVendors = sellersByCity[selectedCity] ?? []
      const comp = cityCompletion[selectedCity]
      const allSellers = sellers
      return (
        <div className="crt-side">
          <h2 className="crt-side-h2">{msGeo[selectedCity]?.n ?? selectedCity}</h2>
          <div className="crt-meta">
            <span><b>{clients.length}</b> {mode === 'nao' ? 'clientes sem roteiro' : 'clientes sem cadastro'}</span>
            {comp && comp.assigned > 0 && (
              <span style={{ color: comp.assigned === comp.total ? GREEN_DONE : 'var(--red)' }}>
                <b>{comp.assigned}/{comp.total}</b> atribuídos
              </span>
            )}
          </div>
          {comp && comp.total > 0 && (
            <div className="crt-progress">
              <div className="crt-progress-bar" style={{ width: `${comp.assigned / comp.total * 100}%`, background: comp.assigned === comp.total ? GREEN_DONE : 'var(--red)' }} />
            </div>
          )}
          {cityVendors.length > 0 && (
            <>
              <h3 className="crt-h3">Vendedores que podem atender</h3>
              {cityVendors.map(s => (
                <div key={s.code} className="crt-vend">
                  <span>{s.name}</span>
                  <span>{s.cities[selectedCity]?.clients ?? 0} cli na cidade</span>
                  <small>Cód. {s.code} · Sup. {s.supervisor}</small>
                </div>
              ))}
            </>
          )}
          {!cityVendors.length && (
            <p className="crt-warn">Nenhum vendedor tem roteiro em {msGeo[selectedCity]?.n ?? selectedCity}.</p>
          )}
          <h3 className="crt-h3">Atribuir vendedor aos clientes</h3>
          <div className="crt-rows">
            {clients.map(c => {
              const assigned = assignments[c.document] ?? ''
              return (
                <div key={c.document} className="crt-assign-row">
                  <div className="crt-assign-info">
                    <span className={assigned ? 'crt-assigned' : ''}>{c.name}</span>
                    <small>{c.document}{c.channel ? ` · ${c.channel}` : ''}{c.fat > 0 ? ` · ${kpiCurrency(c.fat)}` : ''}{c.avg3m > 0 ? ` · Méd.3m ${kpiCurrency(c.avg3m)}` : ''}{c.premiseAvg12m != null && c.premiseAvg12m > 0 && c.fat === 0 ? ` · CG.3m ${kpiCurrency(c.premiseAvg12m)}` : ''}</small>
                  </div>
                  <select
                    className="crt-select"
                    value={assigned}
                    onChange={e => assignSeller(c.document, e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {cityVendors.length > 0 && (
                      <optgroup label="Na cidade">
                        {cityVendors.map(s => (
                          <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                        ))}
                      </optgroup>
                    )}
                    {allSellers.filter(s => !cityVendors.some(cv => cv.code === s.code)).length > 0 && (
                      <optgroup label="Outros vendedores">
                        {allSellers.filter(s => !cityVendors.some(cv => cv.code === s.code)).map(s => (
                          <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    /* general view for nao/sem */
    const data = activeData
    const sorted = Object.keys(data).sort((a, b) => data[b].length - data[a].length)
    const total = sorted.reduce((a, ck) => a + data[ck].length, 0)
    const byChannel = new Map<string, number>()
    for (const ck of sorted) for (const c of data[ck]) byChannel.set(c.channel || 'Outros', (byChannel.get(c.channel || 'Outros') ?? 0) + 1)
    const channelList = [...byChannel.entries()].sort((a, b) => b[1] - a[1])
    const completeCities = sorted.filter(ck => { const comp = cityCompletion[ck]; return comp && comp.assigned === comp.total && comp.total > 0 }).length
    return (
      <div className="crt-side">
        <h2 className="crt-side-h2">{mode === 'nao' ? 'Clientes sem roteiro' : 'Sem cadastro'}</h2>
        <div className="crt-meta">
          <span><b>{total}</b> clientes</span>
          <span><b>{sorted.length}</b> cidades</span>
        </div>
        {totalAssigned.assigned > 0 && (
          <>
            <div className="crt-meta">
              <span style={{ color: GREEN_DONE }}><b>{totalAssigned.assigned}/{totalAssigned.total}</b> atribuídos</span>
              <span style={{ color: GREEN_DONE }}><b>{completeCities}/{sorted.length}</b> cidades completas</span>
            </div>
            <div className="crt-progress">
              <div className="crt-progress-bar" style={{ width: `${totalAssigned.assigned / totalAssigned.total * 100}%`, background: totalAssigned.assigned === totalAssigned.total ? GREEN_DONE : 'var(--red)' }} />
            </div>
          </>
        )}
        <div className="crt-meta">
          {channelList.slice(0, 4).map(([ch, n]) => (
            <span key={ch}>{ch}: <b>{n}</b></span>
          ))}
        </div>
        {totalAssigned.assigned > 0 && (
          <button type="button" className="crt-report-btn" onClick={downloadReport}>
            Gerar relatório ({totalAssigned.assigned} atribuições)
          </button>
        )}
        <p className="crt-note">{mode === 'nao'
          ? 'Clique numa cidade para atribuir vendedores aos clientes. Cidades verdes = todos atribuídos.'
          : 'Clique numa cidade para atribuir vendedores. Cidades verdes = todos atribuídos.'
        }</p>
        <div className="crt-rows">
          {sorted.map(ck => {
            const comp = cityCompletion[ck]
            const done = comp && comp.total > 0 && comp.assigned === comp.total
            return (
              <button key={ck} type="button" className="crt-rowbtn" onClick={() => setSelectedCity(selectedCity === ck ? null : ck)}>
                <div className="crt-row">
                  <span style={done ? { color: GREEN_DONE } : undefined}>{done ? '✓ ' : ''}{msGeo[ck]?.n ?? ck}</span>
                  <span>{data[ck].length} cli</span>
                  {comp && comp.assigned > 0 && !done && (
                    <span className="crt-sub" style={{ color: 'var(--red)' }}>{comp.assigned}/{comp.total} atribuídos</span>
                  )}
                  {!comp?.assigned && (
                    <span className="crt-sub">{(() => {
                      const sv = sellersByCity[ck] ?? []
                      return sv.length ? sv.map(s => s.name.split(' ')[0]).join(', ') : 'Sem vendedor com roteiro'
                    })()}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const legendLabel = mode === 'rot'
    ? (sel ? 'Clientes por cidade:' : 'Nº de vendedores na cidade:')
    : `Clientes ${mode === 'nao' ? 'sem roteiro' : 'sem cadastro'} por cidade:`

  return (
    <div className="crt-wrap">
      {/* Modes */}
      <div className="crt-modes">
        {([
          ['rot', 'Roterizados', `${sellers.length} vendedores`],
          ['nao', 'Não roterizados', `${naoCount} clientes`],
          ['sem', 'Sem cadastro', `${semCount} clientes`],
        ] as [Mode, string, string][]).map(([k, label, sub]) => (
          <button key={k} type="button" className="crt-mode" aria-pressed={mode === k} onClick={() => setMode(k)}>
            {label} <small>{sub}</small>
          </button>
        ))}
        {mode !== 'rot' && (
          <div className="crt-pex-filter">
            {(['all', 'pex', 'nao-pex'] as PexFilter[]).map(f => (
              <button key={f} type="button" className="crt-pex-btn" aria-pressed={pexFilter === f} onClick={() => setPexFilter(f)}>
                {f === 'all' ? 'Todos' : f === 'pex' ? 'PEX' : 'Não-PEX'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pf-filters-row" style={{ padding: '0 16px' }} onClick={() => setOpenFilter(null)}>
        {availableRanges.length > 0 && (
          <FilterDrop label="Faixa" options={availableRanges} selected={filterRange} onSelect={setFilterRange} open={openFilter === 'range'} onToggle={() => setOpenFilter(openFilter === 'range' ? null : 'range')} />
        )}
        {availableNetworks.length > 0 && (
          <FilterDrop label="Rede" options={availableNetworks} selected={filterNetwork} onSelect={setFilterNetwork} open={openFilter === 'network'} onToggle={() => setOpenFilter(openFilter === 'network' ? null : 'network')} />
        )}
        {availableProfiles.length > 0 && (
          <FilterDrop label="Perfil" options={availableProfiles} selected={filterProfile} onSelect={setFilterProfile} open={openFilter === 'profile'} onToggle={() => setOpenFilter(openFilter === 'profile' ? null : 'profile')} />
        )}
        {availableChannels.length > 0 && (
          <FilterDrop label="Canal" options={availableChannels} selected={filterChannel} onSelect={setFilterChannel} open={openFilter === 'channel'} onToggle={() => setOpenFilter(openFilter === 'channel' ? null : 'channel')} />
        )}
        {availableSources.length > 0 && (
          <FilterDrop label="Fonte" options={availableSources} selected={filterSource} onSelect={setFilterSource} open={openFilter === 'source'} onToggle={() => setOpenFilter(openFilter === 'source' ? null : 'source')} />
        )}
        {hasActiveFilter && (
          <button type="button" className="crt-clear-filters" onClick={e => { e.stopPropagation(); setFilterRange([]); setFilterNetwork([]); setFilterProfile([]); setFilterSource([]); setFilterChannel([]) }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grid: rail | map | side */}
      <div className="crt-grid">
        {/* Left rail */}
        <aside className="crt-card crt-rail">
          <input
            type="search"
            placeholder={mode === 'rot' ? 'Buscar vendedor…' : 'Buscar cidade…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="crt-q"
          />
          {mode === 'rot' && (
            <button
              type="button"
              className="crt-all"
              aria-pressed={!selectedSeller}
              onClick={() => { setSelectedSeller(null); setSelectedCity(null); setExpandedClient(null) }}
            >
              <span>Visão geral</span>
              <small>{sellers.length}</small>
            </button>
          )}
          <div className="crt-list">
            {mode === 'rot' ? (
              (() => {
                let lastSup = ''
                return filteredSellers.map(s => {
                  const showSup = s.supervisor !== lastSup
                  lastSup = s.supervisor
                  return (
                    <div key={s.code}>
                      {showSup && <div className="crt-sup">{s.supervisor || 'Sem supervisor'}</div>}
                      <button
                        type="button"
                        className="crt-seller"
                        aria-pressed={selectedSeller === s.code}
                        onClick={() => { setSelectedSeller(s.code); setSelectedCity(null); setExpandedClient(null) }}
                      >
                        <span>{s.name} <small style={{ opacity: .6 }}>({s.code})</small></span>
                        <small>{s.totalClients}</small>
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
                  className="crt-cty"
                  aria-pressed={selectedCity === ck}
                  onClick={() => setSelectedCity(selectedCity === ck ? null : ck)}
                >
                  <span>{msGeo[ck].n}</span>
                  <small>{activeData[ck]?.length ?? 0}</small>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="crt-card crt-mapcard">
          <svg ref={svgRef} viewBox={`0 0 ${MS_W} ${MS_H}`} className="crt-svg" role="img" aria-label="Mapa de Mato Grosso do Sul">
            {cityKeys.map(ck => {
              const geo = msGeo[ck]
              const color = cityColors[ck]
              const isSelected = (mode === 'rot' && sel && expandedClient === ck) || (mode === 'rot' && !sel && selectedCity === ck) || (mode !== 'rot' && selectedCity === ck)
              return (
                <path
                  key={ck}
                  d={geo.d}
                  style={{ fill: color ?? 'var(--surface-raised)', stroke: isSelected ? 'var(--text)' : undefined, strokeWidth: isSelected ? 2.5 : undefined }}
                  className={`crt-m${color ? ' on' : ''}${isSelected ? ' pick' : ''}`}
                  onMouseMove={e => showTip(e, ck)}
                  onMouseLeave={hideTip}
                  onClick={() => { if (color) clickCity(ck) }}
                />
              )
            })}
            {Object.keys(cityColors).map(ck => (
              <text
                key={`lbl-${ck}`}
                x={msGeo[ck].c[0]}
                y={msGeo[ck].c[1] + 5}
                className="crt-lbl"
              >
                {msGeo[ck].n}
              </text>
            ))}
          </svg>
          <div ref={tipRef} className="crt-tip" />
          <div className="crt-legend">
            <span>{legendLabel}</span>
            {RAMP.map((r, i) => (
              <span key={i}><i className="crt-sw" style={{ background: r }} />{i === 0 ? '1' : i === 4 ? `${maxLegend}+` : ''}</span>
            ))}
            <span><i className="crt-sw" style={{ background: 'var(--surface-raised)' }} />nenhum</span>
            {mode !== 'rot' && <span><i className="crt-sw" style={{ background: GREEN_DONE, borderRadius: 2 }} />completo</span>}
          </div>
        </main>

        {/* Side panel */}
        <aside className="crt-card crt-side-panel">
          {renderSide()}
        </aside>
      </div>

      <style>{CRT_STYLES}</style>
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

const CRT_MONO = 'ui-monospace, SFMono-Regular, monospace'

const CRT_STYLES = `
.crt-wrap {
  --r0: #5c2222;
  --r1: #8b2828;
  --r2: #c03030;
  --r3: #ed1c24;
  --r4: #ff7070;
  --r-soft: rgba(237, 28, 36, 0.15);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  gap: 14px;
  padding: 14px 0;
}
.theme-light .crt-wrap {
  --r0: #fde8e8;
  --r1: #f5a5a5;
  --r2: #e05050;
  --r3: #d4131b;
  --r4: #8a0d12;
  --r-soft: rgba(212, 19, 27, 0.12);
}
@media (prefers-color-scheme: light) {
  :root:not(.theme-dark) .crt-wrap {
    --r0: #fde8e8;
    --r1: #f5a5a5;
    --r2: #e05050;
    --r3: #d4131b;
    --r4: #8a0d12;
    --r-soft: rgba(212, 19, 27, 0.12);
  }
}
.crt-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px;
}
.crt-mode {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: 500 14px system-ui, sans-serif;
}
.crt-mode small {
  font: 400 11px ${CRT_MONO};
  color: var(--muted);
}
.crt-mode:hover { border-color: var(--red); }
.crt-mode[aria-pressed="true"] {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}
.crt-mode[aria-pressed="true"] small { color: rgba(255,255,255,.8); }
.crt-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 270px minmax(0,1fr) 340px;
  gap: 16px;
  align-items: start;
  padding: 0 16px;
  overflow: hidden;
}
.crt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 0;
}
.crt-rail {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 220px);
  overflow: hidden;
}
.crt-q {
  margin: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--text);
  font: inherit;
}
.crt-q:focus { outline: 2px solid var(--red); outline-offset: 2px; }
.crt-all {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 10px 6px;
  width: calc(100% - 20px);
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--text);
  font: inherit;
  font-weight: 500;
  padding: 7px 8px;
  cursor: pointer;
}
.crt-all small { font: 400 11px ${CRT_MONO}; opacity: .8; white-space: nowrap; align-self: center; }
.crt-all:hover { background: var(--background); }
.crt-all[aria-pressed="true"] { background: var(--red); color: #fff; }
.crt-list { overflow: auto; padding: 0 6px 10px; flex: 1; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.crt-list::-webkit-scrollbar { width: 6px; }
.crt-list::-webkit-scrollbar-track { background: transparent; }
.crt-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.crt-list::-webkit-scrollbar-thumb:hover { background: var(--muted); }
.crt-sup {
  font: 500 11px ${CRT_MONO};
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--muted);
  padding: 12px 8px 4px;
}
.crt-seller, .crt-cty {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  padding: 7px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.crt-seller:hover, .crt-cty:hover { background: var(--background); }
.crt-seller[aria-pressed="true"], .crt-cty[aria-pressed="true"] { background: var(--red); color: #fff; }
.crt-seller small, .crt-cty small {
  font: 400 11px ${CRT_MONO};
  opacity: .8;
  white-space: nowrap;
  align-self: center;
}
.crt-mapcard { padding: 8px; position: relative; }
.crt-svg { display: block; width: 100%; height: auto; max-height: calc(100vh - 280px); }
.crt-m { stroke: var(--border); stroke-width: .8; transition: fill .15s; }
.crt-m.on { cursor: pointer; }
.crt-m.pick { stroke: var(--text); stroke-width: 2.6; }
.crt-m:hover { stroke: var(--text); stroke-width: 1.6; }
.crt-lbl {
  font: 500 14px system-ui, sans-serif;
  fill: var(--text);
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 4px;
  pointer-events: none;
  text-anchor: middle;
}
.crt-tip {
  position: absolute;
  pointer-events: none;
  background: var(--text);
  color: var(--background);
  padding: 6px 9px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 260px;
  display: none;
  z-index: 10;
  line-height: 1.5;
}
.crt-tip b { font-weight: 600; }
.crt-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  padding: 6px 8px 2px;
  font-size: 12px;
  color: var(--muted);
}
.crt-sw {
  display: inline-block;
  width: 14px;
  height: 10px;
  margin-right: 3px;
  vertical-align: -1px;
}
.crt-side-panel {
  padding: 14px;
  max-height: calc(100vh - 220px);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.crt-side-panel::-webkit-scrollbar { width: 6px; }
.crt-side-panel::-webkit-scrollbar-track { background: transparent; }
.crt-side-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.crt-side-panel::-webkit-scrollbar-thumb:hover { background: var(--muted); }
.crt-side {
  display: grid;
  gap: 12px;
  align-content: start;
}
.crt-side-h2 { font: 700 18px/1.15 system-ui, sans-serif; margin: 0; color: var(--text); }
.crt-h3 {
  font: 500 11px ${CRT_MONO};
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--muted);
  margin: 4px 0 0;
}
.crt-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--muted);
  font-size: 12px;
}
.crt-meta b { font: 500 15px ${CRT_MONO}; color: var(--text); }
.crt-note { font-size: 12px; color: var(--muted); margin: 0; }
.crt-warn {
  font-size: 12px;
  background: rgba(237, 28, 36, 0.1);
  color: var(--red);
  padding: 7px 9px;
  border-radius: 4px;
  margin: 0;
}
.crt-rows { display: grid; gap: 0; }
.crt-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 2px 8px;
  font-size: 13px;
  padding: 6px 0;
  border-top: 1px solid var(--border);
}
.crt-row span:last-of-type {
  font: 400 12px ${CRT_MONO};
  text-align: right;
  white-space: nowrap;
}
.crt-sub {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--muted);
}
.crt-bar {
  grid-column: 1 / -1;
  height: 4px;
  background: var(--r-soft);
  border-radius: 2px;
}
.crt-bar i { display: block; height: 100%; background: var(--red); border-radius: 2px; }
.crt-tb {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.crt-tb th {
  font: 500 10px ${CRT_MONO};
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  text-align: right;
  padding: 4px 4px;
  border-bottom: 1px solid var(--border);
}
.crt-tb th:first-child, .crt-tb td:first-child { text-align: left; }
.crt-tb td {
  padding: 5px 4px;
  border-bottom: 1px solid var(--border);
  text-align: right;
  font-family: ${CRT_MONO};
  color: var(--text);
}
.crt-tb td:first-child { font-family: system-ui, sans-serif; }
.crt-tb-total td { font-weight: 600; }
.crt-det { border-top: 1px solid var(--border); }
.crt-det summary {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 2px 8px;
  font-size: 13px;
  padding: 7px 0;
  cursor: pointer;
  list-style: none;
}
.crt-det summary::-webkit-details-marker { display: none; }
.crt-det summary > span:first-child::before {
  content: '+';
  display: inline-block;
  width: 14px;
  font: 500 13px ${CRT_MONO};
  color: var(--red);
}
.crt-det[open] summary > span:first-child::before { content: '\\2212'; }
.crt-det summary span:last-child {
  font: 400 12px ${CRT_MONO};
  text-align: right;
  white-space: nowrap;
}
.crt-cli {
  margin: 2px 0 8px;
  padding: 0;
  list-style: none;
  max-height: 340px;
  overflow: auto;
  border-left: 2px solid var(--r-soft);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.crt-cli::-webkit-scrollbar { width: 6px; }
.crt-cli::-webkit-scrollbar-track { background: transparent; }
.crt-cli::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.crt-cli::-webkit-scrollbar-thumb:hover { background: var(--muted); }
.crt-cli li {
  padding: 4px 8px;
  font-size: 12px;
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 0 8px;
}
.crt-cli li small { color: var(--muted); font: 400 11px ${CRT_MONO}; }
.crt-v { font: 400 11px ${CRT_MONO}; color: var(--muted); text-align: right; white-space: nowrap; }
.crt-detail-body {
  padding: 4px 0 8px 8px;
  font-size: 12px;
  border-left: 2px solid var(--border);
}
.crt-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 3px 14px;
  margin-bottom: 8px;
}
.crt-city-seller {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
}
.crt-city-seller:hover { background: var(--background); }
.crt-vend {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 0 8px;
  padding: 6px 0;
  border-top: 1px solid var(--border);
  font-size: 13px;
}
.crt-vend small { grid-column: 1/-1; color: var(--muted); font-size: 11px; }
.crt-vend span:last-child { font: 400 12px ${CRT_MONO}; white-space: nowrap; }
.crt-rowbtn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: 100%;
}
.crt-rowbtn:hover { background: var(--background); }
.crt-pex-filter {
  display: flex;
  gap: 4px;
  margin-left: 8px;
  align-items: center;
}
.crt-pex-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font: 400 12px system-ui, sans-serif;
  color: var(--muted);
  background: var(--surface);
}
.crt-pex-btn:hover { border-color: var(--red); color: var(--text); }
.crt-pex-btn[aria-pressed="true"] { background: var(--red); color: #fff; border-color: var(--red); }
.crt-progress {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.crt-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width .3s;
}
.crt-assign-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 4px 8px;
  align-items: center;
  padding: 6px 0;
  border-top: 1px solid var(--border);
}
.crt-assign-info {
  min-width: 0;
  font-size: 13px;
}
.crt-assign-info small {
  display: block;
  font: 400 11px ${CRT_MONO};
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.crt-assigned { color: #22c55e; }
.crt-select {
  min-width: 130px;
  max-width: 160px;
  padding: 5px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--text);
  font: 400 11px ${CRT_MONO};
  cursor: pointer;
}
.crt-select:focus { outline: 2px solid var(--red); outline-offset: 1px; }
.crt-report-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 8px 14px;
  border: 1px solid #22c55e;
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  font: 500 13px system-ui, sans-serif;
  text-align: center;
}
.crt-report-btn:hover { background: rgba(34, 197, 94, 0.2); }
.crt-clear-filters {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 5px 10px;
  border: 1px solid var(--red);
  border-radius: 4px;
  font: 400 12px system-ui, sans-serif;
  color: var(--red);
  background: none;
}
.crt-clear-filters:hover { background: rgba(237, 28, 36, 0.08); }
.pf-filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-start;
}
.pf-filter-drop { position: relative; }
.pf-filter-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font: 400 12px system-ui, sans-serif;
  color: var(--muted);
  background: var(--surface);
  white-space: nowrap;
}
.pf-filter-btn:hover { border-color: var(--red); color: var(--text); }
.pf-filter-btn.has-value { border-color: var(--red); color: var(--red); font-weight: 600; }
.pf-filter-btn.open { border-color: var(--red); }
.pf-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
  font: 600 10px ${CRT_MONO};
  padding: 0 4px;
}
.pf-arrow { font-size: 8px; opacity: .5; }
.pf-filter-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 160px;
  max-height: 260px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0,0,0,.25);
  padding: 6px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.pf-filter-panel::-webkit-scrollbar { width: 6px; }
.pf-filter-panel::-webkit-scrollbar-track { background: transparent; }
.pf-filter-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.pf-filter-panel label {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.pf-filter-panel label:hover { background: var(--background); }
.pf-panel-search {
  width: calc(100% - 16px);
  margin: 4px 8px 6px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}
@media (max-width: 1000px) {
  .crt-grid { grid-template-columns: 1fr !important; }
  .crt-rail { max-height: 300px; }
  .crt-side-panel { max-height: none; }
}
@media (prefers-reduced-motion: reduce) { .crt-m { transition: none; } }
`
