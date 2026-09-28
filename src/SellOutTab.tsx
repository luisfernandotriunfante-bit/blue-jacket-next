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

/* ── localStorage helper ────────────────────────────────── */
function readNum(key: string): number | null {
  try { const v = localStorage.getItem(key); return v !== null ? parseFloat(v) : null }
  catch { return null }
}
function saveNum(key: string, val: number, event: string) {
  try { localStorage.setItem(key, String(val)); window.dispatchEvent(new Event(event)) }
  catch { /* quota */ }
}

/* ── MetaDonut (hero card com edição inline de meta) ────── */
function MetaDonut({ label, value, meta, pct, color, onSetMeta, isCount }: {
  label: string; value: string; meta: number | null; pct: number | null
  color: string; onSetMeta: (v: number) => void; isCount?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const r = 42, cx = 54, cy = 54, circ = 2 * Math.PI * r
  const clamped = pct !== null ? Math.min(120, Math.max(0, pct)) : null
  const filled = clamped !== null ? Math.min((clamped / 100) * circ, circ - 3) : 0

  function submit() {
    const raw = input.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')
    const v = parseFloat(raw)
    if (!isNaN(v) && v > 0) { onSetMeta(v); setEditing(false); setInput('') }
  }

  return (
    <div className="so-hero-card">
      <div className="so-hero-label">{label}</div>
      <div className="so-hero-svg-wrap">
        <svg viewBox="0 0 108 108">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={11} />
          {clamped !== null && filled > 0 && (
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={11}
                strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
            </g>
          )}
          {clamped !== null
            ? <><text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fontWeight={800} fill={color} fontFamily="Space Grotesk, sans-serif">{Math.round(pct!)}%</text>
               <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">da meta</text></>
            : <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">sem meta</text>
          }
        </svg>
      </div>
      <div className="so-hero-value" style={{ color }}>{value}</div>
      {meta !== null
        ? <div className="so-hero-sub">meta: {isCount ? fmtNum(meta) : kpiCurrency(meta)}</div>
        : editing
          ? <div className="so-hero-edit">
              <input className="so-hero-input" type="text" autoFocus
                placeholder={isCount ? 'Ex.: 200' : 'Ex.: 1200000'}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }} />
              <button className="so-hero-save" type="button" onClick={submit}>✓</button>
              <button className="so-hero-cancel" type="button" onClick={() => setEditing(false)}>✕</button>
            </div>
          : <button className="so-hero-meta-btn" type="button" onClick={() => setEditing(true)}>+ Definir meta</button>
      }
    </div>
  )
}

/* ── SplitDonut (faturado vs a faturar) ─────────────────── */
function SplitDonut({ fat, afat }: { fat: number; afat: number }) {
  const total = fat + afat
  if (total <= 0) return (
    <div className="so-hero-card">
      <div className="so-hero-label">Faturado vs A faturar</div>
      <div className="so-hero-svg-wrap"><svg viewBox="0 0 108 108"><circle cx={54} cy={54} r={42} fill="none" stroke="var(--border)" strokeWidth={11} /></svg></div>
      <div className="so-hero-value" style={{ color: 'var(--muted)' }}>—</div>
      <div className="so-hero-sub">sem dados</div>
    </div>
  )
  const r = 42, cx = 54, cy = 54, circ = 2 * Math.PI * r, gap = 4
  const fp = fat / total, ap = afat / total
  const fd = Math.max(0, fp * circ - gap), ad = Math.max(0, ap * circ - gap)
  return (
    <div className="so-hero-card">
      <div className="so-hero-label">Faturado vs A faturar</div>
      <div className="so-hero-svg-wrap">
        <svg viewBox="0 0 108 108">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={11} />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {fd > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--blue)" strokeWidth={11} strokeDasharray={`${fd} ${circ}`} strokeLinecap="round" />}
            {ad > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={11} strokeDasharray={`${ad} ${circ}`} strokeDashoffset={-fp * circ} strokeLinecap="round" />}
          </g>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--blue)" fontFamily="Space Grotesk, sans-serif">{Math.round(fp * 100)}%</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">faturado</text>
        </svg>
      </div>
      <div className="so-hero-value" style={{ color: 'var(--blue)' }}>{kpiCurrency(fat)}</div>
      <div className="so-hero-sub" style={{ color: '#f59e0b' }}>+{kpiCurrency(afat)} a faturar</div>
    </div>
  )
}

/* ── KpiCard secundário ──────────────────────────────────── */
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

/* ── utilidade: construir path SVG ──────────────────────── */
function linePath(vals: number[], xFn: (i: number) => number, yFn: (v: number) => number) {
  return vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFn(i).toFixed(1)} ${yFn(v).toFixed(1)}`).join(' ')
}

/* ── SellOutTab ─────────────────────────────────────────── */
export function SellOutTab({ movementBase, productBase }: {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
}) {
  const [windowOffset, setWindowOffset] = useState(0)
  const [compact, setCompact] = useState(false)
  const [selloutMeta, setSelloutMeta] = useState<number | null>(() => readNum('rj-sellout-meta'))
  const [positivMeta, setPositivMeta] = useState<number | null>(() => readNum('rj-positiv-meta'))

  useEffect(() => {
    const a = () => setSelloutMeta(readNum('rj-sellout-meta'))
    const b = () => setPositivMeta(readNum('rj-positiv-meta'))
    window.addEventListener('rj-sellout-meta-changed', a)
    window.addEventListener('rj-positiv-meta-changed', b)
    return () => { window.removeEventListener('rj-sellout-meta-changed', a); window.removeEventListener('rj-positiv-meta-changed', b) }
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

  // KPIs do mês inteiro
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

  // Dados por dia (todos os dias do mês)
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

  // Janela deslizante
  const maxOffset = Math.max(0, allDays.length - WINDOW)
  const clampedOffset = Math.min(windowOffset, maxOffset)
  const windowDays = useMemo(() => {
    const end = Math.max(0, allDays.length - 1 - clampedOffset)
    const start = Math.max(0, end - WINDOW + 1)
    return allDays.slice(start, end + 1)
  }, [allDays, clampedOffset])

  const winStart = windowDays[0]?.date ?? ''
  const winEnd = windowDays[windowDays.length - 1]?.date ?? ''

  // Acumulados da janela
  const winTotals = useMemo(() => windowDays.reduce(
    (acc, d) => ({ sellOut: acc.sellOut + d.sellOut, fat: acc.fat + d.fat, afat: acc.afat + d.afat, posFat: acc.posFat + d.posFat, posTotal: acc.posTotal + d.posTotal }),
    { sellOut: 0, fat: 0, afat: 0, posFat: 0, posTotal: 0 }
  ), [windowDays])

  // KPIs por linha comercial
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

  if (!movementBase.length) {
    return (
      <>
        <header className="topbar stock-topbar" aria-label="Sell out" />
        <section className="content"><div className="so-empty"><p>Nenhuma movimentação importada ainda.</p><small>Importe na aba <strong>Administração</strong>.</small></div></section>
      </>
    )
  }

  // Geometria dos gráficos de linha
  const W = 540, H_FIN = 148, H_POS = 110, PAD = { l: 54, r: 10, t: 8, b: 26 }
  const iW = W - PAD.l - PAD.r
  const n = windowDays.length
  const xFn = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * iW : iW / 2)

  // Gráfico financeiro (sellOut, fat, afat)
  const finVals = windowDays.flatMap(d => [d.sellOut, d.fat, d.afat])
  const maxFin = Math.max(...finVals, 0.01), minFin = Math.min(...finVals, 0)
  const ranFin = maxFin - minFin || 1, iHF = H_FIN - PAD.t - PAD.b
  const yFin = (v: number) => PAD.t + iHF - ((v - minFin) / ranFin) * iHF
  const y0Fin = yFin(0)

  // Gráfico positivação
  const maxPos = Math.max(...windowDays.map(d => d.posTotal), 0.01), iHP = H_POS - PAD.t - PAD.b
  const yPos = (v: number) => PAD.t + iHP * (1 - v / maxPos)

  const faturadoPct = selloutMeta ? (kpis.fat / selloutMeta) * 100 : null
  const positivPct = positivMeta ? (kpis.posTotal / positivMeta) * 100 : null

  return (
    <>
      <header className="topbar stock-topbar" aria-label="Sell out">
        <span className="so-month-label">{monthLabel}</span>
      </header>

      <section className="content">
        {/* ── Hero: 3 donuts de meta ───────────────────────── */}
        <div className="so-hero-row">
          <MetaDonut label="Faturado" value={kpiCurrency(kpis.fat)} meta={selloutMeta}
            pct={faturadoPct} color="var(--blue)"
            onSetMeta={v => { saveNum('rj-sellout-meta', v, 'rj-sellout-meta-changed'); setSelloutMeta(v) }} />
          <MetaDonut label="Positivações" value={fmtNum(kpis.posTotal)} meta={positivMeta}
            pct={positivPct} color="#10b981" isCount
            onSetMeta={v => { saveNum('rj-positiv-meta', v, 'rj-positiv-meta-changed'); setPositivMeta(v) }} />
          <SplitDonut fat={kpis.fat} afat={kpis.afat} />
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
            {/* nav bar */}
            <div className="so-window-bar">
              <div className="so-window-info">
                <span className="so-window-tag">JANELA SINCRONIZADA · {WINDOW} DIAS</span>
                {winStart && <span className="so-window-range">{fmtDay(winStart)} — {fmtDay(winEnd)}</span>}
              </div>
              <div className="so-window-nav">
                <button type="button" className="so-nav-btn" onClick={() => setWindowOffset(o => Math.min(maxOffset, o + 1))} disabled={clampedOffset >= maxOffset}>‹</button>
                <button type="button" className={`so-nav-btn so-nav-atual${clampedOffset === 0 ? ' active' : ''}`} onClick={() => setWindowOffset(0)}>Atual</button>
                <button type="button" className="so-nav-btn" onClick={() => setWindowOffset(o => Math.max(0, o - 1))} disabled={clampedOffset <= 0}>›</button>
              </div>
            </div>

            {/* grid: gráficos + planilha */}
            <div className="so-detail-grid">
              {/* coluna esquerda: 2 gráficos */}
              <div className="so-charts-col">
                {/* gráfico financeiro */}
                <div className="so-chart-block">
                  <div className="so-chart-head">
                    <div>
                      <div className="so-chart-tag">MOVIMENTO FINANCEIRO</div>
                      <div className="so-chart-title">Sell Out diário</div>
                    </div>
                    <div className="so-chart-legend">
                      <span className="so-leg-item"><span style={{ borderBottom: '2px solid var(--text)', display: 'inline-block', width: 14, marginBottom: 1 }} /> Sell Out</span>
                      <span className="so-leg-item"><span style={{ borderBottom: '2px solid var(--blue)', display: 'inline-block', width: 14, marginBottom: 1 }} /> Faturado</span>
                      <span className="so-leg-item"><span style={{ borderBottom: '2px dashed #f59e0b', display: 'inline-block', width: 14, marginBottom: 1 }} /> A Faturar</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H_FIN + PAD.t + PAD.b}`} width="100%" style={{ display: 'block', minWidth: Math.max(240, n * 32) }}>
                      {[0, 0.25, 0.5, 0.75, 1].map(p => {
                        const v = minFin + ranFin * p, yv = yFin(v)
                        return <g key={p}><line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke="var(--border)" strokeWidth={0.7} />
                          <text x={PAD.l - 4} y={yv + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{kpiCurrency(v)}</text></g>
                      })}
                      {minFin < 0 && <line x1={PAD.l} y1={y0Fin} x2={W - PAD.r} y2={y0Fin} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 2" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.sellOut), xFn, yFin)} fill="none" stroke="var(--text)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.fat), xFn, yFin)} fill="none" stroke="var(--blue)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.afat), xFn, yFin)} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" strokeLinecap="round" />}
                      {windowDays.map((d, i) => (
                        <text key={d.date} x={xFn(i)} y={PAD.t + H_FIN + 18} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{fmtDay(d.date)}</text>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* gráfico positivação */}
                <div className="so-chart-block">
                  <div className="so-chart-head">
                    <div>
                      <div className="so-chart-tag">MOVIMENTO DE POSITIVAÇÃO</div>
                      <div className="so-chart-title">Clientes positivados por dia</div>
                    </div>
                    <div className="so-chart-legend">
                      <span className="so-leg-item"><span style={{ borderBottom: '2px solid #a78bfa', display: 'inline-block', width: 14, marginBottom: 1 }} /> Pos. total</span>
                      <span className="so-leg-item"><span style={{ borderBottom: '2px solid #10b981', display: 'inline-block', width: 14, marginBottom: 1 }} /> Pos. faturada</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H_POS + PAD.t + PAD.b}`} width="100%" style={{ display: 'block', minWidth: Math.max(240, n * 32) }}>
                      {[0, 0.5, 1].map(p => {
                        const v = Math.round(maxPos * p), yv = yPos(v)
                        return <g key={p}><line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke="var(--border)" strokeWidth={0.7} />
                          <text x={PAD.l - 4} y={yv + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{v}</text></g>
                      })}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.posTotal), xFn, yPos)} fill="none" stroke="#a78bfa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
                      {n > 0 && <path d={linePath(windowDays.map(d => d.posFat), xFn, yPos)} fill="none" stroke="#10b981" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
                      {windowDays.map((d, i) => (
                        <text key={d.date} x={xFn(i)} y={PAD.t + H_POS + 18} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="Space Grotesk, sans-serif">{fmtDay(d.date)}</text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>

              {/* coluna direita: planilha diária */}
              <div className="so-table-col">
                <div className="so-table-head">
                  <div>
                    <div className="so-chart-tag">PLANILHA DIÁRIA</div>
                    <div className="so-chart-title">Financeiro + positivação</div>
                    {winStart && <div className="so-window-sub">{fmtDay(winStart)} — {fmtDay(winEnd)}</div>}
                  </div>
                  <button type="button" className={`so-compact-btn${compact ? ' active' : ''}`} onClick={() => setCompact(v => !v)}>
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
                          <th className="n-right">POS. FAT.</th>
                          <th className="n-right">POS. TOTAL</th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {[...windowDays].reverse().map(d => (
                        <tr key={d.date}>
                          <td className="so-dt-date">{fmtDay(d.date)}</td>
                          <td className={`n-right so-dt-sellout${d.sellOut < 0 ? ' neg' : ''}`}>
                            {compact ? kpiCurrency(d.sellOut) : brlFull(d.sellOut)}
                          </td>
                          {!compact && <>
                            <td className="n-right so-dt-fat" style={{ color: d.fat > 0 ? 'var(--blue)' : 'var(--muted)' }}>{brlFull(d.fat)}</td>
                            <td className="n-right so-dt-afat" style={{ color: d.afat > 0 ? '#f59e0b' : 'var(--muted)' }}>{brlFull(d.afat)}</td>
                            <td className={`n-right so-dt-pos${d.posFat > 0 ? ' pos-active' : ''}`}>{d.posFat}</td>
                            <td className={`n-right so-dt-pos${d.posTotal > 0 ? ' pos-total' : ''}`}>{d.posTotal}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* totais da janela */}
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
