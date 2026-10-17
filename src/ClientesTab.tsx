import { useState, useMemo } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'

/* ── formatters ──────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(2)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}
const brlFull = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }

const today = new Date().toISOString().slice(0, 10)
function daysSince(dateStr: string): number {
  if (!dateStr) return -1
  const diff = new Date(today).getTime() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

const MOV_LABEL: Partial<Record<string, string>> = {
  venda_faturada: 'Faturado', a_faturar: 'A faturar', devolucao: 'Devolução',
  bonificacao: 'Bonificação', corte: 'Corte', entrada: 'Entrada',
}

/* ── KpiCard ─────────────────────────────────────────── */
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {sub && <div className="kpi-ring-row"><span className="kpi-pct">{sub}</span></div>}
      </div>
    </div>
  )
}

/* ── ClientesTab ─────────────────────────────────────── */
export function ClientesTab({ movementBase, clientBase, monthLabel, activeComp }: {
  movementBase: CanonicalMovement[]
  clientBase: CanonicalClient[]
  monthLabel: string
  activeComp: string
}) {
  const [search, setSearch] = useState('')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  const { monthStart, monthEnd } = useMemo(() => {
    const [y, mo] = activeComp.split('-').map(Number)
    const monthStart = `${activeComp}-01`
    const now = new Date()
    const curComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = activeComp >= curComp
      ? now.toISOString().slice(0, 10)
      : `${activeComp}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`
    return { monthStart, monthEnd }
  }, [activeComp])

  const monthBase = useMemo(() =>
    movementBase.filter(m => { const d = m.movementDate ?? ''; return d >= monthStart && d <= monthEnd })
  , [movementBase, monthStart, monthEnd])

  const movsByCustomer = useMemo(() => {
    const map = new Map<string, CanonicalMovement[]>()
    for (const m of movementBase) {
      if (!m.customerCode) continue
      if (!map.has(m.customerCode)) map.set(m.customerCode, [])
      map.get(m.customerCode)!.push(m)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.movementDate ?? '').localeCompare(a.movementDate ?? ''))
    }
    return map
  }, [movementBase])

  const lastFatDate = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of movementBase) {
      if (m.movementType !== 'venda_faturada' || !m.customerCode || !m.movementDate) continue
      const ex = map.get(m.customerCode)
      if (!ex || m.movementDate > ex) map.set(m.customerCode, m.movementDate)
    }
    return map
  }, [movementBase])

  const positivados = useMemo(() => {
    const map = new Map<string, { code: string; name: string; fat: number; afat: number; seller: string; lastDate: string }>()
    for (const m of monthBase) {
      const code = m.customerCode ?? ''; if (!code) continue
      if (m.movementType === 'venda_faturada' || m.movementType === 'a_faturar') {
        if (!map.has(code)) map.set(code, { code, name: m.customerName ?? code, fat: 0, afat: 0, seller: m.seller ?? m.sellerCode ?? '—', lastDate: m.movementDate ?? '' })
      } else if (m.movementType === 'devolucao') {
        if (!map.has(code)) continue
      } else {
        continue
      }
      const e = map.get(code)!
      if (m.movementType === 'venda_faturada') e.fat += m.value ?? 0
      else if (m.movementType === 'devolucao') e.fat += m.value ?? 0
      else e.afat += m.value ?? 0
      if ((m.movementDate ?? '') > e.lastDate) {
        e.lastDate = m.movementDate ?? ''
        e.seller = m.seller ?? m.sellerCode ?? e.seller
      }
    }
    return [...map.values()].sort((a, b) => b.fat - a.fat)
  }, [monthBase])

  const totalFat = useMemo(() => positivados.reduce((s, p) => s + p.fat, 0), [positivados])

  const q = search.toLowerCase()
  const filteredPosit = positivados.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q)
  )

  function toggleCustomer(code: string) {
    setExpandedCustomer(prev => prev === code ? null : code)
  }

  if (!movementBase.length) {
    return (
      <section className="content">
        <div className="so-empty">
          <p>Nenhuma movimentação importada ainda.</p>
          <small>Importe na aba <strong>Administração</strong>.</small>
        </div>
      </section>
    )
  }

  return (
    <section className="content">
      <div className="stock-kpis" style={{ marginBottom: 20 }}>
        <KpiCard label="Positivados" value={String(positivados.length)} />
        <KpiCard label="Faturado total" value={kpiCurrency(totalFat)} />
      </div>

      <div className="cl-toolbar">
        <input
          className="stock-search"
          placeholder="Buscar cliente, código, vendedor…"
          value={search}
          onChange={e => { setSearch(e.target.value); setExpandedCustomer(null) }}
          style={{ flex: 1 }}
        />
      </div>

      <div className="notas-section" style={{ marginBottom: 24 }}>
        <div className="notas-section-head">
          <span className="notas-section-title">Positivados · {monthLabel}</span>
          <small style={{ color: 'var(--muted)', fontSize: 11 }}>clique numa linha para ver histórico</small>
        </div>
        <div>
          <table className="gr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Cliente</th>
                <th className="n-right">Faturado</th>
                <th className="n-right">A faturar</th>
                <th>Vendedor</th>
                <th className="n-right">Dias s/ compra</th>
                <th>Último mov.</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosit.map((p, i) => {
                const isExpanded = expandedCustomer === p.code
                const lastFat = lastFatDate.get(p.code) ?? p.lastDate
                const dias = lastFat ? daysSince(lastFat) : -1
                const history = movsByCustomer.get(p.code) ?? []

                return <>
                  <tr
                    key={p.code}
                    className={`gr-row cl-expandable-row${isExpanded ? ' cl-row-expanded' : ''}`}
                    onClick={() => toggleCustomer(p.code)}
                  >
                    <td className="gr-rank">#{i + 1}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.code}</td>
                    <td>
                      <div className="gr-seller-name">{p.name}</div>
                    </td>
                    <td className="n-right" style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(p.fat)}</td>
                    <td className="n-right" style={{ color: p.afat > 0 ? 'var(--red)' : 'var(--muted)', fontSize: 12 }}>
                      {p.afat > 0 ? kpiCurrency(p.afat) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{p.seller}</td>
                    <td className="n-right">
                      {dias >= 0
                        ? <span className={`cl-dias-badge ${dias <= 7 ? 'cl-dias-ok' : dias <= 30 ? 'cl-dias-mid' : 'cl-dias-warn'}`}>{dias}d</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.lastDate ? fmtDay(p.lastDate) : '—'}</td>
                  </tr>
                  {isExpanded && history.length > 0 && (
                    <tr key={`${p.code}-hist`} className="cl-history-row">
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div className="cl-history-wrap">
                          <div className="cl-history-head">
                            <span className="so-chart-tag">HISTÓRICO · {p.name}</span>
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{history.length} movimentações</span>
                          </div>
                          <div>
                            <table className="so-day-detail-table">
                              <thead>
                                <tr>
                                  <th>Data</th>
                                  <th>Tipo</th>
                                  <th>Produto</th>
                                  <th>Vendedor</th>
                                  <th className="n-right">Qtd</th>
                                  <th className="n-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((m, mi) => (
                                  <tr key={mi} className={`so-dm-row so-dm-${m.movementType}`}>
                                    <td style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{m.movementDate ? fmtDay(m.movementDate) : '—'}</td>
                                    <td><span className={`so-mov-badge so-mov-${m.movementType}`}>{MOV_LABEL[m.movementType] ?? m.movementType}</span></td>
                                    <td className="so-dm-product">{m.description ?? m.productCode ?? '—'}</td>
                                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{m.seller ?? m.sellerCode ?? '—'}</td>
                                    <td className="n-right so-dm-qty">{m.quantity != null ? m.quantity.toLocaleString('pt-BR') : '—'}</td>
                                    <td className="n-right so-dm-value">{m.value != null ? brlFull(m.value) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              })}
              {!filteredPosit.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum cliente positivado este mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
