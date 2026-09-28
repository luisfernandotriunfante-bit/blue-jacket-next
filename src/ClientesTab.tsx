import { useState, useMemo } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalClient } from './domain/clientMotor'

/* ── formatters ──────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtDay = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }

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
export function ClientesTab({ movementBase, clientBase, monthLabel }: {
  movementBase: CanonicalMovement[]
  clientBase: CanonicalClient[]
  monthLabel: string
}) {
  const [view, setView] = useState<'positivados' | 'nao-positivados'>('positivados')
  const [search, setSearch] = useState('')

  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date()
    return {
      monthStart: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      monthEnd: now.toISOString().slice(0, 10),
    }
  }, [])

  const monthBase = useMemo(() =>
    movementBase.filter(m => { const d = m.movementDate ?? ''; return d >= monthStart && d <= monthEnd })
  , [movementBase, monthStart, monthEnd])

  // Positivados: unique customers with venda_faturada or a_faturar this month
  const positivados = useMemo(() => {
    const map = new Map<string, { code: string; name: string; fat: number; afat: number; seller: string; lastDate: string }>()
    for (const m of monthBase) {
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      const code = m.customerCode ?? ''; if (!code) continue
      if (!map.has(code)) {
        map.set(code, { code, name: m.customerName ?? code, fat: 0, afat: 0, seller: m.seller ?? m.sellerCode ?? '—', lastDate: m.movementDate ?? '' })
      }
      const e = map.get(code)!
      if (m.movementType === 'venda_faturada') e.fat += m.value ?? 0
      else e.afat += m.value ?? 0
      if ((m.movementDate ?? '') > e.lastDate) {
        e.lastDate = m.movementDate ?? ''
        e.seller = m.seller ?? m.sellerCode ?? e.seller
      }
    }
    return [...map.values()].sort((a, b) => b.fat - a.fat)
  }, [monthBase])

  const positivadosSet = useMemo(() => new Set(positivados.map(p => p.code)), [positivados])

  const totalFat = useMemo(() => positivados.reduce((s, p) => s + p.fat, 0), [positivados])

  // All known customers from movements (history) not active this month
  const naoPositivados = useMemo(() => {
    const allCustomers = new Map<string, { code: string; name: string; city: string; lastSeller: string; lastDate: string }>()

    // From clientBase
    for (const c of clientBase) {
      const code = c.winthorCode ?? ''; if (!code) continue
      allCustomers.set(code, {
        code,
        name: c.tradeName ?? c.legalName ?? code,
        city: c.city ?? '',
        lastSeller: c.rcaCode ?? '—',
        lastDate: '',
      })
    }

    // From movement history (for last-seen info)
    for (const m of movementBase) {
      if (!m.customerCode) continue
      const existing = allCustomers.get(m.customerCode)
      if (!existing) {
        allCustomers.set(m.customerCode, {
          code: m.customerCode,
          name: m.customerName ?? m.customerCode,
          city: '',
          lastSeller: m.seller ?? m.sellerCode ?? '—',
          lastDate: m.movementDate ?? '',
        })
      } else {
        if ((m.movementDate ?? '') > existing.lastDate) {
          existing.lastDate = m.movementDate ?? ''
          existing.lastSeller = m.seller ?? m.sellerCode ?? existing.lastSeller
          if (m.customerName) existing.name = m.customerName
        }
      }
    }

    return [...allCustomers.values()]
      .filter(c => !positivadosSet.has(c.code))
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [movementBase, clientBase, positivadosSet])

  const totalCart = positivados.length + naoPositivados.length
  const pctPositiv = totalCart > 0 ? (positivados.length / totalCart) * 100 : 0

  const q = search.toLowerCase()
  const filteredPosit = positivados.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q)
  )
  const filteredNaoPosit = naoPositivados.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)
  )

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
      {/* KPIs */}
      <div className="stock-kpis" style={{ marginBottom: 20 }}>
        <KpiCard label="Positivados" value={String(positivados.length)} sub={`${pctPositiv.toFixed(1)}% da carteira`} />
        <KpiCard label="Não positivados" value={String(naoPositivados.length)} />
        <KpiCard label="Carteira total" value={String(totalCart)} />
        <KpiCard label="Faturado total" value={kpiCurrency(totalFat)} />
      </div>

      {/* Search + sub-view toggle */}
      <div className="cl-toolbar">
        <input
          className="stock-search"
          placeholder="Buscar cliente, código, vendedor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <div className="gr-view-bar" style={{ margin: 0 }}>
          <button type="button" className={`gr-view-btn${view === 'positivados' ? ' on' : ''}`} onClick={() => setView('positivados')}>
            Positivados ({filteredPosit.length})
          </button>
          <button type="button" className={`gr-view-btn${view === 'nao-positivados' ? ' on' : ''}`} onClick={() => setView('nao-positivados')}>
            Não positivados ({filteredNaoPosit.length})
          </button>
        </div>
      </div>

      {view === 'positivados' && (
        <div className="notas-section" style={{ marginBottom: 24 }}>
          <div className="notas-section-head">
            <span className="notas-section-title">Positivados · {monthLabel}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th className="n-right">Faturado</th>
                  <th className="n-right">A faturar</th>
                  <th>Vendedor</th>
                  <th>Último mov.</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosit.map((p, i) => (
                  <tr key={p.code} className="gr-row">
                    <td className="gr-rank">#{i + 1}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.code}</td>
                    <td className="gr-seller-name">{p.name}</td>
                    <td className="n-right" style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(p.fat)}</td>
                    <td className="n-right" style={{ color: p.afat > 0 ? 'var(--red)' : 'var(--muted)', fontSize: 12 }}>{p.afat > 0 ? kpiCurrency(p.afat) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.seller}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.lastDate ? fmtDay(p.lastDate) : '—'}</td>
                  </tr>
                ))}
                {!filteredPosit.length && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum cliente positivado este mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'nao-positivados' && (
        <div className="notas-section" style={{ marginBottom: 24 }}>
          <div className="notas-section-head">
            <span className="notas-section-title">Não positivados · {monthLabel}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Cidade</th>
                  <th>Último vendedor</th>
                  <th>Última compra</th>
                </tr>
              </thead>
              <tbody>
                {filteredNaoPosit.map(p => (
                  <tr key={p.code} className="gr-row">
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.code}</td>
                    <td className="gr-seller-name">{p.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.city || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.lastSeller}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.lastDate ? fmtDay(p.lastDate) : '—'}</td>
                  </tr>
                ))}
                {!filteredNaoPosit.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>{search ? 'Nenhum resultado.' : 'Todos os clientes estão positivados!'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
