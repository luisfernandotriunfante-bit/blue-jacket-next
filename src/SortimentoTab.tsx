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

const CARDS_PER_PAGE = 40

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
  const [cardsPage, setCardsPage] = useState(0)

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

  const clientResults = useMemo(() => {
    if (!q || q.length < 2 || viewMode !== 'cnpj') return []
    return clientBase
      .filter(c => {
        const doc = c.document.toLowerCase()
        const name = (c.tradeName ?? c.legalName ?? '').toLowerCase()
        const code = (c.winthorCode ?? '').toLowerCase()
        return doc.includes(q) || name.includes(q) || code.includes(q)
      })
      .slice(0, 20)
  }, [clientBase, q, viewMode])

  const redeResults = useMemo(() => {
    if (!q || q.length < 2 || viewMode !== 'rede') return []
    return availableRedes
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, 20)
  }, [availableRedes, q, viewMode])

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
      if (!resolved && faixaNum) {
        const FAIXA_MAP: Record<string, string[]> = { '1': ['hiper'], '2': ['super g', 'superg'], '3': ['super p', 'superp'], '4': ['clubs', 'c&c', 'vizinhanca'], '5': ['drogaria', 'farma', 'vizinhanca'] }
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
    const FAIXA_MAP: Record<string, string[]> = {
      '1': ['hiper'],
      '2': ['super g', 'superg'],
      '3': ['super p', 'superp'],
      '4': ['clubs', 'c&c', 'vizinhanca'],
      '5': ['drogaria', 'farma', 'vizinhanca'],
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
  }, [selectedClient, selectedRedeClients, viewMode, availableSortChannels, selectedRede, networkChannelMap])

  const hasSelection = viewMode === 'cnpj' ? !!selectedClient : selectedRedeClients.length > 0

  const analysis = useMemo(() => {
    if (!hasSelection || !detectedChannel) return null

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

    for (const p of productBase) {
      if (!p.sortimentChannels) continue
      const level = p.sortimentChannels[detectedChannel]
      if (!level || level <= 0) continue

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
        classification: level === 1 ? 'Mandatório' : 'Importante',
        recommended: true,
        purchased: purchaseValue > 0,
        value: purchaseValue,
        storesPurchased: storeCount,
      })
    }

    for (const [pc, val] of purchasedProducts) {
      if (recommendedCodes.has(pc)) continue
      const prod = productByCode.get(pc)
      if (prod?.sortimentChannels && prod.sortimentChannels[detectedChannel] != null) continue
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
  }, [hasSelection, selectedClient, selectedRedeClients, viewMode, detectedChannel, movsByCustomer, productBase, productByCode, activeComp])

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

  const clientCards = useMemo(() => {
    if (hasSelection || viewMode !== 'cnpj') return []
    const cardQ = q.length >= 2 ? q : ''
    let list = clientBase
    if (cardQ) {
      list = list.filter(c => {
        const doc = c.document.toLowerCase()
        const name = (c.tradeName ?? c.legalName ?? '').toLowerCase()
        const code = (c.winthorCode ?? '').toLowerCase()
        return doc.includes(cardQ) || name.includes(cardQ) || code.includes(cardQ)
      })
    }
    return list.sort((a, b) => (a.tradeName ?? a.legalName ?? a.document).localeCompare(b.tradeName ?? b.legalName ?? b.document))
  }, [clientBase, hasSelection, viewMode, q])

  const redeCards = useMemo(() => {
    if (hasSelection || viewMode !== 'rede') return []
    const cardQ = q.length >= 2 ? q : ''
    let list = availableRedes
    if (cardQ) list = list.filter(r => r.name.toLowerCase().includes(cardQ))
    return list
  }, [availableRedes, hasSelection, viewMode, q])

  const clearSelection = () => {
    setSelectedDoc(null)
    setSelectedRede(null)
    setSearch('')
    setCardsPage(0)
  }

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode)
    clearSelection()
  }

  const totalCardsPages = viewMode === 'cnpj' ? Math.ceil(clientCards.length / CARDS_PER_PAGE) : Math.ceil(redeCards.length / CARDS_PER_PAGE)
  const pagedClientCards = clientCards.slice(cardsPage * CARDS_PER_PAGE, (cardsPage + 1) * CARDS_PER_PAGE)
  const pagedRedeCards = redeCards.slice(cardsPage * CARDS_PER_PAGE, (cardsPage + 1) * CARDS_PER_PAGE)

  return (
    <section className="content">
      <div className="stock-toolbar">
        <div className="sort-mode-toggle">
          <button type="button" className={`sort-mode-btn${viewMode === 'cnpj' ? ' active' : ''}`} onClick={() => switchMode('cnpj')}>Por CNPJ</button>
          <button type="button" className={`sort-mode-btn${viewMode === 'rede' ? ' active' : ''}`} onClick={() => switchMode('rede')}>
            Por Rede {availableRedes.length > 0 && <span className="sort-mode-count">({availableRedes.length})</span>}
          </button>
        </div>
        <div className="pf-bar">
          <input
            className="pf-input"
            placeholder={viewMode === 'cnpj' ? 'Buscar cliente por CNPJ, código ou nome…' : 'Buscar rede pelo nome…'}
            value={search}
            onChange={e => { setSearch(e.target.value); setCardsPage(0); if (!e.target.value) clearSelection() }}
          />
        </div>

        {viewMode === 'cnpj' && !selectedDoc && q.length >= 2 && clientCards.length === 0 && (
          <div className="sort-dropdown">
            <p className="sort-empty">Nenhum cliente encontrado.</p>
          </div>
        )}

        {viewMode === 'rede' && !selectedRede && q.length >= 2 && redeCards.length === 0 && (
          <div className="sort-dropdown">
            <p className="sort-empty">Nenhuma rede encontrada.</p>
          </div>
        )}
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
              {detectedChannel && <span className="sort-channel-badge">{detectedChannel}</span>}
              <button type="button" className="sort-clear-btn" onClick={clearSelection}>Trocar</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {selectedRedeClients.slice(0, 8).map(c => (
                <span key={c.document} style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface)', padding: '2px 6px', borderRadius: 4 }}>
                  {c.tradeName ?? c.document}
                  {c.premiseRange && <span className="cad-badge-range" style={{ fontSize: 9, marginLeft: 4 }}>F{c.premiseRange}</span>}
                </span>
              ))}
              {selectedRedeClients.length > 8 && (
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{selectedRedeClients.length - 8} mais</span>
              )}
            </div>
          </div>
        </div>
      )}

      {analysis && detectedChannel && (
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

          <div className="sort-filters">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={`sort-filter-btn${filterClass === 'all' ? ' active' : ''}`} onClick={() => setFilterClass('all')}>Todos</button>
              <button type="button" className={`sort-filter-btn${filterClass === 'mandatorio' ? ' active' : ''}`} onClick={() => setFilterClass('mandatorio')}>Mandatório</button>
              <button type="button" className={`sort-filter-btn${filterClass === 'importante' ? ' active' : ''}`} onClick={() => setFilterClass('importante')}>Importante</button>
              <button type="button" className={`sort-filter-btn${filterClass === 'fora' ? ' active' : ''}`} onClick={() => setFilterClass('fora')}>Fora do sortimento</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={`sort-filter-btn${filterStatus === 'all' ? ' active' : ''}`} onClick={() => setFilterStatus('all')}>Todos</button>
              <button type="button" className={`sort-filter-btn${filterStatus === 'comprado' ? ' active' : ''}`} onClick={() => setFilterStatus('comprado')}>Comprados</button>
              <button type="button" className={`sort-filter-btn${filterStatus === 'faltando' ? ' active' : ''}`} onClick={() => setFilterStatus('faltando')}>Faltando</button>
            </div>
            <select className="pf-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ minWidth: 130 }}>
              <option value="subcategory">Subcategoria</option>
              <option value="brand">Marca</option>
              <option value="value">Valor</option>
              <option value="classification">Classificação</option>
            </select>
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

      {hasSelection && !detectedChannel && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <p>Não foi possível detectar o canal do sortimento para este cliente.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {availableSortChannels.length > 0
              ? `Canais disponíveis no sortimento: ${availableSortChannels.join(', ')}. A faixa do cliente (${viewMode === 'cnpj' ? selectedClient?.premiseRange ?? '—' : '—'}) não correspondeu a nenhum.`
              : 'Verifique se o arquivo de sortimento com canais foi carregado.'}
          </p>
        </div>
      )}

      {!hasSelection && viewMode === 'cnpj' && clientBase.length > 0 && (
        <div className="sort-cards-section">
          <div className="sort-cards-header">
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              {q.length >= 2 ? `${clientCards.length} cliente${clientCards.length !== 1 ? 's' : ''} encontrado${clientCards.length !== 1 ? 's' : ''}` : `${clientBase.length} clientes na base`}
            </span>
          </div>
          <div className="sort-cards-grid">
            {pagedClientCards.map(c => {
              const ch = resolveChannel(c)
              return (
                <button
                  key={c.document}
                  type="button"
                  className="sort-card"
                  onClick={() => { setSelectedDoc(c.document); setSearch(c.tradeName ?? c.legalName ?? c.document) }}
                >
                  <span className="sort-card-name">{c.tradeName ?? c.legalName ?? c.document}</span>
                  <span className="sort-card-meta">
                    <code style={{ fontSize: 10 }}>{c.document}</code>
                    {c.city && <span>{c.city}</span>}
                  </span>
                  <span className="sort-card-badges">
                    {c.premiseRange && <span className="cad-badge-range" style={{ fontSize: 9 }}>{/faixa/i.test(c.premiseRange) ? c.premiseRange : `F${c.premiseRange}`}</span>}
                    {ch && <span className="sort-channel-badge" style={{ fontSize: 9, padding: '1px 5px' }}>{ch}</span>}
                    {c.premiseNetwork && <span style={{ fontSize: 9, color: 'var(--blue)' }}>{c.premiseNetwork}</span>}
                    {pexSet.has(c.document) && <span className="badge-pex" style={{ fontSize: 9 }}>PEX</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {totalCardsPages > 1 && (
            <div className="sort-cards-pagination">
              <button type="button" disabled={cardsPage === 0} onClick={() => setCardsPage(p => p - 1)}>Anterior</button>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{cardsPage + 1} de {totalCardsPages}</span>
              <button type="button" disabled={cardsPage >= totalCardsPages - 1} onClick={() => setCardsPage(p => p + 1)}>Próxima</button>
            </div>
          )}
        </div>
      )}

      {!hasSelection && viewMode === 'rede' && availableRedes.length > 0 && (
        <div className="sort-cards-section">
          <div className="sort-cards-header">
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              {q.length >= 2 ? `${redeCards.length} rede${redeCards.length !== 1 ? 's' : ''} encontrada${redeCards.length !== 1 ? 's' : ''}` : `${availableRedes.length} redes disponíveis`}
            </span>
          </div>
          <div className="sort-cards-grid">
            {pagedRedeCards.map(r => {
              const counts = networkChannelMap.get(r.name)
              let topCh = ''
              if (counts) { let topN = 0; for (const [ch, n] of counts) { if (n > topN) { topCh = ch; topN = n } } }
              return (
                <button
                  key={r.name}
                  type="button"
                  className="sort-card"
                  onClick={() => { setSelectedRede(r.name); setSearch(r.name) }}
                >
                  <span className="sort-card-name">{r.name}</span>
                  <span className="sort-card-meta">
                    <span style={{ color: 'var(--blue)' }}>{r.count} loja{r.count !== 1 ? 's' : ''}</span>
                  </span>
                  <span className="sort-card-badges">
                    {topCh && <span className="sort-channel-badge" style={{ fontSize: 9, padding: '1px 5px' }}>{topCh}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {totalCardsPages > 1 && (
            <div className="sort-cards-pagination">
              <button type="button" disabled={cardsPage === 0} onClick={() => setCardsPage(p => p - 1)}>Anterior</button>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{cardsPage + 1} de {totalCardsPages}</span>
              <button type="button" disabled={cardsPage >= totalCardsPages - 1} onClick={() => setCardsPage(p => p + 1)}>Próxima</button>
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
