import { useState, useEffect, useMemo, useRef } from 'react'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalClient } from './domain/clientMotor'
import type { CanonicalReceipt } from './domain/receiptMotor'

type ProductTag = { launch?: boolean; pex?: boolean }
type Tags = Record<string, ProductTag>

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const docKey = (v: string) => v.replace(/\D/g, '')
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function loadTags(): Tags {
  try { return JSON.parse(localStorage.getItem('rj-product-tags') ?? '{}') }
  catch { return {} }
}

export function StockTab({ productBase, clientBase, receiptBase }: {
  productBase: CanonicalProduct[]
  clientBase: CanonicalClient[]
  receiptBase: CanonicalReceipt[]
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'in_transit'>('all')
  const [filterSortiment, setFilterSortiment] = useState<'all' | 'mandatory' | 'important' | 'in_sortiment' | 'none'>('all')
  const [filterTag, setFilterTag] = useState<'all' | 'launch' | 'pex'>('all')
  const [filterInStock, setFilterInStock] = useState(false)
  const [clientInput, setClientInput] = useState('')
  const [activeClient, setActiveClient] = useState('')
  const [selected, setSelected] = useState<CanonicalProduct | null>(null)
  const [tags, setTags] = useState<Tags>(loadTags)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { localStorage.setItem('rj-product-tags', JSON.stringify(tags)) }
    catch { /* quota exceeded */ }
  }, [tags])

  const resolvedClient = useMemo(() => {
    if (!activeClient) return null
    const key = docKey(activeClient)
    return clientBase.find(c => c.document === key) ?? null
  }, [activeClient, clientBase])

  const filtered = useMemo(() => {
    const q = search.trim()
    return productBase.filter(p => {
      if (q) {
        const allDigits = /^\d+$/.test(q)
        const mixed = /[A-Za-z]/.test(q) && /\d/.test(q) && !q.includes(' ')
        if (allDigits) {
          if (q.length === 13) { if ((p.ean ?? '') !== q) return false }
          else if (q.length >= 7) { if (!(p.ean ?? '').startsWith(q)) return false }
          else { if (!(p.internalCode ?? '').startsWith(q)) return false }
        } else if (mixed) {
          if (!norm(p.manufacturerCode).startsWith(norm(q))) return false
        } else {
          const words = q.split(/\s+/).filter(Boolean).map(norm)
          const desc = norm(p.description)
          if (!words.every(w => desc.includes(w))) return false
        }
      }
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (filterInStock && (p.availableStock ?? 0) <= 0) return false
      const tag = tags[p.id]
      if (filterTag === 'launch' && !tag?.launch) return false
      if (filterTag === 'pex' && !tag?.pex) return false
      if (filterSortiment !== 'all') {
        const ch = p.sortimentChannels
        if (filterSortiment === 'none' && ch && Object.keys(ch).length > 0) return false
        if (filterSortiment === 'in_sortiment' && (!ch || Object.keys(ch).length === 0)) return false
        if (filterSortiment === 'mandatory' && (!ch || !Object.values(ch).some(v => v === 1))) return false
        if (filterSortiment === 'important' && (!ch || !Object.values(ch).some(v => v === 2))) return false
      }
      if (activeClient && resolvedClient?.channelType) {
        if ((p.sortimentChannels?.[resolvedClient.channelType] ?? 0) <= 0) return false
      }
      return true
    })
  }, [productBase, search, filterStatus, filterInStock, filterTag, filterSortiment, activeClient, resolvedClient, tags])

  const lastReceipt = useMemo(() => {
    if (!selected) return null
    return receiptBase
      .filter(r => r.productCode === selected.internalCode && r.status === 'recebida')
      .sort((a, b) => (b.entryDate ?? '').localeCompare(a.entryDate ?? ''))[0] ?? null
  }, [selected, receiptBase])

  function toggleTag(id: string, key: 'launch' | 'pex') {
    setTags(cur => {
      const prev = cur[id] ?? {}
      return { ...cur, [id]: { ...prev, [key]: !prev[key] } }
    })
  }

  function applyClient() { setActiveClient(clientInput) }

  const channelLevel = (v: number) => v === 1 ? 'Mandatório' : v === 2 ? 'Importante' : 'Fora'
  const channelClass = (v: number) => v === 1 ? 'ch-mandatory' : v === 2 ? 'ch-important' : 'ch-none'

  return (
    <section className="content">
      <div className="stock-toolbar">
        <input
          ref={searchRef}
          className="stock-search"
          placeholder="Descrição · código interno (ex: 915) · EAN 7+ dígitos · cód. fab. (ex: FBR120)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="stock-filters">
          <span className="filter-label">Status</span>
          {(['all', 'active', 'in_transit'] as const).map(s => (
            <button key={s} type="button" className={`chip${filterStatus === s ? ' on' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativo' : 'Em trânsito'}
            </button>
          ))}
          <span className="filter-label" style={{ marginLeft: 10 }}>Sortimento</span>
          {(['all', 'mandatory', 'important', 'in_sortiment', 'none'] as const).map(s => (
            <button key={s} type="button" className={`chip${filterSortiment === s ? ' on' : ''}`} onClick={() => setFilterSortiment(s)}>
              {s === 'all' ? 'Todos' : s === 'mandatory' ? 'Mandatório' : s === 'important' ? 'Importante' : s === 'in_sortiment' ? 'No sortimento' : 'Sem sortimento'}
            </button>
          ))}
          <span className="filter-label" style={{ marginLeft: 10 }}>Marcação</span>
          {(['all', 'launch', 'pex'] as const).map(t => (
            <button key={t} type="button" className={`chip${filterTag === t ? ' on' : ''}`} onClick={() => setFilterTag(t)}>
              {t === 'all' ? 'Todos' : t === 'launch' ? 'Lançamento' : 'PEX'}
            </button>
          ))}
          <button type="button" className={`chip${filterInStock ? ' on' : ''}`} style={{ marginLeft: 10 }} onClick={() => setFilterInStock(v => !v)}>
            Com estoque
          </button>
        </div>
        <div className="stock-client-row">
          <input
            className="stock-cnpj"
            placeholder="CNPJ do cliente para filtrar por sortimento…"
            value={clientInput}
            onChange={e => setClientInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyClient()}
          />
          <button type="button" className="process-button" style={{ margin: 0 }} onClick={applyClient}>
            Filtrar
          </button>
          {activeClient && (
            <button type="button" className="secondary-button" style={{ margin: 0 }} onClick={() => { setActiveClient(''); setClientInput('') }}>
              Limpar
            </button>
          )}
          {activeClient && (
            <span className="client-pill">
              {resolvedClient
                ? <>{resolvedClient.tradeName ?? resolvedClient.legalName} <strong>· Canal: {resolvedClient.channelType ?? '—'}</strong></>
                : 'Cliente não encontrado na base'}
            </span>
          )}
        </div>
      </div>

      <div className="stock-count">
        <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
        produto{filtered.length !== 1 ? 's' : ''}
        {productBase.length !== filtered.length && ` de ${productBase.length.toLocaleString('pt-BR')}`}
      </div>

      <div className={`stock-layout${selected ? ' has-detail' : ''}`}>
        <div className="stock-list">
          <div className="stock-head">
            <span className="sc-desc">Produto</span>
            <span className="sc-num">Disponível</span>
            <span className="sc-num">Preço</span>
            <span className="sc-num">Margem</span>
            <span className="sc-num">Cobertura</span>
            <span className="sc-tags"></span>
          </div>
          {filtered.length === 0 && (
            <p className="empty" style={{ padding: '24px 16px' }}>Nenhum produto encontrado para os filtros selecionados.</p>
          )}
          {filtered.map(p => {
            const tag = tags[p.id]
            const isSel = selected?.id === p.id
            const avail = p.availableStock ?? 0
            return (
              <div
                key={p.id}
                className={`stock-row${isSel ? ' sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(isSel ? null : p)}
                onKeyDown={e => e.key === 'Enter' && setSelected(isSel ? null : p)}
              >
                <span className="sc-desc">
                  <span className="p-name">{p.description ?? '—'}</span>
                  <span className="p-meta">
                    {p.internalCode && <code>{p.internalCode}</code>}
                    {p.brand && <span>{p.brand}</span>}
                    {p.groupName && <span className="p-group">{p.groupName}</span>}
                    {tag?.launch && <span className="badge-launch">Lançamento</span>}
                    {tag?.pex && <span className="badge-pex">PEX</span>}
                  </span>
                </span>
                <span className="sc-num">
                  <strong className={avail > 0 ? 'c-green' : 'c-muted'}>{avail.toLocaleString('pt-BR')}</strong>
                  <small>{p.unit ?? ''}</small>
                </span>
                <span className="sc-num">
                  <strong>{p.sellerPrice !== undefined ? `R$ ${brl(p.sellerPrice)}` : '—'}</strong>
                </span>
                <span className="sc-num">
                  <strong className={p.margin !== undefined ? (p.margin >= 30 ? 'c-green' : p.margin >= 15 ? 'c-amber' : 'c-red') : ''}>
                    {p.margin !== undefined ? `${p.margin.toFixed(1)}%` : '—'}
                  </strong>
                </span>
                <span className="sc-num">
                  <strong className={p.stockCoverage !== undefined ? (p.stockCoverage >= 30 ? 'c-green' : p.stockCoverage >= 7 ? 'c-amber' : 'c-red') : ''}>
                    {p.stockCoverage !== undefined ? `${p.stockCoverage}d` : '—'}
                  </strong>
                </span>
                <span className="sc-tags" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`tag-dot${tag?.launch ? ' tl' : ''}`}
                    title={tag?.launch ? 'Remover marcação de Lançamento' : 'Marcar como Lançamento'}
                    onClick={() => toggleTag(p.id, 'launch')}
                  >L</button>
                  <button
                    type="button"
                    className={`tag-dot${tag?.pex ? ' tp' : ''}`}
                    title={tag?.pex ? 'Remover marcação de PEX' : 'Marcar como PEX'}
                    onClick={() => toggleTag(p.id, 'pex')}
                  >P</button>
                </span>
              </div>
            )
          })}
        </div>

        {selected && (
          <aside className="stock-detail">
            <div className="sd-header">
              <div className="sd-title-area">
                <h3 className="sd-name">{selected.description ?? '—'}</h3>
                <div className="sd-codes">
                  {selected.internalCode && <span>Cód. <strong>{selected.internalCode}</strong></span>}
                  {selected.manufacturerCode && <span>Fab. <strong>{selected.manufacturerCode}</strong></span>}
                  {selected.ean && <span>EAN <strong>{selected.ean}</strong></span>}
                </div>
              </div>
              <button type="button" className="close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="sd-tags">
              <button
                type="button"
                className={`tag-pill${tags[selected.id]?.launch ? ' tl' : ''}`}
                onClick={() => toggleTag(selected.id, 'launch')}
              >{tags[selected.id]?.launch ? '★ Lançamento' : '☆ Lançamento'}</button>
              <button
                type="button"
                className={`tag-pill${tags[selected.id]?.pex ? ' tp' : ''}`}
                onClick={() => toggleTag(selected.id, 'pex')}
              >{tags[selected.id]?.pex ? '★ PEX' : '☆ PEX'}</button>
            </div>

            <div className="sd-section">
              <div className="sd-section-title">Estoque</div>
              <div className="sd-grid">
                <DI label="Disponível" value={(selected.availableStock ?? 0).toLocaleString('pt-BR')} hi={(selected.availableStock ?? 0) > 0} />
                <DI label="Total" value={(selected.totalStock ?? 0).toLocaleString('pt-BR')} />
                <DI label="Reservado" value={(selected.reservedStock ?? 0).toLocaleString('pt-BR')} />
                <DI label="Bloqueado" value={(selected.blockedStock ?? 0).toLocaleString('pt-BR')} />
                <DI label="Avariado" value={(selected.damagedStock ?? 0).toLocaleString('pt-BR')} />
                <DI label="Ind. em estoque" value={(selected.industryQuantity ?? 0).toLocaleString('pt-BR')} />
              </div>
            </div>

            {(selected.inTransitQuantity ?? 0) > 0 && (
              <div className="sd-section">
                <div className="sd-section-title">Carteira (a chegar)</div>
                <div className="sd-grid">
                  <DI label="Quantidade" value={(selected.inTransitQuantity ?? 0).toLocaleString('pt-BR')} hi />
                  <DI label="Valor" value={selected.inTransitValue !== undefined ? `R$ ${brl(selected.inTransitValue)}` : '—'} />
                </div>
              </div>
            )}

            {lastReceipt && (
              <div className="sd-section">
                <div className="sd-section-title">Última entrada</div>
                <div className="sd-grid">
                  <DI label="Data" value={lastReceipt.entryDate ?? '—'} />
                  <DI label="Nota" value={lastReceipt.invoice ?? '—'} />
                  <DI label="Quantidade" value={(lastReceipt.quantity ?? 0).toLocaleString('pt-BR')} />
                  <DI label="Custo unit." value={lastReceipt.unitPrice !== undefined ? `R$ ${brl(lastReceipt.unitPrice)}` : '—'} />
                  <DI label="Fornecedor" value={lastReceipt.supplierName ?? '—'} />
                </div>
              </div>
            )}

            <div className="sd-section">
              <div className="sd-section-title">Preços e custos</div>
              <div className="sd-grid">
                <DI label="Preço vendedor" value={selected.sellerPrice !== undefined ? `R$ ${brl(selected.sellerPrice)}` : '—'} />
                <DI label="Preço s/ imposto" value={selected.sellerPriceWithoutTax !== undefined ? `R$ ${brl(selected.sellerPriceWithoutTax)}` : '—'} />
                <DI label="Custo financeiro" value={selected.financialCost !== undefined ? `R$ ${brl(selected.financialCost)}` : '—'} />
                <DI label="Custo real" value={selected.realCost !== undefined ? `R$ ${brl(selected.realCost)}` : '—'} />
                <DI label="Margem bruta" value={selected.margin !== undefined ? `${selected.margin.toFixed(1)}%` : '—'} hi={selected.margin !== undefined && selected.margin >= 30} />
                <DI label="Giro diário" value={selected.dailyTurnover !== undefined ? selected.dailyTurnover.toString() : '—'} />
                <DI label="Cobertura de estoque" value={selected.stockCoverage !== undefined ? `${selected.stockCoverage} dias` : '—'} />
                {selected.industryBasePrice !== undefined && <DI label="Ref. indústria" value={`R$ ${brl(selected.industryBasePrice)}`} />}
              </div>
            </div>

            <div className="sd-section">
              <div className="sd-section-title">Sortimento</div>
              <DI label="Status" value={selected.sortimentStatus ?? '—'} />
              <DI label="Ciclo de vida" value={selected.lifestageStatus ?? '—'} />
              {selected.sortimentChannels && Object.keys(selected.sortimentChannels).length > 0 && (
                <div className="channel-grid">
                  {Object.entries(selected.sortimentChannels)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ch, lv]) => (
                      <div key={ch} className={`channel-item ${channelClass(lv)}`}>
                        <span className="ch-name">{ch}</span>
                        <span className="ch-level">{channelLevel(lv)}</span>
                      </div>
                    ))}
                </div>
              )}
              {(!selected.sortimentChannels || Object.keys(selected.sortimentChannels).length === 0) && (
                <p className="empty" style={{ marginTop: 8, fontSize: 12 }}>Sem dados de canal de sortimento.</p>
              )}
            </div>

            {(selected.category || selected.brand || selected.department) && (
              <div className="sd-section">
                <div className="sd-section-title">Classificação</div>
                <div className="sd-grid">
                  {selected.brand && <DI label="Marca" value={selected.brand} />}
                  {selected.category && <DI label="Categoria" value={selected.category} />}
                  {selected.subcategory && <DI label="Subcategoria" value={selected.subcategory} />}
                  {selected.department && <DI label="Departamento" value={selected.department} />}
                  {selected.ncm && <DI label="NCM" value={selected.ncm} />}
                  {selected.taxClassification && <DI label="Tributação" value={selected.taxClassification} />}
                  {selected.buyer && <DI label="Comprador" value={selected.buyer} />}
                </div>
              </div>
            )}

            {selected.unitsPerBox && (
              <div className="sd-section">
                <div className="sd-section-title">Embalagem</div>
                <div className="sd-grid">
                  <DI label="Un. por caixa" value={selected.unitsPerBox.toString()} />
                  {selected.boxesPerPallet !== undefined && <DI label="Cx. por palete" value={selected.boxesPerPallet.toString()} />}
                  {selected.grossWeightUnit !== undefined && <DI label="Peso bruto unit." value={`${selected.grossWeightUnit} kg`} />}
                  {selected.netWeightUnit !== undefined && <DI label="Peso líq. unit." value={`${selected.netWeightUnit} kg`} />}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  )
}

function DI({ label, value, hi }: { label: string; value: string; hi?: boolean }) {
  return (
    <div className="di">
      <span className="di-label">{label}</span>
      <strong className={hi ? 'c-green' : ''}>{value}</strong>
    </div>
  )
}
