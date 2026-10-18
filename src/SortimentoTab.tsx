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

const FAIXA_CHANNEL_MAP: Record<string, string> = {
  '1': 'Hiper',
  '2': 'Super G',
  '3': 'Super P',
  '4': 'Vizinhança GDE',
  '5': 'Vizinhança PEQ',
  '6': 'Tradicional Independente',
}

interface SortimentoItem {
  code: string
  description: string
  subcategory: string
  brand: string
  classification: 'Mandatório' | 'Importante'
  recommended: boolean
  purchased: boolean
  value: number
}

type ViewMode = 'cnpj' | 'rede'

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
  const [channelOverride, setChannelOverride] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<'all' | 'mandatorio' | 'importante'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'comprado' | 'faltando'>('all')
  const [sortBy, setSortBy] = useState<'subcategory' | 'brand' | 'value' | 'classification'>('subcategory')

  const availableChannels = useMemo(() => {
    const set = new Set<string>()
    for (const p of productBase) {
      if (p.sortimentChannels) {
        for (const ch of Object.keys(p.sortimentChannels)) set.add(ch)
      }
    }
    return [...set].sort()
  }, [productBase])

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
    for (const c of clientBase) {
      const rede = c.premiseNetwork?.trim()
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

  const detectedChannel = useMemo(() => {
    if (viewMode === 'cnpj') {
      if (!selectedClient) return ''
      const faixa = selectedClient.premiseRange ?? ''
      return FAIXA_CHANNEL_MAP[faixa] ?? ''
    }
    if (selectedRedeClients.length === 0) return ''
    const faixas = new Map<string, number>()
    for (const c of selectedRedeClients) {
      const f = c.premiseRange ?? ''
      if (f) faixas.set(f, (faixas.get(f) ?? 0) + 1)
    }
    let topFaixa = ''
    let topCount = 0
    for (const [f, count] of faixas) {
      if (count > topCount) { topFaixa = f; topCount = count }
    }
    return FAIXA_CHANNEL_MAP[topFaixa] ?? ''
  }, [selectedClient, selectedRedeClients, viewMode])

  const activeChannel = channelOverride ?? detectedChannel

  const hasSelection = viewMode === 'cnpj' ? !!selectedClient : selectedRedeClients.length > 0

  const analysis = useMemo(() => {
    if (!hasSelection || !activeChannel) return null

    const [y] = activeComp.split('-').map(Number)
    const startAno = `${y}-01-01`
    const now = new Date()
    const endAno = now.toISOString().slice(0, 10)

    const purchasedProducts = new Map<string, number>()

    const collectMovements = (client: CanonicalClient) => {
      const code = client.winthorCode ?? client.document
      const allMovs = [...(movsByCustomer.get(code) ?? []), ...(code !== client.document ? (movsByCustomer.get(client.document) ?? []) : [])]
      const movsAno = allMovs.filter(m => {
        const d = m.movementDate ?? ''
        return d >= startAno && d <= endAno && (m.movementType === 'venda_faturada' || m.movementType === 'devolucao')
      })
      for (const m of movsAno) {
        const pc = m.productCode ?? ''
        if (!pc) continue
        const val = m.movementType === 'venda_faturada' ? (m.value ?? 0) : -(m.value ?? 0)
        purchasedProducts.set(pc, (purchasedProducts.get(pc) ?? 0) + val)
      }
    }

    if (viewMode === 'cnpj' && selectedClient) {
      collectMovements(selectedClient)
    } else {
      for (const client of selectedRedeClients) collectMovements(client)
    }

    const items: SortimentoItem[] = []
    const recommendedCodes = new Set<string>()

    for (const p of productBase) {
      if (!p.sortimentChannels) continue
      const level = p.sortimentChannels[activeChannel]
      if (!level || level <= 0) continue

      const pCode = p.internalCode ?? p.manufacturerCode ?? ''
      if (!pCode) continue
      recommendedCodes.add(pCode)
      if (p.manufacturerCode) recommendedCodes.add(p.manufacturerCode)

      const purchaseValue = purchasedProducts.get(pCode) ?? (p.manufacturerCode ? (purchasedProducts.get(p.manufacturerCode) ?? 0) : 0)

      items.push({
        code: pCode,
        description: p.description ?? pCode,
        subcategory: p.subcategory ?? p.category ?? '',
        brand: p.brand ?? p.subBrand ?? '',
        classification: level === 1 ? 'Mandatório' : 'Importante',
        recommended: true,
        purchased: purchaseValue > 0,
        value: purchaseValue,
      })
    }

    for (const [pc, val] of purchasedProducts) {
      if (recommendedCodes.has(pc)) continue
      const prod = productByCode.get(pc)
      if (prod?.sortimentChannels && prod.sortimentChannels[activeChannel] != null) continue
      items.push({
        code: pc,
        description: prod?.description ?? pc,
        subcategory: prod?.subcategory ?? prod?.category ?? '',
        brand: prod?.brand ?? prod?.subBrand ?? '',
        classification: 'Mandatório',
        recommended: false,
        purchased: true,
        value: val,
      })
    }

    const recommended = items.filter(i => i.recommended)
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
    const valorForaSortimento = items.filter(i => !i.recommended).reduce((s, i) => s + i.value, 0)

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
    }
  }, [hasSelection, selectedClient, selectedRedeClients, viewMode, activeChannel, movsByCustomer, productBase, productByCode, activeComp])

  const filteredItems = useMemo(() => {
    if (!analysis) return []
    let items = analysis.items
    if (filterClass === 'mandatorio') items = items.filter(i => i.classification === 'Mandatório')
    else if (filterClass === 'importante') items = items.filter(i => i.classification === 'Importante')
    if (filterStatus === 'comprado') items = items.filter(i => i.purchased)
    else if (filterStatus === 'faltando') items = items.filter(i => i.recommended && !i.purchased)

    return [...items].sort((a, b) => {
      if (sortBy === 'value') return b.value - a.value
      if (sortBy === 'brand') return (a.brand || 'zzz').localeCompare(b.brand || 'zzz')
      if (sortBy === 'classification') {
        if (a.classification !== b.classification) return a.classification === 'Mandatório' ? -1 : 1
        return a.subcategory.localeCompare(b.subcategory)
      }
      return a.subcategory.localeCompare(b.subcategory) || a.brand.localeCompare(b.brand)
    })
  }, [analysis, filterClass, filterStatus, sortBy])

  const subcategoryGroups = useMemo(() => {
    const groups = new Map<string, { total: number; purchased: number; value: number }>()
    if (!analysis) return []
    for (const item of analysis.items.filter(i => i.recommended)) {
      const key = item.subcategory || 'Sem categoria'
      const g = groups.get(key) ?? { total: 0, purchased: 0, value: 0 }
      g.total++
      if (item.purchased) { g.purchased++; g.value += item.value }
      groups.set(key, g)
    }
    return [...groups.entries()]
      .map(([name, g]) => ({ name, ...g, coverage: g.total > 0 ? g.purchased / g.total : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [analysis])

  const clearSelection = () => {
    setSelectedDoc(null)
    setSelectedRede(null)
    setSearch('')
    setChannelOverride(null)
  }

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode)
    clearSelection()
  }

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
            onChange={e => { setSearch(e.target.value); if (!e.target.value) clearSelection() }}
          />
        </div>

        {viewMode === 'cnpj' && !selectedDoc && q.length >= 2 && (
          <div className="sort-dropdown">
            {clientResults.length === 0 && <p className="sort-empty">Nenhum cliente encontrado.</p>}
            {clientResults.map(c => {
              const faixa = c.premiseRange ?? ''
              const ch = FAIXA_CHANNEL_MAP[faixa] ?? ''
              return (
                <button
                  key={c.document}
                  type="button"
                  className="sort-dropdown-item"
                  onClick={() => {
                    setSelectedDoc(c.document)
                    setSearch(c.tradeName ?? c.legalName ?? c.document)
                    setChannelOverride(null)
                  }}
                >
                  <span className="sort-dropdown-name">{c.tradeName ?? c.legalName ?? c.document}</span>
                  <span className="sort-dropdown-meta">
                    <code>{c.document}</code>
                    {faixa && <span className="cad-badge-range">Faixa {faixa}</span>}
                    {ch && <span style={{ color: 'var(--blue)', fontSize: 11 }}>{ch}</span>}
                    {c.city && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{c.city}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {viewMode === 'rede' && !selectedRede && q.length >= 2 && (
          <div className="sort-dropdown">
            {redeResults.length === 0 && <p className="sort-empty">Nenhuma rede encontrada.</p>}
            {redeResults.map(r => (
              <button
                key={r.name}
                type="button"
                className="sort-dropdown-item"
                onClick={() => {
                  setSelectedRede(r.name)
                  setSearch(r.name)
                  setChannelOverride(null)
                }}
              >
                <span className="sort-dropdown-name">{r.name}</span>
                <span className="sort-dropdown-meta">
                  <span style={{ color: 'var(--blue)', fontSize: 11 }}>{r.count} loja{r.count !== 1 ? 's' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'cnpj' && selectedClient && (
        <div className="sort-header-info">
          <div className="sort-client-selected">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{selectedClient.tradeName ?? selectedClient.legalName ?? selectedClient.document}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedClient.document}</span>
              {selectedClient.premiseRange && <span className="cad-badge-range">Faixa {selectedClient.premiseRange}</span>}
              {selectedClient.premiseNetwork && <span style={{ color: 'var(--blue)', fontSize: 11 }}>Rede: {selectedClient.premiseNetwork}</span>}
              {pexSet.has(selectedClient.document) && <span className="badge-pex">PEX</span>}
              <button type="button" className="sort-clear-btn" onClick={clearSelection}>Trocar</button>
            </div>
          </div>
          <div className="sort-channel-select">
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Canal do sortimento:</label>
            <select
              className="pf-select"
              value={activeChannel}
              onChange={e => setChannelOverride(e.target.value)}
              style={{ minWidth: 160 }}
            >
              {!activeChannel && <option value="">Selecione um canal</option>}
              {availableChannels.map(ch => (
                <option key={ch} value={ch}>{ch}{ch === detectedChannel ? ' (detectado)' : ''}</option>
              ))}
            </select>
            {detectedChannel && activeChannel !== detectedChannel && (
              <button type="button" className="sort-reset-ch" onClick={() => setChannelOverride(null)}>
                Usar detectado ({detectedChannel})
              </button>
            )}
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
          <div className="sort-channel-select">
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Canal do sortimento:</label>
            <select
              className="pf-select"
              value={activeChannel}
              onChange={e => setChannelOverride(e.target.value)}
              style={{ minWidth: 160 }}
            >
              {!activeChannel && <option value="">Selecione um canal</option>}
              {availableChannels.map(ch => (
                <option key={ch} value={ch}>{ch}{ch === detectedChannel ? ' (detectado)' : ''}</option>
              ))}
            </select>
            {detectedChannel && activeChannel !== detectedChannel && (
              <button type="button" className="sort-reset-ch" onClick={() => setChannelOverride(null)}>
                Usar detectado ({detectedChannel})
              </button>
            )}
          </div>
        </div>
      )}

      {analysis && activeChannel && (
        <>
          <div className="sort-kpi-grid">
            <div className="sort-kpi">
              <span className="sort-kpi-label">Assortment</span>
              <span className="sort-kpi-value" style={{ color: analysis.assortment >= 0.5 ? '#4caf50' : analysis.assortment >= 0.25 ? '#ff9800' : '#ef5350' }}>
                {pct(analysis.assortment)}
              </span>
              <span className="sort-kpi-detail">{analysis.skusComprados} de {analysis.skusRecom} SKUs</span>
            </div>
            <div className="sort-kpi">
              <span className="sort-kpi-label">Cobertura Mandatório</span>
              <span className="sort-kpi-value" style={{ color: analysis.cobMand >= 0.5 ? '#4caf50' : analysis.cobMand >= 0.25 ? '#ff9800' : '#ef5350' }}>
                {pct(analysis.cobMand)}
              </span>
              <span className="sort-kpi-detail">{analysis.mandComprados} de {analysis.mandDisp}</span>
            </div>
            <div className="sort-kpi">
              <span className="sort-kpi-label">Cobertura Importante</span>
              <span className="sort-kpi-value" style={{ color: analysis.cobImp >= 0.5 ? '#4caf50' : analysis.cobImp >= 0.25 ? '#ff9800' : '#ef5350' }}>
                {pct(analysis.cobImp)}
              </span>
              <span className="sort-kpi-detail">{analysis.impComprados} de {analysis.impDisp}</span>
            </div>
            <div className="sort-kpi">
              <span className="sort-kpi-label">Valor no Sortimento</span>
              <span className="sort-kpi-value c-blue">{kpiCurrency(analysis.valorTotal)}</span>
              <span className="sort-kpi-detail">fora: {kpiCurrency(analysis.valorForaSortimento)}</span>
            </div>
          </div>

          {subcategoryGroups.length > 0 && (
            <div className="sort-subcat-section">
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 8px', textTransform: 'uppercase' }}>Cobertura por Subcategoria</h4>
              <div className="sort-subcat-grid">
                {subcategoryGroups.map(g => (
                  <div key={g.name} className="sort-subcat-item">
                    <div className="sort-subcat-bar">
                      <div className="sort-subcat-fill" style={{ width: `${Math.max(2, g.coverage * 100)}%`, background: g.coverage >= 0.5 ? '#4caf50' : g.coverage >= 0.25 ? '#ff9800' : '#ef5350' }} />
                    </div>
                    <div className="sort-subcat-info">
                      <span className="sort-subcat-name">{g.name}</span>
                      <span className="sort-subcat-nums">{g.purchased}/{g.total} · {pct(g.coverage)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sort-filters">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={`sort-filter-btn${filterClass === 'all' ? ' active' : ''}`} onClick={() => setFilterClass('all')}>Todos</button>
              <button type="button" className={`sort-filter-btn${filterClass === 'mandatorio' ? ' active' : ''}`} onClick={() => setFilterClass('mandatorio')}>Mandatório</button>
              <button type="button" className={`sort-filter-btn${filterClass === 'importante' ? ' active' : ''}`} onClick={() => setFilterClass('importante')}>Importante</button>
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
            <div className="sort-product-head">
              <span>Produto</span>
              <span className="sc-num">Classificação</span>
              <span className="sc-num">Status</span>
              <span className="sc-num">Valor</span>
            </div>
            {filteredItems.map(item => (
              <div key={item.code} className={`sort-product-row${item.purchased ? '' : ' sort-missing'}`}>
                <span className="sc-desc">
                  <span className="p-name">{item.description}</span>
                  <span className="p-meta">
                    <code>{item.code}</code>
                    {item.subcategory && <span>{item.subcategory}</span>}
                    {item.brand && <span style={{ color: 'var(--muted)' }}>{item.brand}</span>}
                  </span>
                </span>
                <span className="sc-num">
                  {item.recommended
                    ? <span className={`sort-class-badge ${item.classification === 'Mandatório' ? 'sort-mand' : 'sort-imp'}`}>{item.classification === 'Mandatório' ? 'Mand.' : 'Import.'}</span>
                    : <span className="sort-class-badge sort-fora">Fora</span>}
                </span>
                <span className="sc-num">
                  {item.purchased
                    ? <span className="sort-status-badge sort-ok">Comprou</span>
                    : <span className="sort-status-badge sort-miss">Faltando</span>}
                </span>
                <span className="sc-num">
                  {item.value > 0
                    ? <strong className="c-blue" style={{ fontSize: 12 }}>{kpiCurrency(item.value)}</strong>
                    : <span className="c-muted">—</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasSelection && !activeChannel && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <p>Selecione o canal do sortimento para analisar.</p>
          {availableChannels.length === 0 && (
            <p style={{ fontSize: 12, marginTop: 8 }}>Nenhum dado de sortimento encontrado. Carregue o arquivo de sortimento na aba de Administração → Produtos.</p>
          )}
        </div>
      )}

      {!hasSelection && !q && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <p>{viewMode === 'cnpj' ? 'Busque um cliente para analisar o sortimento.' : 'Busque uma rede para analisar o sortimento consolidado.'}</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {viewMode === 'cnpj'
              ? 'A análise cruza os produtos recomendados por canal (sortimento) com as compras reais do cliente, mostrando a cobertura de mandatórios e importantes.'
              : 'A visão por rede agrega todas as compras das lojas da rede e compara com o sortimento recomendado, mostrando a cobertura consolidada.'}
          </p>
          {availableChannels.length > 0 && (
            <p style={{ fontSize: 11, marginTop: 8, color: 'var(--blue)' }}>
              Canais disponíveis: {availableChannels.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
