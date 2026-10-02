import { useState, useEffect, useMemo } from 'react'
import { CampaignManager, readCampaigns } from './CampaignManager'
import { apurateCampaign, CAMPAIGN_TYPE_LABEL, type CampaignRecord, type ApurationResult, type ApurationDiagnostic, type ApurationGoal, type SellerResult } from './domain/campaignEngine'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalClient } from './domain/clientMotor'
import type { RcaRecord } from './RcaManager'

/* ── helpers ─────────────────────────────────────────────── */
function kpiCurrency(v: number) {
  const abs = Math.abs(v), sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(2)}K`
  return `${sign}R$ ${abs.toFixed(2)}`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d ? `${d}/${m}/${y}` : iso
}

function periodProgress(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return -1
  const now = Date.now()
  const start = new Date(startDate + 'T00:00:00').getTime()
  const end = new Date(endDate + 'T23:59:59').getTime()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

/* ── CampaignPanel ───────────────────────────────────────── */
interface PanelProps {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
  clientBase: CanonicalClient[]
  rcas: RcaRecord[]
  campaignsOverride?: CampaignRecord[]
  readOnly?: boolean
}

function CampaignPanel({ movementBase, productBase, clientBase, rcas, campaignsOverride, readOnly }: PanelProps) {
  const [liveCampaigns, setLiveCampaigns] = useState<CampaignRecord[]>(readCampaigns)
  const campaigns = campaignsOverride ?? liveCampaigns
  const [selected, setSelected] = useState<string | null>(null)
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)

  useEffect(() => {
    if (campaignsOverride) return
    const onUpdate = () => setLiveCampaigns(readCampaigns())
    window.addEventListener('rj-campaigns-changed', onUpdate)
    return () => window.removeEventListener('rj-campaigns-changed', onUpdate)
  }, [campaignsOverride])

  const activeCampaigns = useMemo(
    () => campaigns.filter(c => c.status === 'active'),
    [campaigns]
  )

  const hasMotors = movementBase.length > 0 || productBase.length > 0

  // Run apuration for all active campaigns
  const results = useMemo(() => {
    if (!hasMotors) return new Map<string, ApurationResult>()
    const map = new Map<string, ApurationResult>()
    for (const c of activeCampaigns) {
      if (!c.startDate || !c.endDate || !c.config) continue
      try {
        map.set(c.id, apurateCampaign(c, movementBase, productBase, clientBase, rcas))
      } catch {
        // apuration error — skip
      }
    }
    return map
  }, [activeCampaigns, movementBase, productBase, clientBase, rcas, hasMotors])

  if (activeCampaigns.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 56 }}>
        <p style={{ fontSize: 14 }}>Nenhuma campanha ativa.</p>
        <p style={{ fontSize: 12 }}>Cadastre campanhas na aba <strong>Cadastro</strong>.</p>
      </div>
    )
  }

  const selectedCampaign = selected ? activeCampaigns.find(c => c.id === selected) : null
  const selectedResult = selected ? results.get(selected) : null

  return (
    <div>
      {/* Campaign cards grid */}
      <div className="camp-grid">
        {activeCampaigns.map(c => {
          const result = results.get(c.id)
          const progress = periodProgress(c.startDate, c.endDate)
          const isSelected = selected === c.id
          const noDate = !c.startDate || !c.endDate
          const noMotor = !hasMotors

          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`camp-panel-card${isSelected ? ' camp-panel-card-sel' : ''}`}
              onClick={() => { setSelected(isSelected ? null : c.id); setExpandedSeller(null) }}
              onKeyDown={e => e.key === 'Enter' && setSelected(isSelected ? null : c.id)}
            >
              <div className="camp-card-header">
                <div className="camp-card-title">{c.name}</div>
                <span className="camp-brand-tag">{c.config ? CAMPAIGN_TYPE_LABEL[c.config.type] : '—'}</span>
              </div>

              {(c.startDate || c.endDate) && (
                <div className="camp-card-dates">
                  {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                </div>
              )}

              {progress >= 0 && (
                <div className="camp-progress-bar">
                  <div
                    className="camp-progress-fill"
                    style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--muted)' : 'var(--blue)' }}
                  />
                  <span className="camp-progress-label">
                    {progress >= 100 ? 'Encerrada' : `${progress}% do período`}
                  </span>
                </div>
              )}

              {noDate ? (
                <p className="camp-no-data">Defina as datas da campanha para ver os resultados.</p>
              ) : noMotor ? (
                <p className="camp-no-data">Processe os motores de Movimentações para ver resultados.</p>
              ) : result ? (
                <div className="camp-stats">
                  <div className="camp-stat">
                    <span className="camp-stat-val">{result.totalPdvs}</span>
                    <span className="camp-stat-label">PDVs qualificados</span>
                  </div>
                  <div className="camp-stat">
                    <span className="camp-stat-val">{kpiCurrency(result.totalPrize)}</span>
                    <span className="camp-stat-label">Prêmio vendedores</span>
                  </div>
                  <div className="camp-stat">
                    <span className="camp-stat-val">{result.sellers.length}</span>
                    <span className="camp-stat-label">Vendedores</span>
                  </div>
                  {result.totalPdvs === 0 && result.sellers.length > 0 && (() => {
                    const leader = result.sellers[0]
                    const pct = Math.round((leader.bestPdvProgress ?? 0) * 100)
                    return (
                      <div style={{ width: '100%', marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
                          Líder: <strong>{leader.sellerName.split(' ')[0]}</strong> · {pct}% do critério
                        </div>
                        <ProgressBar pct={pct} goal={result.goal} height={5} />
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <p className="camp-no-data">Sem dados para apurar.</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail panel for selected campaign */}
      {selectedCampaign && selectedResult && (
        <div className="camp-detail">
          <div className="camp-detail-header">
            <h3 style={{ margin: 0, fontSize: 13, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Apuração — {selectedCampaign.name}
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {fmtDate(selectedCampaign.startDate)} → {fmtDate(selectedCampaign.endDate)}
              {selectedCampaign.config && ` · ${CAMPAIGN_TYPE_LABEL[selectedCampaign.config.type]}`}
            </span>
          </div>

          {/* Summary KPIs */}
          <div className="camp-stats" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="camp-stat">
              <span className="camp-stat-val">{selectedResult.totalPdvs}</span>
              <span className="camp-stat-label">PDVs qualificados</span>
            </div>
            <div className="camp-stat">
              <span className="camp-stat-val">{kpiCurrency(selectedResult.totalPrize)}</span>
              <span className="camp-stat-label">Total prêmios vendedores</span>
            </div>
            <div className="camp-stat">
              <span className="camp-stat-val">{kpiCurrency(selectedResult.sellers.reduce((s, r) => s + r.prizeSupervisor, 0))}</span>
              <span className="camp-stat-label">Total prêmios supervisores</span>
            </div>
            <div className="camp-stat">
              <span className="camp-stat-val">{kpiCurrency(selectedResult.sellers.reduce((s, r) => s + r.prizeGerente, 0))}</span>
              <span className="camp-stat-label">Total prêmios gerentes</span>
            </div>
          </div>

          {selectedResult.sellers.length === 0 ? (
            <DiagnosticHint d={selectedResult.diagnostic} cfg={selectedCampaign.config} />
          ) : (
            <>
              {selectedResult.totalPdvs === 0 && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, marginBottom: 0 }}>
                  <strong style={{ color: 'var(--red)' }}>Nenhum PDV qualificou ainda.</strong> Veja abaixo quem está mais perto.
                </p>
              )}

              {/* Podium */}
              <CampaignPodium sellers={selectedResult.sellers} goal={selectedResult.goal} />

              {/* Ranking table */}
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table className="gr-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vendedor</th>
                      <th>Supervisor</th>
                      <th className="n-right">PDVs qualif.</th>
                      <th>Melhor PDV</th>
                      <th className="n-right">Prêmio vend.</th>
                      <th className="n-right">Prêmio sup.</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.sellers.map((s, i) => (
                      <>
                        <tr
                          key={s.sellerCode}
                          className="gr-row"
                          style={{ cursor: s.details.length > 0 ? 'pointer' : 'default' }}
                          onClick={() => s.details.length > 0 && setExpandedSeller(expandedSeller === s.sellerCode ? null : s.sellerCode)}
                        >
                          <td style={{ color: 'var(--muted)', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 12 }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.sellerName}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.supervisorName}</td>
                          <td className="n-right" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                            {s.qualifiedPdvs}
                          </td>
                          <td style={{ minWidth: 120 }}>
                            <ProgressBar pct={Math.min(100, Math.round((s.bestPdvProgress ?? 0) * 100))} goal={selectedResult.goal} />
                          </td>
                          <td className="n-right" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: 'var(--blue)' }}>
                            {kpiCurrency(s.prizeVendedor)}
                          </td>
                          <td className="n-right" style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {kpiCurrency(s.prizeSupervisor)}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                            {s.details.length > 0 && (expandedSeller === s.sellerCode ? '▲' : '▼')}
                          </td>
                        </tr>

                        {expandedSeller === s.sellerCode && s.details.length > 0 && (
                          <tr key={`${s.sellerCode}-detail`}>
                            <td colSpan={8} style={{ padding: 0, background: 'var(--surface)' }}>
                              <SellerPdvDetail seller={s} goal={selectedResult.goal} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Diagnostic hint when result is empty ────────────────── */
function DiagnosticHint({ d, cfg }: { d?: ApurationDiagnostic; cfg?: CampaignRecord['config'] }) {
  if (!d) return null
  const minSkus = cfg && 'minSkus' in cfg ? (cfg as { minSkus: number }).minSkus : null

  if (d.movementsInWindow === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--red)' }}>0 movimentações no período da campanha.</strong><br />
        Verifique se os dados importados no Motor de Movimentações cobrem as datas da campanha.
      </p>
    )
  }
  if (d.movementsMatched === 0) {
    const campaignCodes = d.campaignCodesSample ?? []
    const movCodes = d.movementCodesSample ?? []
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>
          {d.movementsInWindow.toLocaleString('pt-BR')} movimentações no período, mas nenhum produto correspondeu à lista.
        </p>
        {(campaignCodes.length > 0 || movCodes.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Códigos na campanha ({campaignCodes.length}{campaignCodes.length === 15 ? '+' : ''})
              </div>
              {campaignCodes.length === 0 ? (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nenhum código cadastrado — todos os produtos contam</span>
              ) : campaignCodes.map(c => (
                <div key={c} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 0', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{c}</div>
              ))}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Produtos nas movimentações ({movCodes.length}{movCodes.length === 15 ? '+' : ''})
              </div>
              {movCodes.length === 0 ? (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nenhuma movimentação com produto no período</span>
              ) : movCodes.map(c => (
                <div key={c} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 0', borderBottom: '1px solid var(--border)', color: campaignCodes.includes(c) ? 'var(--green, #22c55e)' : 'var(--text)' }}>{c}</div>
              ))}
            </div>
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          Compare as duas colunas: os códigos precisam ser idênticos. Se a campanha usa EANs e as movimentações mostram códigos Winthor, importe o <strong>Motor de Produtos</strong> para a conversão ser feita automaticamente.
        </p>
      </div>
    )
  }
  if (d.pdvsFound > 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--red)' }}>{d.pdvsFound} PDV(s) com compras encontrados, mas nenhum atingiu o mínimo{minSkus ? ` de ${minSkus} SKUs` : ''}.</strong><br />
        Revise o critério mínimo da campanha ou verifique se todos os produtos da lista estão no cadastro.
      </p>
    )
  }
  return (
    <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
      Nenhuma movimentação correspondeu aos critérios da campanha.
    </p>
  )
}

/* ── Progress bar ────────────────────────────────────────── */
function ProgressBar({ pct, goal, height = 8 }: { pct: number; goal?: ApurationGoal; height?: number }) {
  const color = pct >= 100 ? 'var(--green, #22c55e)' : pct >= 70 ? 'var(--blue)' : pct >= 40 ? '#f59e0b' : 'var(--muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 10, color, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
        {pct >= 100 ? (goal ? '✓' : `${pct}%`) : `${pct}%`}
      </span>
    </div>
  )
}

/* ── Podium ──────────────────────────────────────────────── */
function CampaignPodium({ sellers, goal }: { sellers: SellerResult[]; goal?: ApurationGoal }) {
  if (sellers.length === 0) return null
  const top = sellers.slice(0, 3)
  const order = top.length === 1 ? [0] : top.length === 2 ? [1, 0] : [1, 0, 2]
  const heights = [80, 110, 60]
  const medals = ['🥇', '🥈', '🥉']
  const labels = ['1º', '2º', '3º']

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, marginTop: 20, marginBottom: 4 }}>
      {order.map(idx => {
        const s = top[idx]
        if (!s) return null
        const pct = Math.min(100, Math.round((s.bestPdvProgress ?? 0) * 100))
        const hasWon = s.qualifiedPdvs > 0
        const h = heights[idx]
        return (
          <div key={s.sellerCode} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: 'var(--text)' }}>
              {s.sellerName.split(' ')[0]}
            </div>
            {goal && (
              <div style={{ width: '90%', marginBottom: 4 }}>
                <ProgressBar pct={pct} goal={goal} height={6} />
              </div>
            )}
            {hasWon && (
              <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700, marginBottom: 2 }}>
                {s.qualifiedPdvs} PDV{s.qualifiedPdvs > 1 ? 's' : ''} · {kpiCurrency(s.prizeVendedor)}
              </div>
            )}
            <div style={{
              width: '100%', height: h,
              background: hasWon ? 'var(--blue)' : idx === 0 ? 'var(--red)' : 'var(--border)',
              borderRadius: '4px 4px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              {medals[idx]}
            </div>
            <div style={{
              width: '100%', textAlign: 'center', fontSize: 10, fontWeight: 700,
              background: 'var(--border)', borderRadius: '0 0 4px 4px', padding: '2px 0',
              color: 'var(--muted)',
            }}>
              {labels[idx]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── PDV detail sub-table ────────────────────────────────── */
function SellerPdvDetail({ seller, goal }: { seller: SellerResult; goal?: ApurationGoal }) {
  const qualified = seller.details.filter(d => d.qualified)
  const notQualified = seller.details.filter(d => !d.qualified)

  return (
    <div style={{ padding: '8px 16px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        PDVs de {seller.sellerName} · {qualified.length} qualificados · {notQualified.length} não qualificados
      </div>
      <table className="gr-table" style={{ fontSize: 11 }}>
        <thead>
          <tr>
            <th>PDV</th>
            {goal && <th style={{ minWidth: 140 }}>Progresso</th>}
            <th className="n-right">Valor / SKUs</th>
            <th>Status</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {seller.details.slice(0, 80).map(d => (
            <tr key={d.customerCode} className="gr-row" style={{ opacity: d.qualified ? 1 : 0.75 }}>
              <td>{d.customerName || d.customerCode}</td>
              {goal && (
                <td style={{ minWidth: 140 }}>
                  <ProgressBar pct={Math.min(100, d.progressPct ?? 0)} goal={goal} height={6} />
                </td>
              )}
              <td className="n-right" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {d.value !== undefined ? kpiCurrency(d.value) : d.skuCount !== undefined ? `${d.skuCount} SKUs` : '—'}
              </td>
              <td style={{ color: d.qualified ? 'var(--green, #22c55e)' : 'var(--muted)' }}>
                {d.qualified ? '✓' : '✗'}
              </td>
              <td style={{ color: 'var(--muted)' }}>{d.reason ?? ''}</td>
            </tr>
          ))}
          {seller.details.length > 80 && (
            <tr><td colSpan={goal ? 5 : 4} style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 11 }}>
              … e mais {seller.details.length - 80} PDVs
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── CampaignTab (entry point exported to App) ───────────── */
interface CampaignTabProps {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
  clientBase: CanonicalClient[]
  rcas: RcaRecord[]
  campaignsOverride?: CampaignRecord[]
  readOnly?: boolean
}

export function CampaignTab({ movementBase, productBase, clientBase, rcas, campaignsOverride, readOnly }: CampaignTabProps) {
  const [subTab, setSubTab] = useState<'painel' | 'cadastro'>('painel')

  return (
    <>
      <header
        className="topbar"
        style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}
      >
        <div />
        <div style={{ display: 'flex' }}>
          <button type="button" className={`stock-nav-btn${subTab === 'painel' ? ' on' : ''}`} onClick={() => setSubTab('painel')}>
            Painel
          </button>
          <button type="button" className={`stock-nav-btn${subTab === 'cadastro' ? ' on' : ''}`} onClick={() => setSubTab('cadastro')}>
            Cadastro
          </button>
        </div>
        <div />
      </header>

      <section className="content">
        {subTab === 'painel'
          ? <CampaignPanel movementBase={movementBase} productBase={productBase} clientBase={clientBase} rcas={rcas} campaignsOverride={campaignsOverride} readOnly={readOnly} />
          : readOnly ? <p style={{ color: 'var(--muted)', padding: 24, fontSize: 13 }}>Cadastro indisponível em modo somente leitura.</p> : <CampaignManager />}
      </section>
    </>
  )
}
