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

/* ── TwoSegmentDonut (mesmo padrão do SellOut) ───────── */
function TwoSegmentDonut({ label, segA, segALabel, segAVal, segB, segBLabel, segBVal, meta, metaLabel }: {
  label: string
  segA: number; segALabel: string; segAVal: string
  segB: number; segBLabel: string; segBVal: string
  meta: number | null; metaLabel: string
}) {
  const denominator = (meta ?? (segA + segB)) || 1
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
          : <div className="so-hero-no-meta">cadastre metas em Vendedores</div>
        }
      </div>
    </div>
  )
}

/* ── Pódio ───────────────────────────────────────────── */
const MEDAL_EMOJI = ['🥇', '🥈', '🥉']
const PODIUM_VISUAL_ORDER = [1, 0, 2] // esquerda=2º, centro=1º, direita=3º

function Podium({ sellers }: { sellers: { name: string; achievement: number; fat: number }[] }) {
  if (!sellers.length) return null
  return (
    <div className="gr-podium">
      {PODIUM_VISUAL_ORDER.map(rank => {
        const s = sellers[rank]
        if (!s) return <div key={rank} className={`gr-podium-card gr-podium-card-${rank + 1}`} />
        const isFirst = rank === 0
        return (
          <div key={rank} className={`gr-podium-card gr-podium-card-${rank + 1}`}>
            <div className="gr-podium-medal">{MEDAL_EMOJI[rank]}</div>
            <div className="gr-podium-name" title={s.name}>{s.name.split(' ').slice(0, 2).join(' ')}</div>
            <div className="gr-podium-pct" style={{ color: isFirst ? 'var(--blue)' : 'var(--text)' }}>
              {fmtPct(s.achievement)}
            </div>
            <div className="gr-podium-fat">{kpiCurrency(s.fat)}</div>
          </div>
        )
      })}
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

  const filialGoal = rcas.reduce((s, r) => s + (r.goal ?? 0), 0)
  const filialFat = allSellers.reduce((s, r) => s + r.fat, 0)
  const filialAfat = allSellers.reduce((s, r) => s + r.afat, 0)

  const podiumSellers = useMemo(() =>
    [...allSellers]
      .filter(s => s.achievement !== null && s.activeThisMonth)
      .sort((a, b) => (b.achievement ?? 0) - (a.achievement ?? 0))
      .slice(0, 3)
      .map(s => ({ name: s.name, achievement: s.achievement!, fat: s.fat }))
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
      {/* KPIs: donut filial + pódio */}
      <div className="so-hero-grid" style={{ marginBottom: 24 }}>
        <TwoSegmentDonut
          label="META DA FILIAL"
          segA={filialFat} segALabel="Faturado" segAVal={kpiCurrency(filialFat)}
          segB={filialAfat} segBLabel="A faturar" segBVal={kpiCurrency(filialAfat)}
          meta={filialGoal > 0 ? filialGoal : null} metaLabel={kpiCurrency(filialGoal)}
        />

        {podiumSellers.length > 0 && (
          <div className="so-hero-card" style={{ flex: 1 }}>
            <div className="so-hero-label">PÓDIO · {monthLabel}</div>
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
