import { useState, useMemo } from 'react'
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

type Period = '7d' | '30d' | 'all'
const PERIOD_LABEL: Record<Period, string> = { '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', all: 'Tudo' }

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: 'blue' | 'red' | 'white'; sub?: string }) {
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {sub && <div className="kpi-pct" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function SellOutTab({ movementBase, productBase }: {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
}) {
  const [period, setPeriod] = useState<Period>('30d')
  const [moveTypeFilter, setMoveTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const productByCode = useMemo(() => {
    const m = new Map<string, CanonicalProduct>()
    for (const p of productBase) {
      if (p.internalCode) m.set(p.internalCode, p)
      if (p.manufacturerCode) m.set(p.manufacturerCode, p)
    }
    return m
  }, [productBase])

  const cutoff = useMemo(() => {
    if (period === 'all') return ''
    const days = period === '7d' ? 7 : 30
    return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  }, [period])

  const filteredBase = useMemo(() =>
    movementBase.filter(m => !cutoff || (m.movementDate ?? '') >= cutoff)
  , [movementBase, cutoff])

  const kpis = useMemo(() => {
    let faturado = 0, aFaturar = 0, devolucao = 0, bonificacao = 0, cortesCount = 0
    const clientesFat = new Set<string>()
    const pedidosFat = new Set<string>()
    for (const m of filteredBase) {
      switch (m.movementType) {
        case 'venda_faturada':
          faturado += m.value ?? 0
          if (m.customerCode) clientesFat.add(m.customerCode)
          if (m.orderId) pedidosFat.add(m.orderId)
          break
        case 'a_faturar':
          aFaturar += m.value ?? 0
          break
        case 'devolucao':
          devolucao += m.value ?? 0
          break
        case 'bonificacao':
          bonificacao += m.value ?? 0
          break
        case 'corte':
          cortesCount++
          break
      }
    }
    const ticketMedio = pedidosFat.size > 0 ? faturado / pedidosFat.size : null
    return { faturado, aFaturar, devolucao, bonificacao, cortesCount, positivacoes: clientesFat.size, pedidos: pedidosFat.size, ticketMedio }
  }, [filteredBase])

  const chartData = useMemo(() => {
    const byDay = new Map<string, { fat: number; afat: number }>()
    for (const m of filteredBase) {
      const day = m.movementDate ?? ''; if (!day) continue
      const cur = byDay.get(day) ?? { fat: 0, afat: 0 }
      if (m.movementType === 'venda_faturada') cur.fat += m.value ?? 0
      else if (m.movementType === 'a_faturar') cur.afat += m.value ?? 0
      byDay.set(day, cur)
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }))
  }, [filteredBase])

  const lineKpis = useMemo(() => {
    const lineMap = new Map<CommercialLine, { fat: number; afat: number; pos: Set<string> }>()
    for (const m of filteredBase) {
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      const p = m.productCode ? productByCode.get(m.productCode) : undefined
      const line = p ? resolveCommercialLine(p) : null
      if (!line) continue
      if (!lineMap.has(line)) lineMap.set(line, { fat: 0, afat: 0, pos: new Set() })
      const e = lineMap.get(line)!
      if (m.movementType === 'venda_faturada') { e.fat += m.value ?? 0; if (m.customerCode) e.pos.add(m.customerCode) }
      else e.afat += m.value ?? 0
    }
    const total = Array.from(lineMap.values()).reduce((s, v) => s + v.fat, 0)
    return COMMERCIAL_LINES
      .map(line => {
        const d = lineMap.get(line)
        if (!d || d.fat + d.afat === 0) return null
        return { line, fat: d.fat, afat: d.afat, pos: d.pos.size, pct: total > 0 ? d.fat / total : 0 }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.fat - a.fat)
  }, [filteredBase, productByCode])

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const mv = filteredBase.filter(m => {
      if (moveTypeFilter !== 'all' && m.movementType !== moveTypeFilter) return false
      if (q && !((m.customerName ?? '').toLowerCase().includes(q) || (m.description ?? '').toLowerCase().includes(q) || (m.productCode ?? '').toLowerCase().includes(q) || (m.orderId ?? '').includes(q) || (m.customerCode ?? '').includes(q))) return false
      return true
    })
    const byDay = new Map<string, CanonicalMovement[]>()
    for (const m of mv) {
      const day = m.movementDate ?? '_'
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(m)
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredBase, search, moveTypeFilter])

  function toggleDay(day: string) {
    setExpandedDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })
  }

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

  // Chart geometry
  const CHART_W = 1000, CHART_H = 180
  const PAD = { l: 52, r: 12, t: 12, b: 32 }
  const innerW = CHART_W - PAD.l - PAD.r
  const n = chartData.length
  const barSlot = n > 0 ? innerW / n : innerW
  const barW = Math.max(2, barSlot * 0.72)
  const maxVal = Math.max(...chartData.map(d => d.fat + d.afat), 1)
  const showEvery = n <= 14 ? 1 : n <= 31 ? 2 : Math.ceil(n / 20)

  return (
    <>
      <header className="topbar stock-topbar" aria-label="Sell out">
        <div className="so-period-row">
          {(['7d', '30d', 'all'] as Period[]).map(p => (
            <button key={p} type="button" className={`so-period-btn${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>

      <section className="content">
        {/* KPIs */}
        <div className="stock-kpis">
          <KpiCard label="Faturado" value={kpiCurrency(kpis.faturado)} accent="blue" />
          <KpiCard label="A faturar" value={kpiCurrency(kpis.aFaturar)} />
          <KpiCard label="Positivações" value={kpis.positivacoes.toLocaleString('pt-BR')} sub={`${kpis.pedidos.toLocaleString('pt-BR')} pedidos`} />
          {kpis.ticketMedio != null && (
            <KpiCard label="Ticket médio" value={kpiCurrency(kpis.ticketMedio)} />
          )}
          <KpiCard label="Devoluções" value={kpiCurrency(kpis.devolucao)} accent={kpis.devolucao > 0 ? 'red' : undefined} />
          {kpis.bonificacao > 0 && <KpiCard label="Bonificações" value={kpiCurrency(kpis.bonificacao)} />}
          <KpiCard label="Cortes" value={kpis.cortesCount.toLocaleString('pt-BR')} accent={kpis.cortesCount > 0 ? 'white' : undefined} />
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="notas-section" style={{ maxHeight: 'none', marginBottom: 20 }}>
            <div className="notas-section-head">
              <span className="notas-section-title">Faturado por dia · {chartData.length} dias</span>
              <span className="so-legend">
                <span className="so-legend-dot" style={{ background: 'var(--blue)' }} />Faturado
                <span className="so-legend-dot" style={{ background: 'var(--muted)', marginLeft: 12 }} />A faturar
              </span>
            </div>
            <div style={{ padding: '12px 18px 8px', overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H + PAD.t + PAD.b}`}
                width="100%"
                style={{ display: 'block', minWidth: Math.max(320, n * 22) }}
              >
                {[0, 0.25, 0.5, 0.75, 1].map(p => {
                  const y = PAD.t + CHART_H * (1 - p)
                  return (
                    <g key={p}>
                      <line x1={PAD.l} y1={y} x2={CHART_W - PAD.r} y2={y} stroke="var(--border)" strokeWidth={0.8} />
                      {p > 0 && (
                        <text x={PAD.l - 5} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">
                          {kpiCurrency(maxVal * p)}
                        </text>
                      )}
                    </g>
                  )
                })}
                {chartData.map((d, i) => {
                  const cx = PAD.l + (i + 0.5) * barSlot
                  const x = cx - barW / 2
                  const totalH = ((d.fat + d.afat) / maxVal) * CHART_H
                  const fatH = (d.fat / maxVal) * CHART_H
                  const afatH = totalH - fatH
                  const showLabel = i % showEvery === 0
                  return (
                    <g key={d.date}>
                      {afatH > 0.5 && (
                        <rect x={x} y={PAD.t + CHART_H - totalH} width={barW} height={afatH}
                          fill="var(--muted)" opacity={0.45} rx={2} />
                      )}
                      {fatH > 0.5 && (
                        <rect x={x} y={PAD.t + CHART_H - fatH} width={barW} height={fatH}
                          fill="var(--blue)" rx={2} />
                      )}
                      {showLabel && (
                        <text x={cx} y={PAD.t + CHART_H + 20} textAnchor="middle" fontSize={10}
                          fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">
                          {fmtDay(d.date)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Movement table */}
        <div className="notas-section" style={{ maxHeight: 'clamp(300px, 52vh, 620px)', marginBottom: 20 }}>
          <div className="notas-section-head">
            <span className="notas-section-title">Movimentações · {filteredBase.length.toLocaleString('pt-BR')}</span>
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
              placeholder="Buscar cliente, produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
          <div className="notas-section-body">
            {tableRows.length === 0 ? (
              <p className="empty compact" style={{ padding: '24px 18px' }}>Nenhuma movimentação encontrada.</p>
            ) : tableRows.map(([day, mvs]) => {
              const isOpen = expandedDays.has(day)
              const dayFat = mvs.reduce((s, m) => s + (m.movementType === 'venda_faturada' ? (m.value ?? 0) : 0), 0)
              const dayAfat = mvs.reduce((s, m) => s + (m.movementType === 'a_faturar' ? (m.value ?? 0) : 0), 0)
              return (
                <div className="notas-day-group" key={day}>
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

        {/* KPIs por linha */}
        {lineKpis.length > 0 && (
          <div className="notas-section" style={{ maxHeight: 'none', marginBottom: 24 }}>
            <div className="notas-section-head">
              <span className="notas-section-title">Faturado por linha comercial</span>
            </div>
            <div style={{ padding: '6px 0 2px' }}>
              {lineKpis.map(row => (
                <div key={row.line} className="so-line-row">
                  <span className="so-line-name">{row.line}</span>
                  <div className="so-line-bar-wrap">
                    <div className="so-line-bar" style={{ width: `${row.pct * 100}%`, background: LINE_COLOR[row.line] ?? 'var(--muted)' }} />
                  </div>
                  <span className="so-line-pct">{(row.pct * 100).toFixed(1)}%</span>
                  <span className="so-line-val">{kpiCurrency(row.fat)}</span>
                  <span className="so-line-pos">{row.pos.toLocaleString('pt-BR')} pos.</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
