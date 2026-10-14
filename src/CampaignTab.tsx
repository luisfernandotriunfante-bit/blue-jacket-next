import { useState, useEffect, useMemo } from 'react'
import { CampaignManager, readCampaigns } from './CampaignManager'
import { apurateCampaign, CAMPAIGN_TYPE_LABEL, type CampaignRecord, type ApurationResult, type ApurationDiagnostic, type ApurationGoal, type SellerResult, type PdvDetail } from './domain/campaignEngine'
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

          {/* CNPJ stats — só aparece quando a campanha tem restrição de clientes */}
          {selectedResult.diagnostic?.cnpjStats && (() => {
            const cs = selectedResult.diagnostic.cnpjStats!
            return (
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>{cs.total}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginTop: 2 }}>CNPJs na campanha</div>
                </div>
                <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: cs.found > 0 ? 'var(--green, #22c55e)' : 'var(--muted)' }}>{cs.found}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginTop: 2 }}>Com movimentação</div>
                </div>
                <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: cs.notFound > 0 ? 'var(--red)' : 'var(--muted)' }}>{cs.notFound}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginTop: 2 }}>Sem movimentação</div>
                </div>
              </div>
            )
          })()}

          {/* Window & movement stats — só aparece quando há diagnostic com windowStart */}
          {selectedResult.diagnostic?.windowStart && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>Janela:</span>
              <span style={{ fontSize: 11, fontFamily: 'Space Grotesk, monospace', color: 'var(--text)', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                {selectedResult.diagnostic.windowStart} → {selectedResult.diagnostic.windowEnd}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>
                {selectedResult.diagnostic.movementsInWindow} mov. no período ·{' '}
                <span style={{ color: selectedResult.diagnostic.movementsMatched > 0 ? 'var(--text)' : 'var(--red)', fontWeight: 700 }}>
                  {selectedResult.diagnostic.movementsMatched} com código da campanha
                </span>
              </span>
            </div>
          )}

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

    // EAN codes entered but product base not imported — show a clear, actionable error
    if (d.eanWithoutProductBase) {
      return (
        <div style={{ marginTop: 12 }}>
          <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 6 }}>
              ⚠️ EAN detectado — Base de Produtos não importada
            </div>
            <p style={{ fontSize: 12, color: '#78350f', margin: '0 0 8px', lineHeight: 1.6 }}>
              Seus códigos de produto são <strong>EANs (código de barras)</strong>, mas as movimentações do Winthor usam <strong>códigos internos</strong> diferentes.
              Para converter automaticamente, você precisa importar o <strong>Motor de Produtos</strong> com a tabela de cadastro de produtos do Winthor.
            </p>
            <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.6 }}>
              Enquanto isso, você também pode substituir os EANs pelos <strong>códigos CODPROD do Winthor</strong> diretamente na configuração da campanha.
            </p>
          </div>
          <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>
            {d.movementsInWindow.toLocaleString('pt-BR')} movimentações no período, mas nenhum produto correspondeu.
          </p>
        </div>
      )
    }

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
  const visualOrder = top.length === 1 ? [0] : top.length === 2 ? [1, 0] : [1, 0, 2]
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="gr-podium" style={{ marginTop: 16, marginBottom: 4 }}>
      {visualOrder.map(rank => {
        const s = top[rank]
        if (!s) return <div key={rank} className={`gr-podium-card gr-podium-card-${rank + 1}`} />
        const pct = Math.min(100, Math.round((s.bestPdvProgress ?? 0) * 100))
        const isFirst = rank === 0
        return (
          <div key={s.sellerCode} className={`gr-podium-card gr-podium-card-${rank + 1}`}>
            <div className="gr-podium-medal">{medals[rank]}</div>
            <div className="gr-podium-name" title={s.sellerName}>
              {s.sellerName.split(' ').slice(0, 2).join(' ')}
            </div>
            {goal && (
              <div style={{ width: '90%', margin: '4px 0 2px' }}>
                <ProgressBar pct={pct} goal={goal} height={5} />
              </div>
            )}
            <div className="gr-podium-pct" style={{ color: isFirst ? 'var(--blue)' : 'var(--text)' }}>
              {pct}%
            </div>
            {s.qualifiedPdvs > 0 && (
              <div className="gr-podium-fat">
                {s.qualifiedPdvs} PDV{s.qualifiedPdvs > 1 ? 's' : ''} · {kpiCurrency(s.prizeVendedor)}
              </div>
            )}
            <div className="gr-podium-fat">{kpiCurrency(s.totalValue ?? 0)}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── PDV detail sub-table ────────────────────────────────── */
type ItemEntry = { code: string; description?: string; done: boolean }

function ItemSection({ label, items, accent }: { label: string; items: ItemEntry[]; accent: string }) {
  if (items.length === 0) return null
  return (
    <>
      <tr>
        <td colSpan={3} style={{ padding: '6px 0 2px', borderBottom: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
        </td>
      </tr>
      {items.map(m => (
        <tr key={m.code} className="gr-row" style={{ opacity: m.done ? 1 : 0.8 }}>
          <td style={{ textAlign: 'center', fontSize: 12, width: 24 }}>
            {m.done
              ? <span style={{ color: 'var(--green, #22c55e)' }}>✓</span>
              : <span style={{ color: 'var(--red)' }}>✗</span>
            }
          </td>
          <td style={{ fontFamily: 'Space Grotesk, monospace', color: m.done ? 'var(--text)' : 'var(--red)', whiteSpace: 'nowrap', width: 110 }}>{m.code}</td>
          <td style={{ color: 'var(--text)' }}>{m.description ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
        </tr>
      ))}
    </>
  )
}

function MandatoryDetailPanel({ d }: { d: PdvDetail }) {
  const doneMand  = (d.doneMandatory  ?? []).map(m => ({ ...m, done: true  }))
  const missMand  = (d.missingMandatory ?? []).map(m => ({ ...m, done: false }))
  const doneOpt   = (d.doneOptional   ?? []).map(m => ({ ...m, done: true  }))
  const missOpt   = (d.missingOptional ?? []).map(m => ({ ...m, done: false }))
  const hasAny = doneMand.length + missMand.length + doneOpt.length + missOpt.length > 0
  if (!hasAny) return null

  const green = 'var(--green, #22c55e)'
  const red   = 'var(--red)'
  const muted = 'var(--muted)'

  return (
    <div style={{ background: 'var(--surface-raised)', borderLeft: '3px solid var(--border)', margin: '0 0 1px 0', padding: '8px 14px 10px 16px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 6, flexWrap: 'wrap' }}>
        {doneMand.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: green }}>✓ {doneMand.length} obrig.</span>}
        {missMand.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: red  }}>✗ {missMand.length} obrig. faltando</span>}
        {doneOpt.length  > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: green, opacity: 0.8 }}>✓ {doneOpt.length} aux.</span>}
        {missOpt.length  > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: muted }}>✗ {missOpt.length} aux. faltando</span>}
      </div>
      <table className="gr-table" style={{ fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ width: 24 }}></th>
            <th style={{ width: 110 }}>Código</th>
            <th>Produto</th>
          </tr>
        </thead>
        <tbody>
          <ItemSection label="Obrigatórios comprados" items={doneMand} accent={green} />
          <ItemSection label="Obrigatórios faltando"  items={missMand} accent={red}   />
          <ItemSection label="Auxiliares comprados"   items={doneOpt}  accent={green} />
          <ItemSection label="Auxiliares faltando"    items={missOpt}  accent={muted} />
        </tbody>
      </table>
    </div>
  )
}

function PdvRow({ d, goal, colSpan }: { d: PdvDetail; goal?: ApurationGoal; colSpan: number }) {
  const [open, setOpen] = useState(false)
  const canExpand = !!(d.missingMandatory?.length || d.doneMandatory?.length || d.doneOptional?.length || d.missingOptional?.length)
  return (
    <>
      <tr
        className="gr-row"
        style={{ opacity: d.qualified ? 1 : 0.75, cursor: canExpand ? 'pointer' : undefined }}
        onClick={() => canExpand && setOpen(v => !v)}
      >
        <td>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {canExpand && (
              <span style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1 }}>{open ? '▼' : '▶'}</span>
            )}
            {d.customerName || d.customerCode}
          </span>
        </td>
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
      {open && canExpand && (
        <tr>
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <MandatoryDetailPanel d={d} />
          </td>
        </tr>
      )}
    </>
  )
}

function SellerPdvDetail({ seller, goal }: { seller: SellerResult; goal?: ApurationGoal }) {
  const qualified = seller.details.filter(d => d.qualified)
  const notQualified = seller.details.filter(d => !d.qualified)
  const colSpan = goal ? 5 : 4

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
            <PdvRow key={d.customerCode} d={d} goal={goal} colSpan={colSpan} />
          ))}
          {seller.details.length > 80 && (
            <tr><td colSpan={colSpan} style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 11 }}>
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
