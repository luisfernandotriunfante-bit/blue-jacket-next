import { useState, useEffect, useMemo, useRef } from 'react'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalReceipt } from './domain/receiptMotor'

type ProductTag = { launch?: boolean; pex?: boolean }
type Tags = Record<string, ProductTag>
type StockFilter = 'all' | 'com_estoque' | 'sem_estoque' | 'em_transito'

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kpiCurrency = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `R$ ${brl(n)}`
}
const fmtDate = (iso?: string) => {
  if (!iso) return 'Sem data'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

const fmtWeight = (kg: number) => {
  if (kg <= 0) return null
  if (kg < 1) return `${Math.round(kg * 1000)}g`
  const s = kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
  return `${s}kg`
}

const normCh = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const isBlockedChannel = (ch: string) => {
  const n = normCh(ch)
  return n === 'clubs' || n.startsWith('ecommerce') || n === 'sortimentoatacados' || n === 'sortimentodistribuidores'
}

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
  const [filterStatus, setFilterStatus] = useState<StockFilter>('all')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterMarcacao, setFilterMarcacao] = useState<'all' | 'mandatory' | 'important'>('all')
  const [selected, setSelected] = useState<CanonicalProduct | null>(null)
  const [tags, setTags] = useState<Tags>(loadTags)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { localStorage.setItem('rj-product-tags', JSON.stringify(tags)) }
    catch { /* quota exceeded */ }
  }, [tags])

  const kpis = useMemo(() => {
    let comEstoque = 0, semEstoque = 0, emTransito = 0
    let valorEstoque = 0, valorTransito = 0
    for (const p of productBase) {
      const avail = p.availableStock ?? 0
      if (avail > 0) comEstoque++; else semEstoque++
      if ((p.inTransitQuantity ?? 0) > 0) emTransito++
      if (p.sellerPrice !== undefined) valorEstoque += avail * p.sellerPrice
      valorTransito += p.inTransitValue ?? 0
    }
    return { comEstoque, semEstoque, emTransito, valorEstoque, valorTransito, total: productBase.length }
  }, [productBase])

  const arrivalGroups = useMemo(() => {
    const transit = receiptBase
      .filter(r => r.status === 'em_transito')
      .sort((a, b) => (a.entryDate ?? '').localeCompare(b.entryDate ?? ''))
    const groups = new Map<string, CanonicalReceipt[]>()
    for (const r of transit) {
      const key = r.entryDate ?? ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries())
  }, [receiptBase])

  const availableChannels = useMemo(() => {
    const seen = new Set<string>()
    for (const p of productBase)
      if (p.sortimentChannels)
        for (const ch of Object.keys(p.sortimentChannels)) seen.add(ch)
    return Array.from(seen).filter(ch => !isBlockedChannel(ch)).sort()
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
      if (filterStatus === 'com_estoque' && (p.availableStock ?? 0) <= 0) return false
      if (filterStatus === 'sem_estoque' && (p.availableStock ?? 0) > 0) return false
      if (filterStatus === 'em_transito' && (p.inTransitQuantity ?? 0) <= 0) return false
      if (filterChannel && (p.sortimentChannels?.[filterChannel] ?? 0) <= 0) return false
      if (filterMarcacao === 'mandatory' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 1)) return false
      if (filterMarcacao === 'important' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 2)) return false
      return true
    })
  }, [productBase, search, filterStatus, filterChannel, filterMarcacao])

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
    <>
      <header className="topbar stock-topbar">
        <button
          type="button"
          className={`stock-nav-btn${subTab === 'estoque' ? ' on' : ''}`}
          onClick={() => setSubTab('estoque')}
        >Estoque</button>
        <button
          type="button"
          className={`stock-nav-btn${subTab === 'produtos' ? ' on' : ''}`}
          onClick={() => setSubTab('produtos')}
        >Produtos</button>
      </header>

      <section className="content">
        {subTab === 'estoque' ? (
          <>
            <div className="stock-kpis">
              <KpiCard label="Total de SKUs" value={kpis.total.toLocaleString('pt-BR')} />
              <KpiCard label="Com estoque" value={kpis.comEstoque.toLocaleString('pt-BR')} accent="green" />
              <KpiCard label="Sem estoque" value={kpis.semEstoque.toLocaleString('pt-BR')} accent="red" />
              {kpis.emTransito > 0 && (
                <KpiCard label="Em trânsito" value={kpis.emTransito.toLocaleString('pt-BR')} accent="amber" />
              )}
              {kpis.valorEstoque > 0 && (
                <KpiCard label="Valor em estoque" value={kpiCurrency(kpis.valorEstoque)} sub="com ST" />
              )}
              {kpis.valorTransito > 0 && (
                <KpiCard label="Valor a chegar" value={kpiCurrency(kpis.valorTransito)} accent="amber" />
              )}
            </div>

            <div className="stock-arrivals">
              <div className="arrivals-head">Entradas previstas</div>
              {arrivalGroups.length === 0 ? (
                <p className="empty" style={{ padding: '24px 16px' }}>
                  Sem entradas previstas. Importe a carteira em Administração.
                </p>
              ) : arrivalGroups.map(([date, items]) => (
                <div key={date || 'nodate'} className="arrival-group">
                  <div className="arrival-date">{fmtDate(date || undefined)}</div>
                  {items.map((r, i) => {
                    const prod = productBase.find(p => p.internalCode === r.productCode)
                    const desc = r.description ?? prod?.description ?? r.productCode ?? '—'
                    return (
                      <div key={i} className="arrival-row">
                        <span className="arr-desc">
                          <span>{desc}</span>
                          {r.productCode && <code className="arr-code">{r.productCode}</code>}
                        </span>
                        <span className="arr-qty">
                          <strong>{(r.quantity ?? 0).toLocaleString('pt-BR')}</strong>
                          <small>UN</small>
                        </span>
                        <span className="arr-val">
                          {r.value ? `R$ ${brl(r.value)}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="stock-toolbar">
              <div className="pf-bar">
                <input
                  ref={searchRef}
                  className="pf-input"
                  placeholder="Buscar produto, EAN ou código interno…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="pf-select"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as StockFilter)}
                  aria-label="Filtrar situação"
                >
                  <option value="all">Todas as situações</option>
                  <option value="com_estoque">Com estoque</option>
                  <option value="sem_estoque">Sem estoque</option>
                  <option value="em_transito">Em trânsito</option>
                </select>
              </div>
              {availableChannels.length > 0 && (
                <fieldset className="pf-range">
                  <legend>Sortimento</legend>
                  <div>
                    <button type="button" className={filterChannel === '' ? 'is-active' : ''} onClick={() => setFilterChannel('')}>Todos</button>
                    {availableChannels.map(ch => (
                      <button key={ch} type="button" className={filterChannel === ch ? 'is-active' : ''} onClick={() => setFilterChannel(ch)}>{ch}</button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="pf-range">
                <legend>Marcação</legend>
                <div>
                  {(['all', 'mandatory', 'important'] as const).map(m => (
                    <button key={m} type="button" className={filterMarcacao === m ? 'is-active' : ''} onClick={() => setFilterMarcacao(m)}>
                      {m === 'all' ? 'Todos' : m === 'mandatory' ? 'Mandatório' : 'Importante'}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="stock-count">
              <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
              produto{filtered.length !== 1 ? 's' : ''}
              {productBase.length !== filtered.length && ` de ${productBase.length.toLocaleString('pt-BR')}`}
            </div>

            <div className={`stock-layout${selected ? ' has-detail' : ''}`}>
              <div className="stock-list stock-list--estoque">
                <div className="stock-head">
                  <span className="sc-desc">Produto</span>
                  <span className="sc-num">Disponível</span>
                  <span className="sc-num sc-hide-sm">Preço sem ST</span>
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
                        {(p.package || p.netWeightUnit !== undefined) && (
                          <span className="p-pkg-line">
                            {p.package && <span className="p-pack">{p.package}</span>}
                            {p.netWeightUnit !== undefined && fmtWeight(p.netWeightUnit) && (
                              <span className="p-weight">{fmtWeight(p.netWeightUnit)}</span>
                            )}
                          </span>
                        )}
                        <span className="p-meta">
                          {p.internalCode && <code>{p.internalCode}</code>}
                          {p.brand && <span>{p.brand}</span>}
                          {p.groupName && <span className="p-group">{p.groupName}</span>}
                          {tags[p.id]?.launch && <span className="badge-launch">Lançamento</span>}
                          {tags[p.id]?.pex && <span className="badge-pex">PEX</span>}
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
                        {p.sellerPriceWithoutTax !== undefined ? <>
                          <span className="dual-val">
                            <strong>{`R$ ${brl(p.sellerPriceWithoutTax)}`}</strong>
                            <small>UN</small>
                          </span>
                          {semStCx !== undefined && (
                            <span className="dual-val">
                              <strong>{`R$ ${brl(semStCx)}`}</strong>
                              <small>CX</small>
                            </span>
                          )}
                        </> : <strong className="c-muted">—</strong>}
                      </span>
                      <span className="sc-num">
                        {p.sellerPrice !== undefined ? <>
                          <span className="dual-val">
                            <strong>{`R$ ${brl(p.sellerPrice)}`}</strong>
                            <small>UN</small>
                          </span>
                          {comStCx !== undefined && (
                            <span className="dual-val">
                              <strong>{`R$ ${brl(comStCx)}`}</strong>
                              <small>CX</small>
                            </span>
                          )}
                        </> : <strong className="c-muted">—</strong>}
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
                    <button type="button" className={`tag-pill${tags[selected.id]?.launch ? ' tl' : ''}`} onClick={() => toggleTag(selected.id, 'launch')}>
                      {tags[selected.id]?.launch ? '★ Lançamento' : '☆ Lançamento'}
                    </button>
                    <button type="button" className={`tag-pill${tags[selected.id]?.pex ? ' tp' : ''}`} onClick={() => toggleTag(selected.id, 'pex')}>
                      {tags[selected.id]?.pex ? '★ PEX' : '☆ PEX'}
                    </button>
                  </div>

                  <div className="sd-section">
                    <div className="sd-section-title">Estoque</div>
                    <div className="sd-grid">
                      <DI label="Disponível" value={(selected.availableStock ?? 0).toLocaleString('pt-BR')} hi={(selected.availableStock ?? 0) > 0} />
                      <DI label="Total" value={(selected.totalStock ?? 0).toLocaleString('pt-BR')} />
                      <DI label="Reservado" value={(selected.reservedStock ?? 0).toLocaleString('pt-BR')} />
                      <DI label="Bloqueado" value={(selected.blockedStock ?? 0).toLocaleString('pt-BR')} />
                      {(selected.damagedStock ?? 0) > 0 && <DI label="Avariado" value={(selected.damagedStock ?? 0).toLocaleString('pt-BR')} />}
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
                </aside>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: 'green' | 'red' | 'amber'; sub?: string }) {
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
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
