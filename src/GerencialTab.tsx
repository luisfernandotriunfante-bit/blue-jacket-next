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

/* ── achievement badge ───────────────────────────────── */
function AtingBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const cls = pct >= 100 ? 'gr-ating-ok' : pct >= 70 ? 'gr-ating-mid' : 'gr-ating-low'
  return <span className={`gr-ating ${cls}`}>{fmtPct(pct)}</span>
}

/* ── Pódio ───────────────────────────────────────────── */
const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM_ORDER = [1, 0, 2] // 2nd, 1st, 3rd visually

function Podium({ sellers }: { sellers: { name: string; achievement: number; fat: number; code: string }[] }) {
  if (!sellers.length) return null
  const heights = ['60px', '90px', '44px']
  return (
    <div className="gr-podium">
      {PODIUM_ORDER.map(idx => {
        const s = sellers[idx]
        if (!s) return <div key={idx} className="gr-podium-slot" />
        const rank = idx + 1
        return (
          <div key={idx} className={`gr-podium-slot gr-podium-rank-${rank}`}>
            <div className="gr-podium-name">{s.name.split(' ')[0]}</div>
            <div className="gr-podium-pct">{fmtPct(s.achievement)}</div>
            <div className="gr-podium-fat">{kpiCurrency(s.fat)}</div>
            <div className="gr-podium-block" style={{ height: heights[idx] }}>
              <span className="gr-podium-medal">{MEDAL[idx]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
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

  const allSellers = useMemo((): SellerRow[] => {
    const rows: SellerRow[] = []
    const seenCodes = new Set<string>()

    for (const rca of rcas) {
      seenCodes.add(rca.code)
      const stats = movStats.get(rca.code)
      const fat = stats?.fat ?? 0
      const achievement = rca.goal && rca.goal > 0 ? (fat / rca.goal) * 100 : null
      rows.push({ rca, code: rca.code, name: rca.name, fat, afat: stats?.afat ?? 0, customers: stats?.customers.size ?? 0, goal: rca.goal, achievement, activeThisMonth: activeCodesThisMonth.has(rca.code) })
    }

    for (const [code, stats] of movStats) {
      if (seenCodes.has(code)) continue
      rows.push({ rca: null, code, name: stats.name, fat: stats.fat, afat: stats.afat, customers: stats.customers.size, goal: null, achievement: null, activeThisMonth: true })
    }

    return rows
  }, [rcas, movStats, activeCodesThisMonth])

  // Sort ranking: by achievement % desc (sellers without goal go to bottom, sorted by fat)
  const ranked = useMemo(() =>
    [...allSellers].sort((a, b) => {
      if (a.achievement !== null && b.achievement !== null) return b.achievement - a.achievement
      if (a.achievement !== null) return -1
      if (b.achievement !== null) return 1
      return b.fat - a.fat
    })
  , [allSellers])

  const teams = useMemo(() => {
    const map = new Map<string, SellerRow[]>()
    for (const row of allSellers) {
      const sup = row.rca?.supervisor || (row.rca ? 'Sem supervisor' : 'Sem cadastro')
      if (!map.has(sup)) map.set(sup, [])
      map.get(sup)!.push(row)
    }
    return [...map.entries()]
      .map(([supervisor, members]) => {
        const teamGoal = members.reduce((s, m) => s + (m.goal ?? 0), 0)
        const totalFat = members.reduce((s, m) => s + m.fat, 0)
        const teamAchievement = teamGoal > 0 ? (totalFat / teamGoal) * 100 : null
        return {
          supervisor,
          members: [...members].sort((a, b) => {
            if (a.achievement !== null && b.achievement !== null) return b.achievement - a.achievement
            if (a.achievement !== null) return -1
            if (b.achievement !== null) return 1
            return b.fat - a.fat
          }),
          totalFat,
          teamGoal,
          teamAchievement,
          activeCount: members.filter(m => m.activeThisMonth).length,
          inactiveCount: members.filter(m => !m.activeThisMonth).length,
        }
      })
      .sort((a, b) => {
        if (a.teamAchievement !== null && b.teamAchievement !== null) return b.teamAchievement - a.teamAchievement
        if (a.teamAchievement !== null) return -1
        if (b.teamAchievement !== null) return 1
        return b.totalFat - a.totalFat
      })
  }, [allSellers])

  // Filial KPIs
  const filialGoal = rcas.reduce((s, r) => s + (r.goal ?? 0), 0)
  const filialFat = allSellers.reduce((s, r) => s + r.fat, 0)
  const filialAchievement = filialGoal > 0 ? (filialFat / filialGoal) * 100 : null

  // Pódio: top 3 by achievement %, active this month, with goal
  const podiumSellers = useMemo(() =>
    [...allSellers]
      .filter(s => s.achievement !== null && s.activeThisMonth)
      .sort((a, b) => (b.achievement ?? 0) - (a.achievement ?? 0))
      .slice(0, 3)
      .map(s => ({ name: s.name, achievement: s.achievement!, fat: s.fat, code: s.code }))
  , [allSellers])

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
      {/* KPIs + Pódio */}
      <div className="gr-top-row">
        {/* Meta da filial */}
        <div className="gr-filial-kpi">
          <div className="gr-filial-label">META DA FILIAL</div>
          <div className="gr-filial-val">{filialGoal > 0 ? kpiCurrency(filialGoal) : '—'}</div>
          <div className="gr-filial-row">
            <div>
              <div className="gr-filial-sub-label">FATURADO</div>
              <div className="gr-filial-sub-val" style={{ color: 'var(--blue)' }}>{kpiCurrency(filialFat)}</div>
            </div>
            {filialAchievement !== null && (
              <div>
                <div className="gr-filial-sub-label">ATINGIMENTO</div>
                <div className="gr-filial-sub-val" style={{ color: filialAchievement >= 100 ? 'var(--blue)' : filialAchievement >= 70 ? '#f59e0b' : 'var(--red)' }}>
                  {fmtPct(filialAchievement)}
                </div>
              </div>
            )}
          </div>
          {filialGoal > 0 && (
            <div className="gr-filial-progress-wrap">
              <div
                className="gr-filial-progress-bar"
                style={{
                  width: `${Math.min(100, filialAchievement ?? 0).toFixed(1)}%`,
                  background: (filialAchievement ?? 0) >= 100 ? 'var(--blue)' : (filialAchievement ?? 0) >= 70 ? '#f59e0b' : 'var(--red)',
                }}
              />
            </div>
          )}
        </div>

        {/* Pódio */}
        {podiumSellers.length > 0 && (
          <div className="gr-podium-wrap">
            <div className="gr-filial-label" style={{ marginBottom: 8 }}>PÓDIO · {monthLabel}</div>
            <Podium sellers={podiumSellers} />
          </div>
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
            {!allSellers.some(s => s.achievement !== null) && (
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
            return (
              <div key={team.supervisor} className="gr-team-card">
                <div className="gr-team-head" onClick={() => setExpandedTeam(isExpanded ? null : team.supervisor)}>
                  <div className="gr-team-info">
                    <div className="gr-team-name">{team.supervisor}</div>
                    <div className="gr-team-sup">{team.members.length} vendedor{team.members.length !== 1 ? 'es' : ''} · {team.activeCount} ativo{team.activeCount !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="gr-team-stats">
                    {team.teamGoal > 0 && (
                      <div className="gr-team-goal-block">
                        <span className="gr-team-goal-label">META</span>
                        <span className="gr-team-goal-val">{kpiCurrency(team.teamGoal)}</span>
                      </div>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--blue)', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', fontSize: 14 }}>{kpiCurrency(team.totalFat)}</div>
                      {team.teamAchievement !== null && (
                        <div style={{ fontSize: 11, color: team.teamAchievement >= 100 ? 'var(--blue)' : team.teamAchievement >= 70 ? '#f59e0b' : 'var(--red)', fontWeight: 700 }}>
                          {fmtPct(team.teamAchievement)}
                        </div>
                      )}
                    </div>
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
                          {team.members.map((s, i) => (
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
