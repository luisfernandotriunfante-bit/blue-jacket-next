import { useState, useMemo, useEffect } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalProduct } from './domain/productMotor'
import { COMMERCIAL_LINES, resolveCommercialLine } from './domain/productGrouping'
import type { CommercialLine } from './domain/productGrouping'

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kpiCurrency = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `R$ ${brl(n)}`
}
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }

const MOVE_LABEL: Record<string, string> = {
  venda_faturada: 'Faturado',
  a_faturar: 'A faturar',
  devolucao: 'Devolução',
  bonificacao: 'Bonificação',
  corte: 'Corte',
  entrada: 'Entrada',
}

const MOVE_BADGE: Record<string, string> = {
  venda_faturada: 'so-badge-fat',
  a_faturar: 'so-badge-afat',
  devolucao: 'so-badge-dev',
  bonificacao: 'so-badge-bon',
  corte: 'so-badge-corte',
  entrada: 'so-badge-ent',
}

const LINE_COLOR: Partial<Record<CommercialLine, string>> = {
  'Creme Dental': 'var(--blue)',
  'Esc + Enx + Fio': '#10b981',
  'Sabonetes': '#f59e0b',
  'Hair': '#a78bfa',
  'Limpeza': '#64748b',
}

function readStoredNumber(key: string): number | null {
  try { const v = localStorage.getItem(key); return v !== null ? parseFloat(v) : null }
  catch { return null }
}

function KpiCard({ label, value, accent, sub, percent, pctLabel }: {
  label: string; value: string; accent?: 'blue' | 'red' | 'white'; sub?: string;
  percent?: number; pctLabel?: string
}) {
  const r = 10, cx = 14, cy = 14, size = 28
  const circ = 2 * Math.PI * r
  const filled = percent !== undefined ? (Math.min(100, Math.max(0, percent)) / 100) * circ : 0
  const ringColor = accent === 'blue' ? 'var(--blue)' : accent === 'red' ? 'var(--red)' : accent === 'white' ? 'var(--white)' : 'var(--muted)'
  const showRing = percent !== undefined
  const showSub = !!(pctLabel ?? sub)
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {(showRing || showSub) && (
          <div className="kpi-ring-row">
            {showRing && (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="kpi-ring-svg" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringColor} strokeWidth={2.5}
                  strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
              </svg>
            )}
            {showSub && <span className="kpi-pct">{pctLabel ?? sub}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function SellOutTab({ movementBase, productBase }: {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
}) {
  const [moveTypeFilter, setMoveTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [selectedDay, setSelectedDay] = useState('')
  const [selloutMeta, setSelloutMeta] = useState<number | null>(() => readStoredNumber('rj-sellout-meta'))
  const [positivMeta, setPositivMeta] = useState<number | null>(() => readStoredNumber('rj-positiv-meta'))

  useEffect(() => {
    const onSellout = () => setSelloutMeta(readStoredNumber('rj-sellout-meta'))
    const onPositiv = () => setPositivMeta(readStoredNumber('rj-positiv-meta'))
    window.addEventListener('rj-sellout-meta-changed', onSellout)
    window.addEventListener('rj-positiv-meta-changed', onPositiv)
    return () => {
      window.removeEventListener('rj-sellout-meta-changed', onSellout)
      window.removeEventListener('rj-positiv-meta-changed', onPositiv)
    }
  }, [])

  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    const now = new Date()
    return {
      monthStart: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      monthEnd: now.toISOString().slice(0, 10),
      monthLabel: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase(),
    }
  }, [])

  const productByCode = useMemo(() => {
    const m = new Map<string, CanonicalProduct>()
    for (const p of productBase) {
      if (p.internalCode) m.set(p.internalCode, p)
      if (p.manufacturerCode) m.set(p.manufacturerCode, p)
    }
    return m
  }, [productBase])

  const monthBase = useMemo(() =>
    movementBase.filter(m => { const d = m.movementDate ?? ''; return d >= monthStart && d <= monthEnd })
  , [movementBase, monthStart, monthEnd])

  const kpis = useMemo(() => {
    let faturado = 0, aFaturar = 0, devolucao = 0, bonificacao = 0, cortesCount = 0
    const clientesFat = new Set<string>()
    const pedidosFat = new Set<string>()
    for (const m of monthBase) {
      switch (m.movementType) {
        case 'venda_faturada':
          faturado += m.value ?? 0
          if (m.customerCode) clientesFat.add(m.customerCode)
          if (m.orderId) pedidosFat.add(m.orderId)
          break
        case 'a_faturar': aFaturar += m.value ?? 0; break
        case 'devolucao': devolucao += m.value ?? 0; break
        case 'bonificacao': bonificacao += m.value ?? 0; break
        case 'corte': cortesCount++; break
      }
    }
    return {
      faturado, aFaturar, devolucao, bonificacao, cortesCount,
      positivacoes: clientesFat.size,
      pedidos: pedidosFat.size,
      ticketMedio: pedidosFat.size > 0 ? faturado / pedidosFat.size : null,
    }
  }, [monthBase])

  const chartDays = useMemo(() => {
    const byDay = new Map<string, { fat: number; afat: number }>()
    for (const m of monthBase) {
      const day = m.movementDate ?? ''; if (!day) continue
      const cur = byDay.get(day) ?? { fat: 0, afat: 0 }
      if (m.movementType === 'venda_faturada') cur.fat += m.value ?? 0
      else if (m.movementType === 'a_faturar') cur.afat += m.value ?? 0
      byDay.set(day, cur)
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }))
  }, [monthBase])

  const availableDays = useMemo(() => chartDays.map(d => d.date), [chartDays])

  const effectiveDay = useMemo(() => {
    if (selectedDay && availableDays.includes(selectedDay)) return selectedDay
    return availableDays[availableDays.length - 1] ?? ''
  }, [selectedDay, availableDays])

  const dayIdx = availableDays.indexOf(effectiveDay)

  function selectDay(day: string) {
    setSelectedDay(day)
    setExpandedDays(prev => { const n = new Set(prev); n.add(day); return n })
  }
  function stepDay(delta: number) {
    const next = availableDays[dayIdx + delta]
    if (next) selectDay(next)
  }
  function toggleDay(day: string) {
    setExpandedDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })
  }

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const mv = monthBase.filter(m => {
      if (moveTypeFilter !== 'all' && m.movementType !== moveTypeFilter) return false
      if (q && !((m.customerName ?? '').toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.productCode ?? '').toLowerCase().includes(q) ||
        (m.orderId ?? '').includes(q) ||
        (m.customerCode ?? '').includes(q))) return false
      return true
    })
    const byDay = new Map<string, CanonicalMovement[]>()
    for (const m of mv) {
      const day = m.movementDate ?? '_'
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(m)
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [monthBase, search, moveTypeFilter])

  const lineKpis = useMemo(() => {
    const lineMap = new Map<CommercialLine, { fat: number; afat: number; pos: Set<string> }>()
    for (const m of monthBase) {
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      const p = m.productCode ? productByCode.get(m.productCode) : undefined
      const line = p ? resolveCommercialLine(p) : null
      if (!line) continue
      if (!lineMap.has(line)) lineMap.set(line, { fat: 0, afat: 0, pos: new Set() })
      const e = lineMap.get(line)!
      if (m.movementType === 'venda_faturada') { e.fat += m.value ?? 0; if (m.customerCode) e.pos.add(m.customerCode) }
      else e.afat += m.value ?? 0
    }
    const totalFat = Array.from(lineMap.values()).reduce((s, v) => s + v.fat, 0)
    return COMMERCIAL_LINES
      .map(line => {
        const d = lineMap.get(line)
        if (!d || d.fat + d.afat === 0) return null
        return { line, fat: d.fat, afat: d.afat, pos: d.pos.size, pct: totalFat > 0 ? d.fat / totalFat : 0 }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.fat - a.fat)
  }, [monthBase, productByCode])

  if (!movementBase.length) {
    return (
      <>
        <header className="topbar stock-topbar" aria-label="Sell out" />
        <section className="content">
          <div className="so-empty">
            <p>Nenhuma movimentação importada ainda.</p>
            <small>Importe o relatório de vendas na aba <strong>Administração</strong> para visualizar o sell out.</small>
          </div>
        </section>
      </>
    )
  }

  const CHART_W = 540, CHART_H = 160
  const PAD = { l: 50, r: 8, t: 8, b: 28 }
  const innerW = CHART_W - PAD.l - PAD.r
  const n = chartDays.length
  const barSlot = n > 0 ? innerW / n : innerW
  const barW = Math.max(2, barSlot * 0.7)
  const maxVal = Math.max(...chartDays.map(d => d.fat + d.afat), 1)
  const showEvery = n <= 14 ? 1 : n <= 21 ? 2 : Math.ceil(n / 15)

  const faturadoPct = selloutMeta ? Math.round((kpis.faturado / selloutMeta) * 100) : undefined
  const positivPct = positivMeta ? Math.round((kpis.positivacoes / positivMeta) * 100) : undefined
  const aFaturarPct = (kpis.faturado + kpis.aFaturar) > 0
    ? Math.round((kpis.aFaturar / (kpis.faturado + kpis.aFaturar)) * 100)
    : undefined

  return (
    <>
      <header className="topbar stock-topbar" aria-label="Sell out">
        <span className="so-month-label">{monthLabel}</span>
      </header>

      <section className="content">
        {/* KPIs — mesma estrutura do StockTab */}
        <div className="stock-kpis">
          <KpiCard
            label="Faturado" value={kpiCurrency(kpis.faturado)} accent="blue"
            percent={faturadoPct}
            pctLabel={faturadoPct !== undefined ? `${faturadoPct}% da meta` : 'Meta não definida'}
          />
          <KpiCard
            label="A faturar" value={kpiCurrency(kpis.aFaturar)}
            percent={aFaturarPct}
            pctLabel={aFaturarPct !== undefined ? `${aFaturarPct}% do total` : undefined}
          />
          <KpiCard
            label="Positivações" value={kpis.positivacoes.toLocaleString('pt-BR')}
            percent={positivPct}
            pctLabel={positivPct !== undefined ? `${positivPct}% da meta` : undefined}
            sub={`${kpis.pedidos.toLocaleString('pt-BR')} pedidos`}
          />
          {kpis.ticketMedio != null && (
            <KpiCard label="Ticket médio" value={kpiCurrency(kpis.ticketMedio)} />
          )}
          <KpiCard
            label="Devoluções" value={kpiCurrency(kpis.devolucao)}
            accent={kpis.devolucao > 0 ? 'red' : undefined}
          />
          {kpis.bonificacao > 0 && <KpiCard label="Bonificações" value={kpiCurrency(kpis.bonificacao)} />}
          <KpiCard
            label="Cortes" value={kpis.cortesCount.toLocaleString('pt-BR')}
            accent={kpis.cortesCount > 0 ? 'white' : undefined}
          />
        </div>

        {/* Gráfico + Tabela lado a lado */}
        {chartDays.length > 0 && (
          <div className="so-main-grid">
            {/* Gráfico de barras — mês completo, clicável */}
            <div className="notas-section" style={{ marginBottom: 0 }}>
              <div className="notas-section-head">
                <span className="notas-section-title">{monthLabel} · {n} {n === 1 ? 'dia' : 'dias'}</span>
                <span className="so-legend">
                  <span className="so-legend-dot" style={{ background: 'var(--blue)' }} />Faturado
                  <span className="so-legend-dot" style={{ background: 'var(--muted)', marginLeft: 10 }} />A faturar
                </span>
              </div>
              <div style={{ padding: '12px 12px 8px', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${CHART_W} ${CHART_H + PAD.t + PAD.b}`}
                  width="100%"
                  style={{ display: 'block', cursor: 'pointer', minWidth: Math.max(200, n * 12) }}
                  onClick={e => {
                    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
                    const px = ((e.clientX - rect.left) / rect.width) * CHART_W
                    const idx = Math.floor((px - PAD.l) / barSlot)
                    if (idx >= 0 && idx < chartDays.length) selectDay(chartDays[idx].date)
                  }}
                >
                  {[0, 0.25, 0.5, 0.75, 1].map(p => {
                    const y = PAD.t + CHART_H * (1 - p)
                    return (
                      <g key={p}>
                        <line x1={PAD.l} y1={y} x2={CHART_W - PAD.r} y2={y} stroke="var(--border)" strokeWidth={0.8} />
                        {p > 0 && (
                          <text x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">
                            {kpiCurrency(maxVal * p)}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  {chartDays.map((d, i) => {
                    const cx = PAD.l + (i + 0.5) * barSlot
                    const x = cx - barW / 2
                    const totalH = ((d.fat + d.afat) / maxVal) * CHART_H
                    const fatH = (d.fat / maxVal) * CHART_H
                    const afatH = totalH - fatH
                    const isSel = d.date === effectiveDay
                    const showLabel = i % showEvery === 0
                    return (
                      <g key={d.date}>
                        {isSel && (
                          <rect x={cx - barSlot / 2} y={PAD.t} width={barSlot} height={CHART_H}
                            fill="var(--blue)" opacity={0.07} />
                        )}
                        {afatH > 0.5 && (
                          <rect x={x} y={PAD.t + CHART_H - totalH} width={barW} height={afatH}
                            fill="var(--muted)" opacity={isSel ? 0.7 : 0.4} rx={2} />
                        )}
                        {fatH > 0.5 && (
                          <rect x={x} y={PAD.t + CHART_H - fatH} width={barW} height={fatH}
                            fill="var(--blue)" opacity={isSel ? 1 : 0.7} rx={2} />
                        )}
                        {showLabel && (
                          <text x={cx} y={PAD.t + CHART_H + 18} textAnchor="middle" fontSize={9}
                            fill={isSel ? 'var(--text)' : 'var(--muted)'}
                            fontWeight={isSel ? 800 : 400}
                            fontFamily="Space Grotesk, sans-serif">
                            {fmtDay(d.date)}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* Tabela de movimentações por dia — colapsável, com navegação */}
            <div className="notas-section" style={{ marginBottom: 0 }}>
              <div className="notas-section-head" style={{ flexWrap: 'wrap', gap: 6 }}>
                <button type="button" className="so-day-arrow" onClick={() => stepDay(-1)} disabled={dayIdx <= 0}>‹</button>
                <span className="notas-section-title" style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                  {effectiveDay ? fmtDay(effectiveDay) : '—'}
                </span>
                <button type="button" className="so-day-arrow" onClick={() => stepDay(1)} disabled={dayIdx >= availableDays.length - 1}>›</button>
                <select className="notas-cart-date" value={moveTypeFilter} onChange={e => setMoveTypeFilter(e.target.value)}>
                  <option value="all">Todos os tipos</option>
                  <option value="venda_faturada">Faturado</option>
                  <option value="a_faturar">A faturar</option>
                  <option value="devolucao">Devolução</option>
                  <option value="bonificacao">Bonificação</option>
                  <option value="corte">Corte</option>
                </select>
                <input
                  className="notas-cart-date"
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: 110 }}
                />
              </div>
              <div className="notas-section-body" style={{ maxHeight: 'clamp(260px, 42vh, 400px)' }}>
                {tableRows.length === 0 ? (
                  <p className="empty compact" style={{ padding: '24px 18px' }}>Nenhuma movimentação encontrada.</p>
                ) : tableRows.map(([day, mvs]) => {
                  const isOpen = expandedDays.has(day) || day === effectiveDay
                  const isSel = day === effectiveDay
                  const dayFat = mvs.reduce((s, m) => s + (m.movementType === 'venda_faturada' ? (m.value ?? 0) : 0), 0)
                  const dayAfat = mvs.reduce((s, m) => s + (m.movementType === 'a_faturar' ? (m.value ?? 0) : 0), 0)
                  return (
                    <div className={`notas-day-group${isSel ? ' so-day-selected' : ''}`} key={day}>
                      <div className="notas-inv-row" onClick={() => toggleDay(day)}>
                        <span className={`notas-inv-toggle${isOpen ? ' open' : ''}`}>▶</span>
                        <span className="notas-inv-num">{day !== '_' ? fmtDay(day) : '—'}</span>
                        <span className="notas-inv-supplier">{mvs.length.toLocaleString('pt-BR')} movim.</span>
                        {dayAfat > 0 && <span className="notas-inv-qty">+{kpiCurrency(dayAfat)}</span>}
                        <span className="notas-inv-val">{kpiCurrency(dayFat)}</span>
                      </div>
                      {isOpen && (
                        <div className="notas-inv-items">
                          <table className="notas-items-table">
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Produto</th>
                                <th className="n-right">Qtd</th>
                                <th className="n-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mvs.map((m, idx) => (
                                <tr key={m.id ?? idx}>
                                  <td><span className={`so-badge ${MOVE_BADGE[m.movementType] ?? ''}`}>{MOVE_LABEL[m.movementType] ?? m.movementType}</span></td>
                                  <td style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12 }}>{m.orderId ?? '—'}</td>
                                  <td className="so-td-clip">{m.customerName ?? m.customerCode ?? '—'}</td>
                                  <td className="so-td-clip">{m.description ?? m.productCode ?? '—'}</td>
                                  <td className="n-right">{m.quantity?.toLocaleString('pt-BR') ?? '—'}</td>
                                  <td className="n-right" style={{ color: m.movementType === 'devolucao' ? 'var(--red)' : m.movementType === 'venda_faturada' ? 'var(--blue)' : 'var(--text)' }}>
                                    {m.value != null ? kpiCurrency(m.value) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Linhas comerciais — grid de cards */}
        {lineKpis.length > 0 && (
          <div className="notas-section so-lines-section" style={{ marginBottom: 24 }}>
            <div className="notas-section-head">
              <span className="notas-section-title">Linhas comerciais · {monthLabel}</span>
            </div>
            <div className="so-lines-grid">
              {lineKpis.map((row, i) => (
                <div
                  key={row.line}
                  className="so-line-card"
                  style={{ '--line-color': LINE_COLOR[row.line] ?? '#64748b' } as React.CSSProperties}
                >
                  <div className="so-line-card-rank">#{i + 1}</div>
                  <div className="so-line-card-name">{row.line}</div>
                  <div className="so-line-card-value">{kpiCurrency(row.fat)}</div>
                  <div className="so-line-card-bar-wrap">
                    <div className="so-line-card-bar" style={{ width: `${(row.pct * 100).toFixed(1)}%` }} />
                  </div>
                  <div className="so-line-card-meta">
                    <span className="so-line-card-pct">{(row.pct * 100).toFixed(1)}%</span>
                    <span className="so-line-card-pos">{row.pos.toLocaleString('pt-BR')} pos.</span>
                    {row.afat > 0 && <span className="so-line-card-afat">+{kpiCurrency(row.afat)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
