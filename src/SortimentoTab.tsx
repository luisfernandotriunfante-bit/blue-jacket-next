import { useState, useMemo } from 'react'
import type { CanonicalClient } from './domain/clientMotor'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalMovement } from './domain/movementMotor'

const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(2)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

type Classification = 'Mandatório' | 'Importante' | 'Fora do sortimento'

interface SortimentoItem {
  code: string
  description: string
  subcategory: string
  brand: string
  classification: Classification
  recommended: boolean
  purchased: boolean
  value: number
  storesPurchased?: number
}

type ViewMode = 'cnpj' | 'rede'

const ROWS_PER_PAGE = 40

export function SortimentoTab({ clientBase, productBase, movementBase, activeComp, pexSet }: {
  clientBase: CanonicalClient[]
  productBase: CanonicalProduct[]
  movementBase: CanonicalMovement[]
  activeComp: string
  pexSet: Set<string>
}) {
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [selectedRede, setSelectedRede] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cnpj')
  const [filterClass, setFilterClass] = useState<'all' | 'mandatorio' | 'importante' | 'fora'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'comprado' | 'faltando'>('all')
  const [sortBy, setSortBy] = useState<'subcategory' | 'brand' | 'value' | 'classification'>('subcategory')
  const [listPage, setListPage] = useState(0)

  const movsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    const add = (key: string, m: CanonicalMovement) => { if (!map.has(key)) map.set(key, []); map.get(key)!.push(m) }
    for (const m of movementBase) {
      if (m.customerCode) add(m.customerCode, m)
      if (m.customerDocument && m.customerDocument !== m.customerCode) add(m.customerDocument, m)
    }
    return map
  }, [movementBase])

  const productByCode = useMemo(() => {
    const map = new Map<string, CanonicalProduct>()
    for (const p of productBase) {
      if (p.internalCode) map.set(p.internalCode, p)
      if (p.manufacturerCode) map.set(p.manufacturerCode, p)
    }
    return map
  }, [productBase])

  const redeMap = useMemo(() => {
    const map = new Map<string, CanonicalClient[]>()
    const networkByDoc = new Map<string, string>()
    for (const c of clientBase) {
      const rede = c.premiseNetwork?.trim()
      if (rede) networkByDoc.set(c.document, rede)
    }
    for (const c of clientBase) {
      let rede = c.premiseNetwork?.trim() || ''
      if (!rede) rede = networkByDoc.get(c.document) ?? ''
      if (!rede) continue
      if (!map.has(rede)) map.set(rede, [])
      map.get(rede)!.push(c)
    }
    return map
  }, [clientBase])

  const availableRedes = useMemo(() => {
    return [...redeMap.entries()]
      .map(([name, clients]) => ({ name, count: clients.length }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [redeMap])

  const q = search.toLowerCase()

  const selectedClient = useMemo(() => {
    if (viewMode !== 'cnpj' || !selectedDoc) return null
    return clientBase.find(c => c.document === selectedDoc) ?? null
  }, [clientBase, selectedDoc, viewMode])

  const selectedRedeClients = useMemo(() => {
    if (viewMode !== 'rede' || !selectedRede) return []
    return redeMap.get(selectedRede) ?? []
  }, [redeMap, selectedRede, viewMode])

  const availableSortChannels = useMemo(() => {
    const chSet = new Set<string>()
    for (const p of productBase) {
      if (p.sortimentChannels) for (const ch of Object.keys(p.sortimentChannels)) chSet.add(ch)
    }
    return [...chSet]
  }, [productBase])

  const networkChannelMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const c of clientBase) {
      const rede = c.premiseNetwork?.trim()
      if (!rede) continue
      const ct = (c.channelType ?? '').trim()
      const rawFaixa = (c.premiseRange ?? '').trim()
      const faixaNum = rawFaixa.replace(/\D/g, '')
      let resolved = ''
      if (ct) {
        const ctLow = ct.toLowerCase()
        resolved = availableSortChannels.find(ch => ch.toLowerCase() === ctLow) ?? availableSortChannels.find(ch => ctLow && ch.toLowerCase().includes(ctLow)) ?? ''
      }
      if (!resolved && ct) {
        const ctN = ct.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (['farma', 'droga', 'farmacia', 'drogaria'].some(k => ctN.includes(k)))
          resolved = availableSortChannels.find(ch => { const l = ch.toLowerCase(); return l.startsWith('droga') || l.startsWith('farma') }) ?? ''
        if (!resolved && ['cc', 'cashcarry', 'atacarejo', 'atacado', 'club'].some(k => ctN.includes(k)))
          resolved = availableSortChannels.find(ch => { const l = ch.toLowerCase(); return l.startsWith('club') || l.includes('c&c') }) ?? ''
      }
      if (!resolved && faixaNum) {
        const FAIXA_MAP: Record<string, string[]> = { '1': ['hiper'], '2': ['super g', 'superg'], '3': ['super p', 'superp'], '4': ['viz g', 'vizg', 'vizinhanca'], '5': ['viz p', 'vizp', 'vizinhanca'], '6': ['tard', 'tradicional'] }
        const candidates = FAIXA_MAP[faixaNum]
        if (candidates) {
          for (const cand of candidates) {
            const match = availableSortChannels.find(ch => ch.toLowerCase().startsWith(cand))
            if (match) { resolved = match; break }
          }
        }
      }
      if (!resolved) continue
      if (!map.has(rede)) map.set(rede, new Map())
      const counts = map.get(rede)!
      counts.set(resolved, (counts.get(resolved) ?? 0) + 1)
    }
    return map
  }, [clientBase, availableSortChannels])

  const resolveChannel = (client: CanonicalClient): string => {
    const ct = (client.channelType ?? '').trim()
    const rawFaixa = (client.premiseRange ?? '').trim()
    const faixaNum = rawFaixa.replace(/\D/g, '')
    if (availableSortChannels.length === 0) return ''
    if (ct) {
      const ctLow = ct.toLowerCase()
      const exact = availableSortChannels.find(ch => ch.toLowerCase() === ctLow)
      if (exact) return exact
      const partial = availableSortChannels.find(ch => ctLow && ch.toLowerCase().includes(ctLow))
      if (partial) return partial
    }
    const ctNorm = ct.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (ctNorm) {
      const isDrug = ['farma', 'droga', 'farmacia', 'drogaria'].some(k => ctNorm.includes(k))
      if (isDrug) {
        const m = availableSortChannels.find(ch => { const l = ch.toLowerCase(); return l.startsWith('droga') || l.startsWith('farma') })
        if (m) return m
      }
      const isClub = ['cc', 'cashcarry', 'cashandcarry', 'atacarejo', 'atacado', 'club'].some(k => ctNorm.includes(k))
      if (isClub) {
        const m = availableSortChannels.find(ch => { const l = ch.toLowerCase(); return l.startsWith('club') || l.includes('c&c') })
        if (m) return m
      }
    }
    const FAIXA_MAP: Record<string, string[]> = {
      '1': ['hiper'],
      '2': ['super g', 'superg'],
      '3': ['super p', 'superp'],
      '4': ['viz g', 'vizg', 'vizinhanca'],
      '5': ['viz p', 'vizp', 'vizinhanca'],
      '6': ['tard', 'tradicional'],
    }
    if (faixaNum) {
      const candidates = FAIXA_MAP[faixaNum]
      if (candidates) {
        for (const cand of candidates) {
          const match = availableSortChannels.find(ch => ch.toLowerCase().startsWith(cand))
          if (match) return match
        }
      }
    }
    const rede = client.premiseNetwork?.trim()
    if (rede) {
      const counts = networkChannelMap.get(rede)
      if (counts) {
        let topCh = '', topN = 0
        for (const [ch, n] of counts) { if (n > topN) { topCh = ch; topN = n } }
        if (topCh) return topCh
      }
    }
    return ''
  }

  const detectedChannel = useMemo(() => {
    if (viewMode === 'cnpj') {
      if (!selectedClient) return ''
      return resolveChannel(selectedClient)
    }
    if (selectedRedeClients.length === 0) return ''
    const channels = new Map<string, number>()
    for (const c of selectedRedeClients) {
      const ch = resolveChannel(c)
      if (ch) channels.set(ch, (channels.get(ch) ?? 0) + 1)
    }
    let topChannel = ''
    let topCount = 0
    for (const [ch, count] of channels) {
      if (count > topCount) { topChannel = ch; topCount = count }
    }
    if (!topChannel && selectedRede) {
      const counts = networkChannelMap.get(selectedRede)
      if (counts) {
        for (const [ch, n] of counts) { if (n > topCount) { topChannel = ch; topCount = n } }
      }
    }
    return topChannel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedRedeClients, viewMode, availableSortChannels, selectedRede, networkChannelMap])

  const redeChannelBreakdown = useMemo(() => {
    if (viewMode !== 'rede' || selectedRedeClients.length === 0) return new Map<string, number>()
    const channels = new Map<string, number>()
    for (const c of selectedRedeClients) {
      const ch = resolveChannel(c)
      if (ch) channels.set(ch, (channels.get(ch) ?? 0) + 1)
    }
    return channels
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRedeClients, viewMode, availableSortChannels, networkChannelMap])

  const hasSelection = viewMode === 'cnpj' ? !!selectedClient : selectedRedeClients.length > 0

  const analysis = useMemo(() => {
    if (!hasSelection) return null
    const hasChannel = viewMode === 'cnpj' ? !!detectedChannel : redeChannelBreakdown.size > 0
    if (!hasChannel) return null

    const [y] = activeComp.split('-').map(Number)
    const startAno = `${y}-01-01`
    const now = new Date()
    const endAno = now.toISOString().slice(0, 10)

    const purchasedProducts = new Map<string, number>()
    const storesByProduct = new Map<string, Set<string>>()
    let totalStores = 0

    const collectMovements = (client: CanonicalClient) => {
      const code = client.winthorCode ?? client.document
      const allMovs = [...(movsByCustomer.get(code) ?? []), ...(code !== client.document ? (movsByCustomer.get(client.document) ?? []) : [])]
      const movsAno = allMovs.filter(m => {
        const d = m.movementDate ?? ''
        return d >= startAno && d <= endAno && (m.movementType === 'venda_faturada' || m.movementType === 'devolucao')
      })
      const storeBought = new Set<string>()
      for (const m of movsAno) {
        const pc = m.productCode ?? ''
        if (!pc) continue
        const val = m.movementType === 'venda_faturada' ? (m.value ?? 0) : -(m.value ?? 0)
        purchasedProducts.set(pc, (purchasedProducts.get(pc) ?? 0) + val)
        if (viewMode === 'rede') storeBought.add(pc)
      }
      if (viewMode === 'rede') {
        for (const pc of storeBought) {
          if (!storesByProduct.has(pc)) storesByProduct.set(pc, new Set())
          storesByProduct.get(pc)!.add(client.document)
        }
      }
    }

    if (viewMode === 'cnpj' && selectedClient) {
      collectMovements(selectedClient)
      totalStores = 1
    } else {
      for (const client of selectedRedeClients) collectMovements(client)
      totalStores = selectedRedeClients.length
    }

    const storesWithPurchase = viewMode === 'rede'
      ? new Set([...storesByProduct.values()].flatMap(s => [...s])).size
      : purchasedProducts.size > 0 ? 1 : 0

    const items: SortimentoItem[] = []
    const recommendedCodes = new Set<string>()

    const activeChannels: string[] = viewMode === 'cnpj'
      ? (detectedChannel ? [detectedChannel] : [])
      : [...redeChannelBreakdown.keys()]

    for (const p of productBase) {
      if (!p.sortimentChannels) continue
      let bestLevel = 0
      for (const ch of activeChannels) {
        const level = p.sortimentChannels[ch]
        if (level && level > 0 && (bestLevel === 0 || level < bestLevel)) bestLevel = level
      }
      if (bestLevel <= 0) continue

      const pCode = p.internalCode ?? p.manufacturerCode ?? ''
      if (!pCode) continue
      recommendedCodes.add(pCode)
      if (p.manufacturerCode) recommendedCodes.add(p.manufacturerCode)

      const purchaseValue = purchasedProducts.get(pCode) ?? (p.manufacturerCode ? (purchasedProducts.get(p.manufacturerCode) ?? 0) : 0)
      const storeCount = viewMode === 'rede' ? (storesByProduct.get(pCode)?.size ?? (p.manufacturerCode ? (storesByProduct.get(p.manufacturerCode)?.size ?? 0) : 0)) : undefined

      items.push({
        code: pCode,
        description: p.description ?? pCode,
        subcategory: p.subcategory ?? p.category ?? '',
        brand: p.brand ?? p.subBrand ?? '',
        classification: bestLevel === 1 ? 'Mandatório' : 'Importante',
        recommended: true,
        purchased: purchaseValue > 0,
        value: purchaseValue,
        storesPurchased: storeCount,
      })
    }

    for (const [pc, val] of purchasedProducts) {
      if (recommendedCodes.has(pc)) continue
      const prod = productByCode.get(pc)
      if (prod?.sortimentChannels) {
        let inSort = false
        for (const ch of activeChannels) {
          if (prod.sortimentChannels[ch] != null) { inSort = true; break }
        }
        if (inSort) continue
      }
      const storeCount = viewMode === 'rede' ? (storesByProduct.get(pc)?.size ?? 0) : undefined
      items.push({
        code: pc,
        description: prod?.description ?? pc,
        subcategory: prod?.subcategory ?? prod?.category ?? '',
        brand: prod?.brand ?? prod?.subBrand ?? '',
        classification: 'Fora do sortimento',
        recommended: false,
        purchased: true,
        value: val,
        storesPurchased: storeCount,
      })
    }

    const recommended = items.filter(i => i.recommended)
    const fora = items.filter(i => !i.recommended)
    const mandatorios = recommended.filter(i => i.classification === 'Mandatório')
    const importantes = recommended.filter(i => i.classification === 'Importante')

    const skusRecom = recommended.length
    const skusComprados = recommended.filter(i => i.purchased).length
    const assortment = skusRecom > 0 ? skusComprados / skusRecom : 0

    const mandDisp = mandatorios.length
    const mandComprados = mandatorios.filter(i => i.purchased).length
    const cobMand = mandDisp > 0 ? mandComprados / mandDisp : 0

    const impDisp = importantes.length
    const impComprados = importantes.filter(i => i.purchased).length
    const cobImp = impDisp > 0 ? impComprados / impDisp : 0

    const valorTotal = recommended.reduce((s, i) => s + i.value, 0)
    const valorForaSortimento = fora.reduce((s, i) => s + i.value, 0)
    const skusFora = fora.length

    return {
      items,
      skusRecom,
      skusComprados,
      assortment,
      mandDisp,
      mandComprados,
      cobMand,
      impDisp,
      impComprados,
      cobImp,
      valorTotal,
      valorForaSortimento,
      skusFora,
      totalStores,
      storesWithPurchase,
    }
  }, [hasSelection, selectedClient, selectedRedeClients, viewMode, detectedChannel, redeChannelBreakdown, movsByCustomer, productBase, productByCode, activeComp])

  const filteredItems = useMemo(() => {
    if (!analysis) return []
    let items = analysis.items
    if (filterClass === 'mandatorio') items = items.filter(i => i.classification === 'Mandatório')
    else if (filterClass === 'importante') items = items.filter(i => i.classification === 'Importante')
    else if (filterClass === 'fora') items = items.filter(i => i.classification === 'Fora do sortimento')
    if (filterStatus === 'comprado') items = items.filter(i => i.purchased)
    else if (filterStatus === 'faltando') items = items.filter(i => i.recommended && !i.purchased)

    return [...items].sort((a, b) => {
      if (sortBy === 'value') return b.value - a.value
      if (sortBy === 'brand') return (a.brand || 'zzz').localeCompare(b.brand || 'zzz')
      if (sortBy === 'classification') {
        const order: Record<Classification, number> = { 'Mandatório': 0, 'Importante': 1, 'Fora do sortimento': 2 }
        if (a.classification !== b.classification) return order[a.classification] - order[b.classification]
        return a.subcategory.localeCompare(b.subcategory)
      }
      return a.subcategory.localeCompare(b.subcategory) || a.brand.localeCompare(b.brand)
    })
  }, [analysis, filterClass, filterStatus, sortBy])

  const clientList = useMemo(() => {
    if (hasSelection || viewMode !== 'cnpj') return []
    const listQ = q.length >= 2 ? q : ''
    let list = clientBase
    if (listQ) {
      list = list.filter(c => {
        const doc = c.document.toLowerCase()
        const name = (c.tradeName ?? c.legalName ?? '').toLowerCase()
        const code = (c.winthorCode ?? '').toLowerCase()
        return doc.includes(listQ) || name.includes(listQ) || code.includes(listQ)
      })
    }
    return list.sort((a, b) => (a.tradeName ?? a.legalName ?? a.document).localeCompare(b.tradeName ?? b.legalName ?? b.document))
  }, [clientBase, hasSelection, viewMode, q])

  const redeList = useMemo(() => {
    if (hasSelection || viewMode !== 'rede') return []
    const listQ = q.length >= 2 ? q : ''
    let list = availableRedes
    if (listQ) list = list.filter(r => r.name.toLowerCase().includes(listQ))
    return list
  }, [availableRedes, hasSelection, viewMode, q])

  const clearSelection = () => {
    setSelectedDoc(null)
    setSelectedRede(null)
    setSearch('')
    setListPage(0)
  }

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode)
    clearSelection()
  }

  const totalPages = viewMode === 'cnpj' ? Math.ceil(clientList.length / ROWS_PER_PAGE) : Math.ceil(redeList.length / ROWS_PER_PAGE)
  const pagedClients = clientList.slice(listPage * ROWS_PER_PAGE, (listPage + 1) * ROWS_PER_PAGE)
  const pagedRedes = redeList.slice(listPage * ROWS_PER_PAGE, (listPage + 1) * ROWS_PER_PAGE)

  return (
    <section className="content">
      <div className="stock-toolbar">
        <fieldset className="pf-range">
          <legend>Visualização</legend>
          <div>
            <button type="button" className={viewMode === 'cnpj' ? 'is-active' : ''} onClick={() => switchMode('cnpj')}>Por CNPJ</button>
            <button type="button" className={viewMode === 'rede' ? 'is-active' : ''} onClick={() => switchMode('rede')}>
              Por Rede {availableRedes.length > 0 && `(${availableRedes.length})`}
            </button>
          </div>
        </fieldset>
        <div className="pf-bar">
          <input
            className="pf-input"
            placeholder={viewMode === 'cnpj' ? 'Buscar cliente por CNPJ, código ou nome…' : 'Buscar rede pelo nome…'}
            value={search}
            onChange={e => { setSearch(e.target.value); setListPage(0); if (!e.target.value) clearSelection() }}
          />
        </div>
      </div>

      {viewMode === 'cnpj' && selectedClient && (
        <div className="sort-header-info">
          <div className="sort-client-selected">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{selectedClient.tradeName ?? selectedClient.legalName ?? selectedClient.document}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedClient.document}</span>
              {selectedClient.premiseRange && <span className="cad-badge-range">{/faixa/i.test(selectedClient.premiseRange) ? selectedClient.premiseRange : `Faixa ${selectedClient.premiseRange}`}</span>}
              {detectedChannel && <span className="sort-channel-badge">{detectedChannel}</span>}
              {selectedClient.premiseNetwork && <span style={{ color: 'var(--blue)', fontSize: 11 }}>Rede: {selectedClient.premiseNetwork}</span>}
              {pexSet.has(selectedClient.document) && <span className="badge-pex">PEX</span>}
              <button type="button" className="sort-clear-btn" onClick={clearSelection}>Trocar</button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'rede' && selectedRede && selectedRedeClients.length > 0 && (
        <div className="sort-header-info">
          <div className="sort-client-selected">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{selectedRede}</strong>
              <span style={{ color: 'var(--blue)', fontSize: 12 }}>{selectedRedeClients.length} loja{selectedRedeClients.length !== 1 ? 's' : ''}</span>
              <button type="button" className="sort-clear-btn" onClick={clearSelection}>Trocar</button>
            </div>
            {redeChannelBreakdown.size > 0 && (
              <div className="sort-channels-list">
                {[...redeChannelBreakdown.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([ch, count]) => (
                    <span key={ch} className="sort-channel-pill">
                      {ch} <span className="sort-channel-pill-count">{count}</span>
                    </span>
                  ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {selectedRedeClients.slice(0, 8).map(c => {
                const clientCh = resolveChannel(c)
                return (
                  <span key={c.document} style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface)', padding: '2px 6px', borderRadius: 4 }}>
                    {c.tradeName ?? c.document}
                    {clientCh && <span className="sort-channel-badge" style={{ fontSize: 9, marginLeft: 4, padding: '1px 5px' }}>{clientCh}</span>}
                  </span>
                )
              })}
              {selectedRedeClients.length > 8 && (
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{selectedRedeClients.length - 8} mais</span>
              )}
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <>
          <div className="sort-hero-row">
            <div className="sort-donut-block">
              <div className="donut-svg-wrap">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={analysis.assortment >= 0.5 ? '#4caf50' : analysis.assortment >= 0.25 ? '#ff9800' : '#ef5350'} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${analysis.assortment * 326.73} ${326.73 - analysis.assortment * 326.73}`} strokeDashoffset="81.68" transform="rotate(-90 60 60)" />
                </svg>
                <div className="donut-center">
                  <span className="donut-center-val" style={{ color: analysis.assortment >= 0.5 ? '#4caf50' : analysis.assortment >= 0.25 ? '#ff9800' : '#ef5350' }}>{pct(analysis.assortment)}</span>
                  <span className="donut-center-label">Assortment</span>
                </div>
              </div>
              <div className="donut-legend">
                <div className="donut-leg-item">
                  <span className="donut-leg-dot" style={{ background: '#4caf50' }} />
                  <span className="donut-leg-label">Comprados</span>
                  <span className="donut-leg-val">{analysis.skusComprados}</span>
                </div>
                <div className="donut-leg-item">
                  <span className="donut-leg-dot" style={{ background: 'var(--border)' }} />
                  <span className="donut-leg-label">Total SKUs</span>
                  <span className="donut-leg-val">{analysis.skusRecom}</span>
                </div>
              </div>
            </div>

            <div className="stock-kpis" style={{ flex: 1 }}>
              <div className="kpi-card">
                <div className="kpi-card-body">
                  <div className="kpi-label">Mandatório</div>
                  <div className="kpi-val" style={{ color: analysis.cobMand >= 0.5 ? '#4caf50' : analysis.cobMand >= 0.25 ? '#ff9800' : '#ef5350' }}>{pct(analysis.cobMand)}</div>
                  <div className="kpi-sub">{analysis.mandComprados} de {analysis.mandDisp}</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-body">
                  <div className="kpi-label">Importante</div>
                  <div className="kpi-val" style={{ color: analysis.cobImp >= 0.5 ? '#4caf50' : analysis.cobImp >= 0.25 ? '#ff9800' : '#ef5350' }}>{pct(analysis.cobImp)}</div>
                  <div className="kpi-sub">{analysis.impComprados} de {analysis.impDisp}</div>
                </div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-card-body">
                  <div className="kpi-label">Valor Sortimento</div>
                  <div className="kpi-val">{kpiCurrency(analysis.valorTotal)}</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-body">
                  <div className="kpi-label">Fora Sortimento</div>
                  <div className="kpi-val" style={{ color: '#ff9800' }}>{kpiCurrency(analysis.valorForaSortimento)}</div>
                  <div className="kpi-sub">{analysis.skusFora} SKUs</div>
                </div>
              </div>
              {viewMode === 'rede' && (
                <div className="kpi-card kpi-blue">
                  <div className="kpi-card-body">
                    <div className="kpi-label">Lojas com Compra</div>
                    <div className="kpi-val">{analysis.storesWithPurchase}/{analysis.totalStores}</div>
                    <div className="kpi-sub">{pct(analysis.totalStores > 0 ? analysis.storesWithPurchase / analysis.totalStores : 0)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <fieldset className="pf-range">
              <legend>Classificação</legend>
              <div>
                <button type="button" className={filterClass === 'all' ? 'is-active' : ''} onClick={() => setFilterClass('all')}>Todos</button>
                <button type="button" className={filterClass === 'mandatorio' ? 'is-active' : ''} onClick={() => setFilterClass('mandatorio')}>Mandatório</button>
                <button type="button" className={filterClass === 'importante' ? 'is-active' : ''} onClick={() => setFilterClass('importante')}>Importante</button>
                <button type="button" className={filterClass === 'fora' ? 'is-active' : ''} onClick={() => setFilterClass('fora')}>Fora</button>
              </div>
            </fieldset>
            <fieldset className="pf-range">
              <legend>Status</legend>
              <div>
                <button type="button" className={filterStatus === 'all' ? 'is-active' : ''} onClick={() => setFilterStatus('all')}>Todos</button>
                <button type="button" className={filterStatus === 'comprado' ? 'is-active' : ''} onClick={() => setFilterStatus('comprado')}>Comprados</button>
                <button type="button" className={filterStatus === 'faltando' ? 'is-active' : ''} onClick={() => setFilterStatus('faltando')}>Faltando</button>
              </div>
            </fieldset>
            <fieldset className="pf-range">
              <legend>Ordenar por</legend>
              <div>
                <button type="button" className={sortBy === 'subcategory' ? 'is-active' : ''} onClick={() => setSortBy('subcategory')}>Subcategoria</button>
                <button type="button" className={sortBy === 'brand' ? 'is-active' : ''} onClick={() => setSortBy('brand')}>Marca</button>
                <button type="button" className={sortBy === 'value' ? 'is-active' : ''} onClick={() => setSortBy('value')}>Valor</button>
                <button type="button" className={sortBy === 'classification' ? 'is-active' : ''} onClick={() => setSortBy('classification')}>Classificação</button>
              </div>
            </fieldset>
          </div>

          <div className="sort-count">
            <strong>{filteredItems.length}</strong> produto{filteredItems.length !== 1 ? 's' : ''}
            {filteredItems.length !== analysis.items.length && ` de ${analysis.items.length}`}
          </div>

          <div className="sort-product-list">
            <div className={`sort-product-head${viewMode === 'rede' ? ' sort-head-rede' : ''}`}>
              <span>Produto</span>
              <span className="sc-num">Subcategoria</span>
              <span className="sc-num">Classificação</span>
              {viewMode === 'rede' && <span className="sc-num">Penetração</span>}
              <span className="sc-num">Status</span>
              <span className="sc-num">Valor</span>
            </div>
            {filteredItems.map(item => (
              <div key={item.code} className={`sort-product-row${item.purchased ? '' : ' sort-missing'}${viewMode === 'rede' ? ' sort-row-rede' : ''}`}>
                <span className="sc-desc">
                  <span className="p-name">{item.description}</span>
                  <span className="p-meta">
                    <code>{item.code}</code>
                    {item.brand && <span style={{ color: 'var(--muted)' }}>{item.brand}</span>}
                  </span>
                </span>
                <span className="sc-num" style={{ fontSize: 11 }}>{item.subcategory || '—'}</span>
                <span className="sc-num">
                  {item.classification === 'Mandatório' && <span className="sort-class-badge sort-mand">Mand.</span>}
                  {item.classification === 'Importante' && <span className="sort-class-badge sort-imp">Import.</span>}
                  {item.classification === 'Fora do sortimento' && <span className="sort-class-badge sort-fora">Fora</span>}
                </span>
                {viewMode === 'rede' && (
                  <span className="sc-num">
                    {item.storesPurchased != null
                      ? <span style={{ fontSize: 11 }}>{item.storesPurchased}/{analysis.totalStores} <span style={{ color: 'var(--muted)' }}>({pct(item.storesPurchased / analysis.totalStores)})</span></span>
                      : <span className="c-muted">—</span>}
                  </span>
                )}
                <span className="sc-num">
                  {item.purchased
                    ? <span className="sort-status-badge sort-ok">Comprou</span>
                    : <span className="sort-status-badge sort-miss">Faltando</span>}
                </span>
                <span className="sc-num">
                  {item.value > 0
                    ? <strong className="c-blue" style={{ fontSize: 12 }}>{kpiCurrency(item.value)}</strong>
                    : item.value < 0
                    ? <strong style={{ fontSize: 12, color: '#ef5350' }}>{kpiCurrency(item.value)}</strong>
                    : <span className="c-muted">—</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasSelection && !analysis && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <p>Não foi possível detectar o canal do sortimento para este cliente.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {availableSortChannels.length > 0
              ? `Canais disponíveis no sortimento: ${availableSortChannels.join(', ')}.`
              : 'Verifique se o arquivo de sortimento com canais foi carregado.'}
          </p>
        </div>
      )}

      {!hasSelection && viewMode === 'cnpj' && clientBase.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
            {q.length >= 2 ? `${clientList.length} cliente${clientList.length !== 1 ? 's' : ''} encontrado${clientList.length !== 1 ? 's' : ''}` : `${clientBase.length} clientes na base`}
          </div>
          <div className="sort-client-list">
            <div className="sort-client-head">
              <span>Cliente</span>
              <span>CNPJ</span>
              <span>Cidade</span>
              <span>Faixa</span>
              <span>Canal</span>
              <span>Rede</span>
              <span></span>
            </div>
            {pagedClients.map(c => {
              const ch = resolveChannel(c)
              return (
                <div
                  key={c.document}
                  className="sort-client-row"
                  onClick={() => { setSelectedDoc(c.document); setSearch(c.tradeName ?? c.legalName ?? c.document) }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {c.tradeName ?? c.legalName ?? c.document}
                    {c.winthorCode && <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 6 }}>#{c.winthorCode}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{c.document}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.city || '—'}</span>
                  <span>
                    {c.premiseRange
                      ? <span className="cad-badge-range" style={{ fontSize: 9 }}>{/faixa/i.test(c.premiseRange) ? c.premiseRange : `F${c.premiseRange}`}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>}
                  </span>
                  <span>
                    {ch
                      ? <span className="sort-channel-badge" style={{ fontSize: 9, padding: '1px 5px' }}>{ch}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--blue)' }}>{c.premiseNetwork || '—'}</span>
                  <span>{pexSet.has(c.document) && <span className="badge-pex" style={{ fontSize: 9 }}>PEX</span>}</span>
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="sort-cards-pagination">
              <button type="button" disabled={listPage === 0} onClick={() => setListPage(p => p - 1)}>Anterior</button>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{listPage + 1} de {totalPages}</span>
              <button type="button" disabled={listPage >= totalPages - 1} onClick={() => setListPage(p => p + 1)}>Próxima</button>
            </div>
          )}
        </div>
      )}

      {!hasSelection && viewMode === 'rede' && availableRedes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
            {q.length >= 2 ? `${redeList.length} rede${redeList.length !== 1 ? 's' : ''} encontrada${redeList.length !== 1 ? 's' : ''}` : `${availableRedes.length} redes disponíveis`}
          </div>
          <div className="sort-client-list">
            <div className="sort-rede-head">
              <span>Rede</span>
              <span>Lojas</span>
              <span>Canal</span>
            </div>
            {pagedRedes.map(r => {
              const counts = networkChannelMap.get(r.name)
              const channels: [string, number][] = []
              if (counts) {
                for (const [ch, n] of counts) channels.push([ch, n])
                channels.sort((a, b) => b[1] - a[1])
              }
              return (
                <div
                  key={r.name}
                  className="sort-rede-row"
                  onClick={() => { setSelectedRede(r.name); setSearch(r.name) }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--blue)' }}>{r.count} loja{r.count !== 1 ? 's' : ''}</span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {channels.map(([ch, n]) => (
                      <span key={ch} className="sort-channel-pill">
                        {ch} <span className="sort-channel-pill-count">{n}</span>
                      </span>
                    ))}
                    {channels.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>}
                  </span>
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="sort-cards-pagination">
              <button type="button" disabled={listPage === 0} onClick={() => setListPage(p => p - 1)}>Anterior</button>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{listPage + 1} de {totalPages}</span>
              <button type="button" disabled={listPage >= totalPages - 1} onClick={() => setListPage(p => p + 1)}>Próxima</button>
            </div>
          )}
        </div>
      )}

      {!hasSelection && clientBase.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <p>Nenhum cliente carregado.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Carregue os arquivos de clientes e sortimento para começar a análise.</p>
        </div>
      )}
    </section>
  )
}
