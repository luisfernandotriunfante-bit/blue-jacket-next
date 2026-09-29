import { useState, useMemo, useEffect } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'
import { readRcas, type RcaRecord } from './RcaManager'

/* ── formatters ──────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtPct = (n: number) => `${n.toFixed(1)}%`

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

/* ── achievement badge ───────────────────────────────── */
function AtingBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const cls = pct >= 100 ? 'gr-ating-ok' : pct >= 70 ? 'gr-ating-mid' : 'gr-ating-low'
  return <span className={`gr-ating ${cls}`}>{fmtPct(pct)}</span>
}

/* ── seller row data ─────────────────────────────────── */
interface SellerRow {
  rca: RcaRecord | null
  code: string
  name: string
  fat: number
  afat: number
  customers: number
  goal: number | null
  achievement: number | null
  activeThisMonth: boolean
}

/* ── GerencialTab ────────────────────────────────────── */
export function GerencialTab({ movementBase, monthLabel }: {
  movementBase: CanonicalMovement[]
  monthLabel: string
}) {
  const [rcas, setRcas] = useState<RcaRecord[]>(readRcas)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [view, setView] = useState<'equipes' | 'ranking'>('equipes')

  useEffect(() => {
    const onRcas = () => setRcas(readRcas())
    window.addEventListener('rj-rcas-changed', onRcas)
    return () => window.removeEventListener('rj-rcas-changed', onRcas)
  }, [])

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

  // Per-seller movement stats (from movements)
  const movStats = useMemo(() => {
    const map = new Map<string, { fat: number; afat: number; customers: Set<string>; name: string }>()
    for (const m of monthBase) {
      if (!m.sellerCode) continue
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      if (!map.has(m.sellerCode)) map.set(m.sellerCode, { fat: 0, afat: 0, customers: new Set(), name: m.seller ?? m.sellerCode })
      const e = map.get(m.sellerCode)!
      if (m.movementType === 'venda_faturada') { e.fat += m.value ?? 0; if (m.customerCode) e.customers.add(m.customerCode) }
      else e.afat += m.value ?? 0
      if (m.seller) e.name = m.seller
    }
    return map
  }, [monthBase])

  const activeCodesThisMonth = useMemo(() => new Set(movStats.keys()), [movStats])

  // Build unified seller list: RCA records + unregistered sellers from movements
  const allSellers = useMemo((): SellerRow[] => {
    const rows: SellerRow[] = []
    const seenCodes = new Set<string>()

    // RCA registered sellers
    for (const rca of rcas) {
      seenCodes.add(rca.code)
      const stats = movStats.get(rca.code)
      const fat = stats?.fat ?? 0
      const achievement = rca.goal && rca.goal > 0 ? (fat / rca.goal) * 100 : null
      rows.push({
        rca,
        code: rca.code,
        name: rca.name,
        fat,
        afat: stats?.afat ?? 0,
        customers: stats?.customers.size ?? 0,
        goal: rca.goal,
        achievement,
        activeThisMonth: activeCodesThisMonth.has(rca.code),
      })
    }

    // Sellers in movements but not in RCA register
    for (const [code, stats] of movStats) {
      if (seenCodes.has(code)) continue
      rows.push({
        rca: null,
        code,
        name: stats.name,
        fat: stats.fat,
        afat: stats.afat,
        customers: stats.customers.size,
        goal: null,
        achievement: null,
        activeThisMonth: true,
      })
    }

    return rows
  }, [rcas, movStats, activeCodesThisMonth])

  // Sorted ranking
  const ranked = useMemo(() =>
    [...allSellers].sort((a, b) => {
      const aScore = a.achievement ?? a.fat
      const bScore = b.achievement ?? b.fat
      return bScore - aScore
    })
  , [allSellers])

  // Teams: group active RCA sellers by supervisor
  const teams = useMemo(() => {
    const map = new Map<string, SellerRow[]>()
    for (const row of allSellers) {
      const sup = row.rca?.supervisor || (row.rca ? 'Sem supervisor' : 'Sem cadastro')
      if (!map.has(sup)) map.set(sup, [])
      map.get(sup)!.push(row)
    }
    // Sort teams by total fat desc
    return [...map.entries()]
      .map(([supervisor, members]) => ({
        supervisor,
        members: members.sort((a, b) => (b.achievement ?? b.fat) - (a.achievement ?? a.fat)),
        totalFat: members.reduce((s, m) => s + m.fat, 0),
        activeCount: members.filter(m => m.activeThisMonth).length,
        inactiveCount: members.filter(m => !m.activeThisMonth).length,
      }))
      .sort((a, b) => b.totalFat - a.totalFat)
  }, [allSellers])

  // KPIs
  const totalActive = allSellers.filter(s => s.activeThisMonth).length
  const totalInactive = allSellers.filter(s => !s.activeThisMonth).length
  const withGoal = allSellers.filter(s => s.achievement !== null)
  const avgAchievement = withGoal.length ? withGoal.reduce((s, r) => s + (r.achievement ?? 0), 0) / withGoal.length : null
  const top = ranked.find(s => s.activeThisMonth) ?? null

  const hasRcas = rcas.length > 0

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
        <KpiCard label="Ativos no mês" value={String(totalActive)} />
        <KpiCard label="Inativos no mês" value={String(totalInactive)} />
        {avgAchievement !== null && <KpiCard label="Atingimento médio" value={fmtPct(avgAchievement)} />}
        {top && (
          <KpiCard
            label="Melhor vendedor"
            value={top.name}
            sub={top.achievement !== null ? fmtPct(top.achievement) : kpiCurrency(top.fat)}
          />
        )}
      </div>

      {/* Sub-view toggle */}
      <div className="gr-view-bar">
        {hasRcas && (
          <button type="button" className={`gr-view-btn${view === 'equipes' ? ' on' : ''}`} onClick={() => setView('equipes')}>
            Por equipes ({teams.length})
          </button>
        )}
        <button type="button" className={`gr-view-btn${view === 'ranking' ? ' on' : ''}`} onClick={() => setView('ranking')}>
          Ranking geral
        </button>
      </div>

      {/* ── Ranking geral ──────────────────────────────── */}
      {(view === 'ranking' || !hasRcas) && (
        <div className="notas-section" style={{ marginBottom: 24 }}>
          <div className="notas-section-head">
            <span className="notas-section-title">Ranking · {monthLabel}</span>
            {!withGoal.length && (
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>sem metas — ordenado por faturado</small>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vendedor</th>
                  <th>Supervisor</th>
                  <th>Classe</th>
                  <th className="n-right">Faturado</th>
                  <th className="n-right">A faturar</th>
                  <th className="n-right">Clientes</th>
                  <th className="n-right">Meta</th>
                  <th className="n-right">Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => (
                  <tr key={s.code} className={`gr-row${!s.activeThisMonth ? ' gr-row-inactive' : ''}`}>
                    <td className="gr-rank">#{i + 1}</td>
                    <td>
                      <div className="gr-seller-name">{s.name}</div>
                      <div className="gr-seller-code">
                        {s.code}
                        {!s.rca && <span className="rca-badge rca-badge-warn" style={{ marginLeft: 4 }}>sem cadastro</span>}
                        {!s.activeThisMonth && <span className="rca-badge rca-badge-inac" style={{ marginLeft: 4 }}>inativo</span>}
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.rca?.supervisor || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {s.rca?.class ? ({ varejo: 'Varejo', medias_contas: 'Médias Contas', grandes_contas: 'Grandes Contas', televendas: 'Televendas' }[s.rca.class] ?? s.rca.class) : '—'}
                    </td>
                    <td className="n-right" style={{ color: s.fat > 0 ? 'var(--blue)' : 'var(--muted)', fontWeight: 700 }}>
                      {s.fat > 0 ? kpiCurrency(s.fat) : '—'}
                    </td>
                    <td className="n-right" style={{ color: s.afat > 0 ? 'var(--red)' : 'var(--muted)', fontSize: 12 }}>
                      {s.afat > 0 ? kpiCurrency(s.afat) : '—'}
                    </td>
                    <td className="n-right">{s.customers || '—'}</td>
                    <td className="n-right" style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {s.goal ? kpiCurrency(s.goal) : '—'}
                    </td>
                    <td className="n-right"><AtingBadge pct={s.achievement} /></td>
                  </tr>
                ))}
                {!ranked.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum vendedor ativo este mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Por equipes ────────────────────────────────── */}
      {view === 'equipes' && hasRcas && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {teams.map(team => {
            const isExpanded = expandedTeam === team.supervisor
            const teamRanked = [...team.members].sort((a, b) => (b.achievement ?? b.fat) - (a.achievement ?? a.fat))

            return (
              <div key={team.supervisor} className="gr-team-card">
                <div className="gr-team-head" onClick={() => setExpandedTeam(isExpanded ? null : team.supervisor)}>
                  <div className="gr-team-info">
                    <div className="gr-team-name">{team.supervisor}</div>
                    <div className="gr-team-sup">{team.members.length} vendedor{team.members.length !== 1 ? 'es' : ''}</div>
                  </div>
                  <div className="gr-team-stats">
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{team.activeCount} ativos{team.inactiveCount > 0 ? ` · ${team.inactiveCount} inativos` : ''}</span>
                    <span style={{ color: 'var(--blue)', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{kpiCurrency(team.totalFat)}</span>
                  </div>
                  <span className="gr-team-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div className="gr-team-body">
                    <div style={{ overflowX: 'auto' }}>
                      <table className="gr-table gr-table-sm">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Vendedor</th>
                            <th>Classe</th>
                            <th className="n-right">Faturado</th>
                            <th className="n-right">Meta</th>
                            <th className="n-right">Atingimento</th>
                            <th style={{ minWidth: 80 }}>Progresso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRanked.map((s, i) => (
                            <tr key={s.code} className={`gr-row${!s.activeThisMonth ? ' gr-row-inactive' : ''}`}>
                              <td className="gr-rank">#{i + 1}</td>
                              <td>
                                <div className="gr-seller-name">{s.name}</div>
                                <div className="gr-seller-code">{s.code}{!s.activeThisMonth && ' · inativo'}</div>
                              </td>
                              <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {s.rca?.class ? ({ varejo: 'Varejo', medias_contas: 'Médias Contas', grandes_contas: 'Grandes Contas', televendas: 'Televendas' }[s.rca.class] ?? s.rca.class) : '—'}
                              </td>
                              <td className="n-right" style={{ color: s.fat > 0 ? 'var(--blue)' : 'var(--muted)', fontWeight: 700 }}>
                                {s.fat > 0 ? kpiCurrency(s.fat) : '—'}
                              </td>
                              <td className="n-right" style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {s.goal ? kpiCurrency(s.goal) : '—'}
                              </td>
                              <td className="n-right"><AtingBadge pct={s.achievement} /></td>
                              <td>
                                {s.achievement !== null && (
                                  <div className="gr-progress-bar-wrap">
                                    <div
                                      className="gr-progress-bar"
                                      style={{
                                        width: `${Math.min(100, s.achievement).toFixed(1)}%`,
                                        background: s.achievement >= 100 ? 'var(--blue)' : s.achievement >= 70 ? '#f59e0b' : 'var(--red)',
                                      }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {!hasRcas && (
            <div className="so-empty">
              <p>Nenhum vendedor cadastrado.</p>
              <small>Cadastre os vendedores em <strong>Administração → Vendedores</strong>.</small>
            </div>
          )}
        </div>
      )}

      {!hasRcas && view === 'equipes' && (
        <div className="so-empty" style={{ marginTop: 0 }}>
          <p>Cadastre os vendedores para ver por equipes.</p>
          <small>Vá em <strong>Administração → Vendedores</strong> e registre cada RCA com seu supervisor.</small>
        </div>
      )}
    </section>
  )
}
