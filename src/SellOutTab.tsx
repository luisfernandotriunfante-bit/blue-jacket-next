import { useState, useMemo, useEffect } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalProduct } from './domain/productMotor'
import { COMMERCIAL_LINES, resolveCommercialLine } from './domain/productGrouping'
import type { CommercialLine } from './domain/productGrouping'

/* ── formatters ─────────────────────────────────────────── */
const brlFull = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

/* ── constants ──────────────────────────────────────────── */
const WINDOW = 10
const LINE_COLOR: Partial<Record<CommercialLine, string>> = {
  'Creme Dental': 'var(--blue)', 'Esc + Enx + Fio': '#10b981',
  'Sabonetes': '#f59e0b', 'Hair': '#a78bfa', 'Limpeza': '#64748b',
}
const MOV_LABEL: Partial<Record<string, string>> = {
  venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução',
  bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada',
}

/* ── localStorage helper ────────────────────────────────── */
function readNum(key: string): number | null {
  try { const v = localStorage.getItem(key); return v !== null ? parseFloat(v) : null }
  catch { return null }
}

/* ── TwoSegmentDonut ─────────────────────────────────────
   Donut com dois segmentos (A = azul, B = vermelho) sobre
   uma trilha que representa a meta. Se não há meta, usa
   A+B como 100% e mostra a proporção entre os segmentos.
─────────────────────────────────────────────────────────── */
function TwoSegmentDonut({ label, segA, segALabel, segAVal, segB, segBLabel, segBVal, meta, metaLabel }: {
  label: string
  segA: number; segALabel: string; segAVal: string
  segB: number; segBLabel: string; segBVal: string
  meta: number | null; metaLabel: string
}) {
  const denominator = meta ?? (segA + segB) || 1
  const r = 54, cx = 66, cy = 66, circ = 2 * Math.PI * r
  const clampA = Math.min(segA / denominator, 1)
  const clampAB = Math.min((segA + segB) / denominator, 1)
  const gap = 4
  const arcA = Math.max(0, clampA * circ - gap)
  const arcB = Math.max(0, (clampAB - clampA) * circ - gap)
  const hasData = segA + segB > 0
  const pctA = Math.round(clampA * 100)
  const pctB = Math.round((clampAB - clampA) * 100)

  return (
    <div className="so-hero-card so-hero-card-lg">
      <div className="so-hero-label">{label}</div>
      <div className="so-hero-svg-wrap-lg">
        <svg viewBox="0 0 132 132">
          {/* trilha (meta) */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={13} />
          {hasData && (
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {arcA > 0 && (
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--blue)" strokeWidth={13}
                  strokeDasharray={`${arcA} ${circ}`} strokeLinecap="round" />
              )}
              {arcB > 0 && (
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--red)" strokeWidth={13}
                  strokeDasharray={`${arcB} ${circ}`} strokeDashoffset={-(clampA * circ)}
                  strokeLinecap="round" />
              )}
            </g>
          )}
          {/* texto central */}
          {hasData
            ? <>
                <text x={cx} y={cy - 10} textAnchor="middle" fontSize={22} fontWeight={800}
                  fill="var(--blue)" fontFamily="Space Grotesk, sans-serif">{pctA}%</text>
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize={10} fill="var(--muted)"
                  fontFamily="Space Grotesk, sans-serif">faturado</text>
                {meta !== null && pctB > 0 && (
                  <text x={cx} y={cy + 20} textAnchor="middle" fontSize={10} fontWeight={700}
                    fill="var(--red)" fontFamily="Space Grotesk, sans-serif">+{pctB}%</text>
                )}
              </>
            : <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="var(--muted)"
                fontFamily="Space Grotesk, sans-serif">sem dados</text>
          }
        </svg>
      </div>

      {/* legenda de valores */}
      <div className="so-hero-info">
        <div className="so-hero-info-row">
          <span className="so-hero-info-dot" style={{ background: 'var(--blue)' }} />
          <span className="so-hero-info-key">{segALabel}</span>
          <span className="so-hero-info-val" style={{ color: 'var(--blue)' }}>{segAVal}</span>
        </div>
        <div className="so-hero-info-row">
          <span className="so-hero-info-dot" style={{ background: 'var(--red)' }} />
          <span className="so-hero-info-key">{segBLabel}</span>
          <span className="so-hero-info-val" style={{ color: 'var(--red)' }}>{segBVal}</span>
        </div>
        <div className="so-hero-info-divider" />
        {meta !== null
          ? <div className="so-hero-info-row so-hero-info-meta">
              <span className="so-hero-info-key">meta</span>
              <span className="so-hero-info-val">{metaLabel}</span>
            </div>
          : <div className="so-hero-no-meta">definir em Configurações</div>
        }
      </div>
    </div>
  )
}

/* ── KpiCard ─────────────────────────────────────────────── */
function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: 'blue' | 'red' | 'white'; sub?: string }) {
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {sub && <div className="kpi-ring-row"><span className="kpi-pct">{sub}</span></div>}
      </div>
    </div>
  )
}

/* ── SVG path helpers ────────────────────────────────────── */
function linePath(vals: number[], xFn: (i: number) => number, yFn: (v: number) => number) {
  return vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFn(i).toFixed(1)} ${yFn(v).toFixed(1)}`).join(' ')
}
function areaPath(vals: number[], xFn: (i: number) => number, yFn: (v: number) => number, yBase: number) {
  if (vals.length === 0) return ''
  const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFn(i).toFixed(1)} ${yFn(v).toFixed(1)}`).join(' ')
  const n = vals.length
  return `${pts} L ${xFn(n - 1).toFixed(1)} ${yBase.toFixed(1)} L ${xFn(0).toFixed(1)} ${yBase.toFixed(1)} Z`
}

/* ── SellOutTab ─────────────────────────────────────────── */
export function SellOutTab({ movementBase, productBase }: {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
}) {
  const [windowOffset, setWindowOffset] = useState(0)
  const [compact, setCompact] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selloutMeta, setSelloutMeta] = useState<number | null>(() => readNum('rj-sellout-meta'))
  const [positivMeta, setPositivMeta] = useState<number | null>(() => readNum('rj-positiv-meta'))

  useEffect(() => {
    const a = () => setSelloutMeta(readNum('rj-sellout-meta'))
    const b = () => setPositivMeta(readNum('rj-positiv-meta'))
    window.addEventListener('rj-sellout-meta-changed', a)
    window.addEventListener('rj-positiv-meta-changed', b)
    return () => {
      window.removeEventListener('rj-sellout-meta-changed', a)
      window.removeEventListener('rj-positiv-meta-changed', b)
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
    let fat = 0, afat = 0, dev = 0, bon = 0, cortes = 0
    const cFat = new Set<string>(), cTot = new Set<string>(), ped = new Set<string>()
    for (const m of monthBase) {
      switch (m.movementType) {
        case 'venda_faturada':
          fat += m.value ?? 0
          if (m.customerCode) { cFat.add(m.customerCode); cTot.add(m.customerCode) }
          if (m.orderId) ped.add(m.orderId)
          break
        case 'a_faturar': afat += m.value ?? 0; if (m.customerCode) cTot.add(m.customerCode); break
        case 'devolucao': dev += m.value ?? 0; break
        case 'bonificacao': bon += m.value ?? 0; break
        case 'corte': cortes++; break
      }
    }
    return { fat, afat, dev, bon, cortes, posFat: cFat.size, posTotal: cTot.size, pedidos: ped.size, ticket: ped.size > 0 ? fat / ped.size : null }
  }, [monthBase])

  const allDays = useMemo(() => {
    const map = new Map<string, { fat: number; afat: number; cFat: Set<string>; cTot: Set<string> }>()
    for (const m of monthBase) {
      const day = m.movementDate ?? ''; if (!day) continue
      if (!map.has(day)) map.set(day, { fat: 0, afat: 0, cFat: new Set(), cTot: new Set() })
      const e = map.get(day)!
      if (m.movementType === 'venda_faturada') {
        e.fat += m.value ?? 0
        if (m.customerCode) { e.cFat.add(m.customerCode); e.cTot.add(m.customerCode) }
      } else if (m.movementType === 'a_faturar') {
        e.afat += m.value ?? 0
        if (m.customerCode) e.cTot.add(m.customerCode)
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date, fat: d.fat, afat: d.afat, sellOut: d.fat + d.afat, posFat: d.cFat.size, posTotal: d.cTot.size,
    }))
  }, [monthBase])

  const maxOffset = Math.max(0, allDays.length - WINDOW)
  const clampedOffset = Math.min(windowOffset, maxOffset)
  const windowDays = useMemo(() => {
    const end = Math.max(0, allDays.length - 1 - clampedOffset)
    const start = Math.max(0, end - WINDOW + 1)
    return allDays.slice(start, end + 1)
  }, [allDays, clampedOffset])

  const winStart = windowDays[0]?.date ?? ''
  const winEnd = windowDays[windowDays.length - 1]?.date ?? ''

  const winTotals = useMemo(() => windowDays.reduce(
    (acc, d) => ({ sellOut: acc.sellOut + d.sellOut, fat: acc.fat + d.fat, afat: acc.afat + d.afat, posFat: acc.posFat + d.posFat, posTotal: acc.posTotal + d.posTotal }),
    { sellOut: 0, fat: 0, afat: 0, posFat: 0, posTotal: 0 }
  ), [windowDays])

  const lineKpis = useMemo(() => {
    const map = new Map<CommercialLine, { fat: number; afat: number; pos: Set<string> }>()
    for (const m of monthBase) {
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      const p = m.productCode ? productByCode.get(m.productCode) : undefined
      const line = p ? resolveCommercialLine(p) : null
      if (!line) continue
      if (!map.has(line)) map.set(line, { fat: 0, afat: 0, pos: new Set() })
      const e = map.get(line)!
      if (m.movementType === 'venda_faturada') { e.fat += m.value ?? 0; if (m.customerCode) e.pos.add(m.customerCode) }
      else e.afat += m.value ?? 0
    }
    const totalFat = Array.from(map.values()).reduce((s, v) => s + v.fat, 0)
    return COMMERCIAL_LINES
      .map(line => { const d = map.get(line); if (!d || d.fat + d.afat === 0) return null; return { line, fat: d.fat, afat: d.afat, pos: d.pos.size, pct: totalFat > 0 ? d.fat / totalFat : 0 } })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.fat - a.fat)
  }, [monthBase, productByCode])

  const selectedDayMovements = useMemo(() => {
    if (!selectedDay) return []
    return monthBase
      .filter(m => m.movementDate === selectedDay)
      .sort((a, b) => {
        const order: Record<string, number> = { venda_faturada: 0, a_faturar: 1, devolucao: 2, bonificacao: 3, corte: 4, entrada: 5 }
        return (order[a.movementType] ?? 9) - (order[b.movementType] ?? 9)
      })
  }, [monthBase, selectedDay])

  if (!movementBase.length) {
    return (
      <>
        <header className="topbar stock-topbar" aria-label="Sell out" />
        <section className="content"><div className="so-empty"><p>Nenhuma movimentação importada ainda.</p><small>Importe na aba <strong>Administração</strong>.</small></div></section>
      </>
    )
  }

  // Geometria dos gráficos
  const W = 560, H_FIN = 170, H_POS = 130, PAD = { l: 62, r: 14, t: 12, b: 28 }
  const iW = W - PAD.l - PAD.r
  const n = windowDays.length
  const xFn = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * iW : iW / 2)

  const finVals = windowDays.flatMap(d => [d.sellOut, d.fat, d.afat])
  const maxFin = Math.max(...finVals, 0.01), minFin = Math.min(...finVals, 0)
  const ranFin = maxFin - minFin || 1, iHF = H_FIN - PAD.t - PAD.b
  const yFin = (v: number) => PAD.t + iHF - ((v - minFin) / ranFin) * iHF
  const yBaseFin = yFin(Math.max(0, minFin))

  const maxPos = Math.max(...windowDays.map(d => d.posTotal), 0.01), iHP = H_POS - PAD.t - PAD.b
  const yPos = (v: number) => PAD.t + iHP * (1 - v / maxPos)
  const yBasePos = PAD.t + iHP

  return (
    <>
      <header className="topbar stock-topbar" aria-label="Sell out">
        <span className="so-month-label">{monthLabel}</span>
      </header>

      <section className="content">
        {/* ── 2 hero donuts ───────────────────────────────── */}
        <div className="so-hero-row">
          <TwoSegmentDonut
            label="Sell Out — Faturamento"
            segA={kpis.fat}      segALabel="Faturado"   segAVal={kpiCurrency(kpis.fat)}
            segB={kpis.afat}     segBLabel="A faturar"  segBVal={kpiCurrency(kpis.afat)}
            meta={selloutMeta}   metaLabel={selloutMeta ? kpiCurrency(selloutMeta) : '—'}
          />
          <TwoSegmentDonut
            label="Positivações"
            segA={kpis.posFat}               segALabel="Faturadas"  segAVal={fmtNum(kpis.posFat)}
            segB={kpis.posTotal - kpis.posFat} segBLabel="A faturar"  segBVal={fmtNum(kpis.posTotal - kpis.posFat)}
            meta={positivMeta}               metaLabel={positivMeta ? fmtNum(positivMeta) : '—'}
          />
        </div>

        {/* ── KPIs secundários ─────────────────────────────── */}
        <div className="stock-kpis" style={{ marginBottom: 16 }}>
          {kpis.ticket != null && <KpiCard label="Ticket médio" value={kpiCurrency(kpis.ticket)} sub={`${fmtNum(kpis.pedidos)} pedidos`} />}
          <KpiCard label="Devoluções" value={kpiCurrency(kpis.dev)} accent={kpis.dev > 0 ? 'red' : undefined} />
          {kpis.bon > 0 && <KpiCard label="Bonificações" value={kpiCurrency(kpis.bon)} />}
          <KpiCard label="Cortes" value={fmtNum(kpis.cortes)} accent={kpis.cortes > 0 ? 'white' : undefined} />
        </div>

        {/* ── Fechamento diário ────────────────────────────── */}
        {allDays.length > 0 && (
          <div className="notas-section so-detail-section" style={{ maxHeight: 'none', marginBottom: 20 }}>
            <div className="so-window-bar">
              <div className="so-window-info">
                <span className="so-window-tag">JANELA SINCRONIZADA · {WINDOW} DIAS</span>
                {winStart && <span className="so-window-range">{fmtDay(winStart)} — {fmtDay(winEnd)}</span>}
              </div>
              <div className="so-window-nav">
                <button type="button" className="so-nav-btn"
                  onClick={() => setWindowOffset(o => Math.min(maxOffset, o + 1))}
                  disabled={clampedOffset >= maxOffset}>‹</button>
                <button type="button"
                  className={`so-nav-btn so-nav-atual${clampedOffset === 0 ? ' active' : ''}`}
                  onClick={() => setWindowOffset(0)}>Atual</button>
                <button type="button" className="so-nav-btn"
                  onClick={() => setWindowOffset(o => Math.max(0, o - 1))}
                  disabled={clampedOffset <= 0}>›</button>
              </div>
            </div>

            <div className="so-detail-grid">
              {/* gráficos */}
              <div className="so-charts-col">
                <div className="so-chart-block">
                  <div className="so-chart-head">
                    <div>
                      <div className="so-chart-tag">MOVIMENTO FINANCEIRO</div>
                      <div className="so-chart-title">Sell Out diário</div>
                    </div>
                    <div className="so-chart-legend">
                      <span className="so-leg-item"><span className="so-leg-line" style={{ background: 'var(--text)' }} />Sell Out</span>
                      <span className="so-leg-item"><span className="so-leg-line" style={{ background: 'var(--blue)' }} />Faturado</span>
                      <span className="so-leg-item"><span className="so-leg-line so-leg-dash" style={{ background: 'var(--red)' }} />A Faturar</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H_FIN + PAD.t + PAD.b}`} width="100%"
                      style={{ display: 'block', minWidth: Math.max(260, n * 38) }}>
                      <defs>
                        <linearGradient id="gso" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--text)" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gfat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 0.25, 0.5, 0.75, 1].map(p => {
                        const v = minFin + ranFin * p, yv = yFin(v)
                        return (
                          <g key={p}>
                            <line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke="var(--border)" strokeWidth={0.7} />
                            <text x={PAD.l - 5} y={yv + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{kpiCurrency(v)}</text>
                          </g>
                        )
                      })}
                      {minFin < 0 && <line x1={PAD.l} y1={yBaseFin} x2={W - PAD.r} y2={yBaseFin} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 2" />}
                      {n > 0 && <path d={areaPath(windowDays.map(d => d.fat), xFn, yFin, yBaseFin)} fill="url(#gfat)" />}
                      {n > 0 && <path d={areaPath(windowDays.map(d => d.sellOut), xFn, yFin, yBaseFin)} fill="url(#gso)" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.sellOut), xFn, yFin)} fill="none" stroke="var(--text)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.fat), xFn, yFin)} fill="none" stroke="var(--blue)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.afat), xFn, yFin)} fill="none" stroke="var(--red)" strokeWidth={1.8} strokeDasharray="6 3" strokeLinecap="round" />}
                      {n > 0 && (() => {
                        const last = windowDays[n - 1]
                        return <>
                          <circle cx={xFn(n - 1)} cy={yFin(last.sellOut)} r={3.5} fill="var(--text)" />
                          <circle cx={xFn(n - 1)} cy={yFin(last.fat)} r={3.5} fill="var(--blue)" />
                          {last.afat > 0 && <circle cx={xFn(n - 1)} cy={yFin(last.afat)} r={3} fill="var(--red)" />}
                        </>
                      })()}
                      {windowDays.map((d, i) => (
                        <text key={d.date} x={xFn(i)} y={PAD.t + H_FIN + 21} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{fmtDay(d.date)}</text>
                      ))}
                    </svg>
                  </div>
                </div>

                <div className="so-chart-block">
                  <div className="so-chart-head">
                    <div>
                      <div className="so-chart-tag">MOVIMENTO DE POSITIVAÇÃO</div>
                      <div className="so-chart-title">Clientes positivados por dia</div>
                    </div>
                    <div className="so-chart-legend">
                      <span className="so-leg-item"><span className="so-leg-line" style={{ background: 'var(--text)' }} />Pos. total</span>
                      <span className="so-leg-item"><span className="so-leg-line" style={{ background: 'var(--blue)' }} />Pos. faturada</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H_POS + PAD.t + PAD.b}`} width="100%"
                      style={{ display: 'block', minWidth: Math.max(260, n * 38) }}>
                      <defs>
                        <linearGradient id="gpostot" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--text)" stopOpacity="0.14" />
                          <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gposfat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 0.5, 1].map(p => {
                        const v = Math.round(maxPos * p), yv = yPos(v)
                        return (
                          <g key={p}>
                            <line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke="var(--border)" strokeWidth={0.7} />
                            <text x={PAD.l - 5} y={yv + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{v}</text>
                          </g>
                        )
                      })}
                      {n > 0 && <path d={areaPath(windowDays.map(d => d.posTotal), xFn, yPos, yBasePos)} fill="url(#gpostot)" />}
                      {n > 0 && <path d={areaPath(windowDays.map(d => d.posFat), xFn, yPos, yBasePos)} fill="url(#gposfat)" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.posTotal), xFn, yPos)} fill="none" stroke="var(--text)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.posFat), xFn, yPos)} fill="none" stroke="var(--blue)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && (() => {
                        const last = windowDays[n - 1]
                        return <>
                          <circle cx={xFn(n - 1)} cy={yPos(last.posTotal)} r={3.5} fill="var(--text)" />
                          <circle cx={xFn(n - 1)} cy={yPos(last.posFat)} r={3.5} fill="var(--blue)" />
                        </>
                      })()}
                      {windowDays.map((d, i) => (
                        <text key={d.date} x={xFn(i)} y={PAD.t + H_POS + 21} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{fmtDay(d.date)}</text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>

              {/* planilha */}
              <div className="so-table-col">
                <div className="so-table-head">
                  <div>
                    <div className="so-chart-tag">PLANILHA DIÁRIA</div>
                    <div className="so-chart-title">Clique num dia para ver detalhes</div>
                    {winStart && <div className="so-window-sub">{fmtDay(winStart)} — {fmtDay(winEnd)}</div>}
                  </div>
                  <button type="button" className={`so-compact-btn${compact ? ' active' : ''}`}
                    onClick={() => setCompact(v => !v)}>
                    {compact ? 'Expandir' : 'Compactar'}
                  </button>
                </div>
                <div className="so-table-wrap">
                  <table className="so-daily-table">
                    {!compact && (
                      <thead>
                        <tr>
                          <th>DATA</th>
                          <th className="n-right">SELL OUT</th>
                          <th className="n-right">FATURADO</th>
                          <th className="n-right">A FATURAR</th>
                          <th className="n-right">P.FAT</th>
                          <th className="n-right">P.TOT</th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {[...windowDays].reverse().map(d => (
                        <tr key={d.date}
                          className={`so-dt-row${selectedDay === d.date ? ' so-dt-selected' : ''}`}
                          onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}>
                          <td className="so-dt-date">{fmtDay(d.date)}</td>
                          <td className={`n-right so-dt-sellout${d.sellOut < 0 ? ' neg' : ''}`}>
                            {compact ? kpiCurrency(d.sellOut) : brlFull(d.sellOut)}
                          </td>
                          {!compact && <>
                            <td className="n-right so-dt-fat" style={{ color: d.fat > 0 ? 'var(--blue)' : 'var(--muted)' }}>{brlFull(d.fat)}</td>
                            <td className="n-right so-dt-afat" style={{ color: d.afat > 0 ? 'var(--red)' : 'var(--muted)' }}>{brlFull(d.afat)}</td>
                            <td className={`n-right so-dt-pos${d.posFat > 0 ? ' pos-active' : ''}`}>{d.posFat}</td>
                            <td className={`n-right so-dt-pos${d.posTotal > 0 ? ' pos-total' : ''}`}>{d.posTotal}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="so-win-totals">
                  <div className="so-win-total-item">
                    <div className="so-win-total-label">SELL OUT ACUMULADO</div>
                    <div className="so-win-total-val">{brlFull(winTotals.sellOut)}</div>
                  </div>
                  <div className="so-win-total-item">
                    <div className="so-win-total-label">POSITIVADOS ACUMULADOS</div>
                    <div className="so-win-total-val">{winTotals.posTotal}</div>
                  </div>
                  <div className="so-win-total-item">
                    <div className="so-win-total-label">POS. FATURADA</div>
                    <div className="so-win-total-val">{winTotals.posFat}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* detalhe do dia selecionado */}
            {selectedDay && selectedDayMovements.length > 0 && (
              <div className="so-day-detail">
                <div className="so-day-detail-head">
                  <span className="so-chart-tag">DETALHAMENTO · {fmtDay(selectedDay)}</span>
                  <span className="so-day-detail-count">{selectedDayMovements.length} movimentações</span>
                  <button type="button" className="so-day-detail-close" onClick={() => setSelectedDay(null)}>✕ fechar</button>
                </div>
                <div className="so-day-detail-wrap">
                  <table className="so-day-detail-table">
                    <thead>
                      <tr>
                        <th>TIPO</th><th>CLIENTE</th><th>PRODUTO</th>
                        <th className="n-right">QTD</th><th className="n-right">VALOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayMovements.map((m, i) => (
                        <tr key={i} className={`so-dm-row so-dm-${m.movementType}`}>
                          <td><span className={`so-mov-badge so-mov-${m.movementType}`}>{MOV_LABEL[m.movementType] ?? m.movementType}</span></td>
                          <td className="so-dm-client">{m.customerName ?? m.customerCode ?? '—'}</td>
                          <td className="so-dm-product">{m.description ?? (m.productCode ? productByCode.get(m.productCode)?.description : undefined) ?? m.productCode ?? '—'}</td>
                          <td className="n-right so-dm-qty">{m.quantity != null ? fmtNum(m.quantity) : '—'}</td>
                          <td className="n-right so-dm-value">{m.value != null ? brlFull(m.value) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Linhas comerciais — leaderboard ─────────────── */}
        {lineKpis.length > 0 && (
          <div className="notas-section so-lines-section" style={{ marginBottom: 24 }}>
            <div className="notas-section-head">
              <span className="notas-section-title">Linhas comerciais · {monthLabel}</span>
            </div>
            <div className="so-leaderboard">
              {lineKpis.map((row, i) => {
                const color = LINE_COLOR[row.line] ?? '#64748b'
                return (
                  <div key={row.line} className="so-lb-row">
                    <span className="so-lb-rank">#{i + 1}</span>
                    <span className="so-lb-dot" style={{ background: color }} />
                    <span className="so-lb-name">{row.line}</span>
                    <div className="so-lb-bar-wrap"><div className="so-lb-bar" style={{ width: `${(row.pct * 100).toFixed(1)}%`, background: color }} /></div>
                    <span className="so-lb-value" style={{ color }}>{kpiCurrency(row.fat)}</span>
                    <span className="so-lb-pct">{(row.pct * 100).toFixed(1)}%</span>
                    <span className="so-lb-pos">{fmtNum(row.pos)} pos.</span>
                    {row.afat > 0 && <span className="so-lb-afat">+{kpiCurrency(row.afat)}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
