import { useState, useEffect, useMemo, useRef } from 'react'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalReceipt } from './domain/receiptMotor'

type ProductTag = { launch?: boolean; pex?: boolean }
type Tags = Record<string, ProductTag>

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function loadTags(): Tags {
  try { return JSON.parse(localStorage.getItem('rj-product-tags') ?? '{}') }
  catch { return {} }
}

export function StockTab({ productBase, receiptBase }: {
  productBase: CanonicalProduct[]
  receiptBase: CanonicalReceipt[]
}) {
  const [subTab, setSubTab] = useState<'estoque' | 'produtos'>('estoque')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'in_transit'>('all')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterMarcacao, setFilterMarcacao] = useState<'all' | 'mandatory' | 'important'>('all')
  const [filterInStock, setFilterInStock] = useState(false)
  const [selected, setSelected] = useState<CanonicalProduct | null>(null)
  const [tags, setTags] = useState<Tags>(loadTags)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { localStorage.setItem('rj-product-tags', JSON.stringify(tags)) }
    catch { /* quota exceeded */ }
  }, [tags])

  const availableChannels = useMemo(() => {
    const seen = new Set<string>()
    for (const p of productBase)
      if (p.sortimentChannels)
        for (const ch of Object.keys(p.sortimentChannels)) seen.add(ch)
    return Array.from(seen).sort()
  }, [productBase])

  const filtered = useMemo(() => {
    const q = search.trim()
    return productBase.filter(p => {
      if (q) {
        const allDigits = /^\d+$/.test(q)
        const mixed = /[A-Za-z]/.test(q) && /\d/.test(q) && !q.includes(' ')
        if (allDigits) {
          if (q.length === 13) { if ((p.ean ?? '') !== q) return false }
          else if (q.length >= 7) { if (!(p.ean ?? '').endsWith(q)) return false }
          else {
            const byCode = (p.internalCode ?? '').startsWith(q)
            const byEan = q.length >= 4 && (p.ean ?? '').endsWith(q)
            if (!byCode && !byEan) return false
          }
        } else if (mixed) {
          if (!norm(p.manufacturerCode).startsWith(norm(q))) return false
        } else {
          const words = q.split(/\s+/).filter(Boolean).map(norm)
          if (!words.every(w => norm(p.description).includes(w))) return false
        }
      }
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (filterInStock && (p.availableStock ?? 0) <= 0) return false
      if (filterChannel && (p.sortimentChannels?.[filterChannel] ?? 0) <= 0) return false
      if (filterMarcacao === 'mandatory' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 1)) return false
      if (filterMarcacao === 'important' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 2)) return false
      return true
    })
  }, [productBase, search, filterStatus, filterInStock, filterChannel, filterMarcacao])

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

  const channelLevel = (v: number) => v === 1 ? 'Mandatório' : v === 2 ? 'Importante' : 'Fora'
  const channelClass = (v: number) => v === 1 ? 'ch-mandatory' : v === 2 ? 'ch-important' : 'ch-none'

  return (
    <section className="content">
      <div className="subtab-bar">
        <button type="button" className={`subtab${subTab === 'estoque' ? ' on' : ''}`} onClick={() => setSubTab('estoque')}>Estoque</button>
        <button type="button" className={`subtab${subTab === 'produtos' ? ' on' : ''}`} onClick={() => setSubTab('produtos')}>Produtos</button>
      </div>

      <div className="stock-toolbar">
        <input
          ref={searchRef}
          className="stock-search"
          placeholder="Descrição · código interno · 4+ dígitos finais do EAN · cód. fab. (ex: FBR120)…"
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
          {availableChannels.length > 0 && <>
            <span className="filter-label" style={{ marginLeft: 10 }}>Sortimento</span>
            <button type="button" className={`chip${filterChannel === '' ? ' on' : ''}`} onClick={() => setFilterChannel('')}>Todos</button>
            {availableChannels.map(ch => (
              <button key={ch} type="button" className={`chip${filterChannel === ch ? ' on' : ''}`} onClick={() => setFilterChannel(ch)}>{ch}</button>
            ))}
          </>}
          <span className="filter-label" style={{ marginLeft: 10 }}>Marcação</span>
          {(['all', 'mandatory', 'important'] as const).map(m => (
            <button key={m} type="button" className={`chip${filterMarcacao === m ? ' on' : ''}`} onClick={() => setFilterMarcacao(m)}>
              {m === 'all' ? 'Todos' : m === 'mandatory' ? 'Mandatório' : 'Importante'}
            </button>
          ))}
          <button type="button" className={`chip${filterInStock ? ' on' : ''}`} style={{ marginLeft: 10 }} onClick={() => setFilterInStock(v => !v)}>
            Com estoque
          </button>
        </div>
      </div>

      <div className="stock-count">
        <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
        produto{filtered.length !== 1 ? 's' : ''}
        {productBase.length !== filtered.length && ` de ${productBase.length.toLocaleString('pt-BR')}`}
      </div>

      <div className={`stock-layout${selected ? ' has-detail' : ''}`}>
        <div className={`stock-list stock-list--${subTab}`}>
          {subTab === 'estoque' ? <>
            <div className="stock-head">
              <span className="sc-desc">Produto</span>
              <span className="sc-num">Disponível</span>
              <span className="sc-num">Preço sem ST</span>
              <span className="sc-num">Preço com ST</span>
            </div>
            {filtered.length === 0 && (
              <p className="empty" style={{ padding: '24px 16px' }}>Nenhum produto encontrado.</p>
            )}
            {filtered.map(p => {
              const isSel = selected?.id === p.id
              const avail = p.availableStock ?? 0
              const availCx = p.unitsPerBox ? Math.floor(avail / p.unitsPerBox) : undefined
              const semStCx = (p.sellerPriceWithoutTax !== undefined && p.unitsPerBox) ? p.sellerPriceWithoutTax * p.unitsPerBox : undefined
              const comStCx = (p.sellerPrice !== undefined && p.unitsPerBox) ? p.sellerPrice * p.unitsPerBox : undefined
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
                    </span>
                  </span>
                  <span className="sc-num">
                    <span className="dual-val">
                      <strong className={avail > 0 ? 'c-green' : 'c-muted'}>{avail.toLocaleString('pt-BR')}</strong>
                      <small>UN</small>
                    </span>
                    {availCx !== undefined && (
                      <span className="dual-val">
                        <strong className={availCx > 0 ? 'c-green' : 'c-muted'}>{availCx.toLocaleString('pt-BR')}</strong>
                        <small>CX</small>
                      </span>
                    )}
                  </span>
                  <span className="sc-num sc-hide-sm">
                    <span className="dual-val">
                      <strong>{p.sellerPriceWithoutTax !== undefined ? `R$ ${brl(p.sellerPriceWithoutTax)}` : '—'}</strong>
                      <small>UN</small>
                    </span>
                    {semStCx !== undefined && (
                      <span className="dual-val">
                        <strong>{`R$ ${brl(semStCx)}`}</strong>
                        <small>CX</small>
                      </span>
                    )}
                  </span>
                  <span className="sc-num">
                    <span className="dual-val">
                      <strong>{p.sellerPrice !== undefined ? `R$ ${brl(p.sellerPrice)}` : '—'}</strong>
                      <small>UN</small>
                    </span>
                    {comStCx !== undefined && (
                      <span className="dual-val">
                        <strong>{`R$ ${brl(comStCx)}`}</strong>
                        <small>CX</small>
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </> : <>
            <div className="stock-head">
              <span className="sc-desc">Produto</span>
              <span className="sc-num">Margem</span>
              <span className="sc-num">Cobertura</span>
              <span className="sc-num sc-hide-sm">UN/CX</span>
            </div>
            {filtered.length === 0 && (
              <p className="empty" style={{ padding: '24px 16px' }}>Nenhum produto encontrado.</p>
            )}
            {filtered.map(p => {
              const isSel = selected?.id === p.id
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
                      {p.subBrand && <span className="p-subbrand">{p.subBrand}</span>}
                      {p.groupName && <span className="p-group">{p.groupName}</span>}
                      {tags[p.id]?.launch && <span className="badge-launch">Lançamento</span>}
                      {tags[p.id]?.pex && <span className="badge-pex">PEX</span>}
                    </span>
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
                  <span className="sc-num sc-hide-sm">
                    <strong>{p.unitsPerBox ?? '—'}</strong>
                  </span>
                </div>
              )
            })}
          </>}
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
              <button type="button" className={`tag-pill${tags[selected.id]?.launch ? ' tl' : ''}`} onClick={() => toggleTag(selected.id, 'launch')}>
                {tags[selected.id]?.launch ? '★ Lançamento' : '☆ Lançamento'}
              </button>
              <button type="button" className={`tag-pill${tags[selected.id]?.pex ? ' tp' : ''}`} onClick={() => toggleTag(selected.id, 'pex')}>
                {tags[selected.id]?.pex ? '★ PEX' : '☆ PEX'}
              </button>
            </div>

            {subTab === 'estoque' ? <>
              {(selected.inTransitQuantity ?? 0) > 0 && (
                <div className="sd-section">
                  <div className="sd-section-title">Carteira (a chegar)</div>
                  <div className="sd-grid">
                    <DI label="Quantidade" value={(selected.inTransitQuantity ?? 0).toLocaleString('pt-BR')} hi />
                    <DI label="Valor" value={selected.inTransitValue !== undefined ? `R$ ${brl(selected.inTransitValue)}` : '—'} />
                  </div>
                </div>
              )}

              {selected.sortimentChannels && Object.keys(selected.sortimentChannels).length > 0 && (
                <div className="sd-section">
                  <div className="sd-section-title">Sortimento</div>
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
            </> : <>
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
                  <DI label="Preço com ST" value={selected.sellerPrice !== undefined ? `R$ ${brl(selected.sellerPrice)}` : '—'} hi={selected.sellerPrice !== undefined} />
                  <DI label="Preço sem ST" value={selected.sellerPriceWithoutTax !== undefined ? `R$ ${brl(selected.sellerPriceWithoutTax)}` : '—'} />
                  <DI label="Custo financeiro" value={selected.financialCost !== undefined ? `R$ ${brl(selected.financialCost)}` : '—'} />
                  <DI label="Custo real" value={selected.realCost !== undefined ? `R$ ${brl(selected.realCost)}` : '—'} />
                  <DI label="Margem bruta" value={selected.margin !== undefined ? `${selected.margin.toFixed(1)}%` : '—'} hi={selected.margin !== undefined && selected.margin >= 30} />
                  <DI label="Giro diário" value={selected.dailyTurnover !== undefined ? selected.dailyTurnover.toString() : '—'} />
                  <DI label="Cobertura" value={selected.stockCoverage !== undefined ? `${selected.stockCoverage} dias` : '—'} />
                  {selected.industryBasePrice !== undefined && <DI label="Ref. indústria" value={`R$ ${brl(selected.industryBasePrice)}`} />}
                </div>
              </div>

              <div className="sd-section">
                <div className="sd-section-title">Sortimento</div>
                <DI label="Status" value={selected.sortimentStatus ?? '—'} />
                <DI label="Ciclo de vida" value={selected.lifestageStatus ?? '—'} />
                {selected.sortimentChannels && Object.keys(selected.sortimentChannels).length > 0 && (
                  <div className="channel-grid" style={{ marginTop: 8 }}>
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

              {(selected.category || selected.brand || selected.subBrand || selected.department) && (
                <div className="sd-section">
                  <div className="sd-section-title">Classificação</div>
                  <div className="sd-grid">
                    {selected.brand && <DI label="Marca" value={selected.brand} />}
                    {selected.subBrand && <DI label="Sub-marca" value={selected.subBrand} />}
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
            </>}
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
