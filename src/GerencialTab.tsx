import { useState, useMemo, useEffect } from 'react'
import type { CanonicalMovement } from './domain/movementMotor'

/* ── types ───────────────────────────────────────────── */
interface Team {
  name: string
  supervisor: string
  sellers: string[]  // sellerCodes
}

/* ── formatters ──────────────────────────────────────── */
const kpiCurrency = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtPct = (n: number) => `${n.toFixed(1)}%`

/* ── localStorage helpers ────────────────────────────── */
function readTeams(): Team[] {
  try { const v = localStorage.getItem('rj-teams'); return v ? (JSON.parse(v) as Team[]) : [] }
  catch { return [] }
}
function readGoals(): Record<string, number> {
  try { const v = localStorage.getItem('rj-seller-goals'); return v ? (JSON.parse(v) as Record<string, number>) : {} }
  catch { return {} }
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

/* ── GerencialTab ────────────────────────────────────── */
export function GerencialTab({ movementBase, monthLabel }: {
  movementBase: CanonicalMovement[]
  monthLabel: string
}) {
  const [teams, setTeams] = useState<Team[]>(readTeams)
  const [goals, setGoals] = useState<Record<string, number>>(readGoals)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [view, setView] = useState<'ranking' | 'equipes'>('ranking')

  useEffect(() => {
    const onTeams = () => setTeams(readTeams())
    const onGoals = () => setGoals(readGoals())
    window.addEventListener('rj-teams-changed', onTeams)
    window.addEventListener('rj-seller-goals-changed', onGoals)
    return () => {
      window.removeEventListener('rj-teams-changed', onTeams)
      window.removeEventListener('rj-seller-goals-changed', onGoals)
    }
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

  // Build per-seller stats
  const sellerStats = useMemo(() => {
    const map = new Map<string, { code: string; name: string; fat: number; afat: number; customers: Set<string> }>()
    for (const m of monthBase) {
      if (!m.sellerCode) continue
      if (m.movementType !== 'venda_faturada' && m.movementType !== 'a_faturar') continue
      if (!map.has(m.sellerCode)) {
        map.set(m.sellerCode, { code: m.sellerCode, name: m.seller ?? m.sellerCode, fat: 0, afat: 0, customers: new Set() })
      }
      const e = map.get(m.sellerCode)!
      if (m.movementType === 'venda_faturada') { e.fat += m.value ?? 0; if (m.customerCode) e.customers.add(m.customerCode) }
      else e.afat += m.value ?? 0
    }
    return map
  }, [monthBase])

  // All known sellers (active this month)
  const activeSellers = useMemo(() => new Set(sellerStats.keys()), [sellerStats])

  // All sellers who ever appeared in movementBase
  const allKnownSellers = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of movementBase) {
      if (m.sellerCode && m.seller) map.set(m.sellerCode, m.seller)
      else if (m.sellerCode) map.set(m.sellerCode, m.sellerCode)
    }
    return map
  }, [movementBase])

  const inactiveSellers = useMemo(() =>
    [...allKnownSellers.keys()].filter(code => !activeSellers.has(code))
  , [allKnownSellers, activeSellers])

  // Ranking logic: if seller has a goal, use achievement %; else use absolute fat
  const ranked = useMemo(() => {
    return [...sellerStats.values()].map(s => {
      const goal = goals[s.code] ?? null
      const achievement = goal ? (s.fat / goal) * 100 : null
      return { ...s, goal, achievement }
    }).sort((a, b) => {
      const aScore = a.achievement ?? a.fat
      const bScore = b.achievement ?? b.fat
      return bScore - aScore
    })
  }, [sellerStats, goals])

  const avgAchievement = useMemo(() => {
    const withGoal = ranked.filter(s => s.achievement !== null)
    if (!withGoal.length) return null
    return withGoal.reduce((sum, s) => sum + (s.achievement ?? 0), 0) / withGoal.length
  }, [ranked])

  const topPerformer = ranked[0] ?? null

  // Find which team a seller belongs to
  const sellerTeamMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) {
      for (const s of t.sellers) m.set(s, t.name)
    }
    return m
  }, [teams])

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
        <KpiCard label="Ativos no mês" value={String(activeSellers.size)} />
        <KpiCard label="Inativos" value={String(inactiveSellers.length)} />
        {avgAchievement !== null && <KpiCard label="Atingimento médio" value={fmtPct(avgAchievement)} />}
        {topPerformer && (
          <KpiCard
            label="Melhor vendedor"
            value={topPerformer.name}
            sub={topPerformer.achievement !== null ? fmtPct(topPerformer.achievement) : kpiCurrency(topPerformer.fat)}
          />
        )}
      </div>

      {/* Sub-view toggle */}
      <div className="gr-view-bar">
        <button type="button" className={`gr-view-btn${view === 'ranking' ? ' on' : ''}`} onClick={() => setView('ranking')}>Ranking geral</button>
        <button type="button" className={`gr-view-btn${view === 'equipes' ? ' on' : ''}`} onClick={() => setView('equipes')}>
          Por equipes{teams.length > 0 ? ` (${teams.length})` : ''}
        </button>
      </div>

      {view === 'ranking' && (
        <div className="notas-section" style={{ marginBottom: 24 }}>
          <div className="notas-section-head">
            <span className="notas-section-title">Ranking · {monthLabel}</span>
            {!Object.keys(goals).length && (
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>sem metas configuradas — ordenado por faturado</small>
            )}
          </div>
          <table className="gr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th>Equipe</th>
                <th className="n-right">Faturado</th>
                <th className="n-right">A faturar</th>
                <th className="n-right">Clientes</th>
                <th className="n-right">Meta</th>
                <th className="n-right">Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={s.code} className="gr-row">
                  <td className="gr-rank">#{i + 1}</td>
                  <td>
                    <div className="gr-seller-name">{s.name}</div>
                    <div className="gr-seller-code">{s.code}</div>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{sellerTeamMap.get(s.code) ?? '—'}</td>
                  <td className="n-right" style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(s.fat)}</td>
                  <td className="n-right" style={{ color: s.afat > 0 ? 'var(--red)' : 'var(--muted)', fontSize: 12 }}>{s.afat > 0 ? kpiCurrency(s.afat) : '—'}</td>
                  <td className="n-right">{s.customers.size}</td>
                  <td className="n-right" style={{ color: 'var(--muted)', fontSize: 12 }}>{s.goal ? kpiCurrency(s.goal) : '—'}</td>
                  <td className="n-right">
                    {s.achievement !== null ? (
                      <span className={`gr-ating ${s.achievement >= 100 ? 'gr-ating-ok' : s.achievement >= 70 ? 'gr-ating-mid' : 'gr-ating-low'}`}>
                        {fmtPct(s.achievement)}
                      </span>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
              {!ranked.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum vendedor ativo este mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'equipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!teams.length && (
            <div className="so-empty">
              <p>Nenhuma equipe configurada.</p>
              <small>Configure as equipes em <strong>Administração → Configurações</strong>.</small>
            </div>
          )}
          {teams.map(team => {
            const teamSellers = team.sellers.map(code => sellerStats.get(code)).filter((s): s is NonNullable<typeof s> => Boolean(s))
            const teamFat = teamSellers.reduce((s, v) => s + v.fat, 0)
            const activeCount = teamSellers.length
            const inactiveCount = team.sellers.filter(code => !activeSellers.has(code)).length
            const isExpanded = expandedTeam === team.name
            const teamRanked = teamSellers.map(s => {
              const goal = goals[s.code] ?? null
              const achievement = goal ? (s.fat / goal) * 100 : null
              return { ...s, goal, achievement }
            }).sort((a, b) => (b.achievement ?? b.fat) - (a.achievement ?? a.fat))

            return (
              <div key={team.name} className="gr-team-card">
                <div className="gr-team-head" onClick={() => setExpandedTeam(isExpanded ? null : team.name)}>
                  <div className="gr-team-info">
                    <div className="gr-team-name">{team.name}</div>
                    <div className="gr-team-sup">Supervisor: {team.supervisor || '—'}</div>
                  </div>
                  <div className="gr-team-stats">
                    <span>{activeCount} ativos</span>
                    {inactiveCount > 0 && <span style={{ color: 'var(--muted)' }}>{inactiveCount} inativos</span>}
                    <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(teamFat)}</span>
                  </div>
                  <span className="gr-team-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="gr-team-body">
                    {!teamSellers.length ? (
                      <p style={{ color: 'var(--muted)', padding: '12px 0', margin: 0, fontSize: 13 }}>Nenhum membro ativo este mês.</p>
                    ) : (
                      <table className="gr-table gr-table-sm">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Vendedor</th>
                            <th className="n-right">Faturado</th>
                            <th className="n-right">Meta</th>
                            <th className="n-right">Atingimento</th>
                            <th>Progresso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRanked.map((s, i) => (
                            <tr key={s.code} className="gr-row">
                              <td className="gr-rank">#{i + 1}</td>
                              <td>
                                <div className="gr-seller-name">{s.name}</div>
                                <div className="gr-seller-code">{s.code}</div>
                              </td>
                              <td className="n-right" style={{ color: 'var(--blue)', fontWeight: 700 }}>{kpiCurrency(s.fat)}</td>
                              <td className="n-right" style={{ color: 'var(--muted)', fontSize: 12 }}>{s.goal ? kpiCurrency(s.goal) : '—'}</td>
                              <td className="n-right">
                                {s.achievement !== null ? (
                                  <span className={`gr-ating ${s.achievement >= 100 ? 'gr-ating-ok' : s.achievement >= 70 ? 'gr-ating-mid' : 'gr-ating-low'}`}>
                                    {fmtPct(s.achievement)}
                                  </span>
                                ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                              </td>
                              <td>
                                {s.achievement !== null && (
                                  <div className="gr-progress-bar-wrap">
                                    <div className="gr-progress-bar" style={{ width: `${Math.min(100, s.achievement).toFixed(1)}%`, background: s.achievement >= 100 ? 'var(--blue)' : s.achievement >= 70 ? '#f59e0b' : 'var(--red)' }} />
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Show inactive team members */}
                    {team.sellers.filter(code => !activeSellers.has(code)).length > 0 && (
                      <div className="gr-inactive-list">
                        <span className="gr-inactive-label">Inativos este mês:</span>
                        {team.sellers.filter(code => !activeSellers.has(code)).map(code => (
                          <span key={code} className="gr-inactive-tag">{allKnownSellers.get(code) ?? code}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
