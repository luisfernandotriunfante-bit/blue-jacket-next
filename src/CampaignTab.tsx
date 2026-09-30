import { useState, useEffect, useMemo } from 'react'
import { CampaignManager, readCampaigns, type CampaignRecord } from './CampaignManager'
import type { CanonicalMovement } from './domain/movementMotor'
import type { CanonicalProduct } from './domain/productMotor'

/* ── helpers ─────────────────────────────────────────────── */
function kpiCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
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
}

function CampaignPanel({ movementBase, productBase }: PanelProps) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(readCampaigns)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const onUpdate = () => setCampaigns(readCampaigns())
    window.addEventListener('rj-campaigns-changed', onUpdate)
    return () => window.removeEventListener('rj-campaigns-changed', onUpdate)
  }, [])

  // brand (lower) → set of productCodes
  const brandProducts = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const p of productBase) {
      if (!p.brand || !p.internalCode) continue
      const brand = p.brand.toLowerCase()
      if (!map.has(brand)) map.set(brand, new Set())
      map.get(brand)!.add(p.internalCode)
    }
    return map
  }, [productBase])

  const activeCampaigns = useMemo(
    () => campaigns.filter(c => c.status === 'active'),
    [campaigns]
  )

  // Compute stats per campaign
  const stats = useMemo(() => {
    return activeCampaigns.map(c => {
      const codes = brandProducts.get(c.brand.toLowerCase())
      const hasBrandData = productBase.length > 0

      if (!c.startDate || !c.endDate || !codes || codes.size === 0) {
        return {
          id: c.id, fat: 0, afat: 0, sellers: 0, clients: 0,
          movements: [] as CanonicalMovement[],
          noBrandData: !hasBrandData || !codes,
          noDate: !c.startDate || !c.endDate,
        }
      }

      const filtered = movementBase.filter(m =>
        m.productCode && codes.has(m.productCode) &&
        !!m.movementDate && m.movementDate >= c.startDate && m.movementDate <= c.endDate &&
        (m.movementType === 'venda_faturada' || m.movementType === 'devolucao' || m.movementType === 'a_faturar')
      )

      let fat = 0, afat = 0
      const sellers = new Set<string>()
      const clients = new Set<string>()

      for (const m of filtered) {
        if (m.movementType === 'venda_faturada') {
          fat += m.value ?? 0
          if (m.sellerCode) sellers.add(m.sellerCode)
          if (m.customerCode) clients.add(m.customerCode)
        } else if (m.movementType === 'devolucao') {
          fat += m.value ?? 0 // negativo, subtrai
        } else {
          afat += m.value ?? 0
          if (m.sellerCode) sellers.add(m.sellerCode)
        }
      }

      return {
        id: c.id, fat, afat, sellers: sellers.size, clients: clients.size,
        movements: filtered, noBrandData: false, noDate: false,
      }
    })
  }, [activeCampaigns, movementBase, brandProducts, productBase.length])

  // Seller ranking for selected campaign
  const sellerRanking = useMemo(() => {
    if (!selected) return []
    const stat = stats.find(s => s.id === selected)
    if (!stat || !stat.movements.length) return []

    const map = new Map<string, { code: string; name: string; fat: number; clients: Set<string> }>()
    for (const m of stat.movements) {
      const code = m.sellerCode ?? '?'
      if (!map.has(code)) map.set(code, { code, name: m.seller ?? code, fat: 0, clients: new Set() })
      const e = map.get(code)!
      if (m.movementType === 'venda_faturada') {
        e.fat += m.value ?? 0
        if (m.customerCode) e.clients.add(m.customerCode)
      } else if (m.movementType === 'devolucao') {
        e.fat += m.value ?? 0
      }
    }
    return [...map.values()]
      .sort((a, b) => b.fat - a.fat)
      .map((s, i) => ({ ...s, rank: i + 1, clientCount: s.clients.size }))
  }, [selected, stats])

  if (activeCampaigns.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 56 }}>
        <p style={{ fontSize: 14 }}>Nenhuma campanha ativa.</p>
        <p style={{ fontSize: 12 }}>Cadastre campanhas na aba <strong>Cadastro</strong>.</p>
      </div>
    )
  }

  const selectedCampaign = selected ? activeCampaigns.find(c => c.id === selected) : null
  const selectedStat = selected ? stats.find(s => s.id === selected) : null

  return (
    <div>
      <div className="camp-grid">
        {activeCampaigns.map((c, i) => {
          const s = stats[i]
          const progress = periodProgress(c.startDate, c.endDate)
          const isSelected = selected === c.id

          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`camp-panel-card${isSelected ? ' camp-panel-card-sel' : ''}`}
              onClick={() => setSelected(isSelected ? null : c.id)}
              onKeyDown={e => e.key === 'Enter' && setSelected(isSelected ? null : c.id)}
            >
              <div className="camp-card-header">
                <div className="camp-card-title">{c.name}</div>
                <span className="camp-brand-tag">{c.brand || '—'}</span>
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
                  <span className="camp-progress-label">{progress >= 100 ? 'Encerrada' : `${progress}% do período`}</span>
                </div>
              )}

              {s.noDate ? (
                <p className="camp-no-data">Defina as datas da campanha para ver os resultados.</p>
              ) : s.noBrandData ? (
                <p className="camp-no-data">Processe os motores de Produtos e Movimentações para ver resultados desta campanha.</p>
              ) : (
                <div className="camp-stats">
                  <div className="camp-stat">
                    <span className="camp-stat-val">{kpiCurrency(s.fat)}</span>
                    <span className="camp-stat-label">Faturado líq.</span>
                  </div>
                  {s.afat > 0 && (
                    <div className="camp-stat">
                      <span className="camp-stat-val">{kpiCurrency(s.afat)}</span>
                      <span className="camp-stat-label">A faturar</span>
                    </div>
                  )}
                  <div className="camp-stat">
                    <span className="camp-stat-val">{s.sellers}</span>
                    <span className="camp-stat-label">Vendedores</span>
                  </div>
                  <div className="camp-stat">
                    <span className="camp-stat-val">{s.clients}</span>
                    <span className="camp-stat-label">Clientes</span>
                  </div>
                </div>
              )}

              {c.mechanic && (
                <div className="camp-card-mechanic" style={{ fontSize: 11, marginTop: 8 }}>
                  {c.mechanic}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── detalhe ranking ────────────────────────────── */}
      {selectedCampaign && !selectedStat?.noBrandData && !selectedStat?.noDate && (
        <div className="camp-detail">
          <div className="camp-detail-header">
            <h3 style={{ margin: 0, fontSize: 13, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Ranking de vendedores — {selectedCampaign.name}
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {fmtDate(selectedCampaign.startDate)} → {fmtDate(selectedCampaign.endDate)}
            </span>
          </div>

          {sellerRanking.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '12px 0 0' }}>
              Sem movimentações encontradas neste período para a marca {selectedCampaign.brand}.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="gr-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vendedor</th>
                    <th className="n-right">Faturado líq.</th>
                    <th className="n-right">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerRanking.map(s => (
                    <tr key={s.code} className="gr-row">
                      <td style={{ color: 'var(--muted)', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 12 }}>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : s.rank}
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td className="n-right" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                        {kpiCurrency(s.fat)}
                      </td>
                      <td className="n-right" style={{ color: 'var(--muted)' }}>{s.clientCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── CampaignTab (entry point exported to App) ───────────── */
interface CampaignTabProps {
  movementBase: CanonicalMovement[]
  productBase: CanonicalProduct[]
}

export function CampaignTab({ movementBase, productBase }: CampaignTabProps) {
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
          ? <CampaignPanel movementBase={movementBase} productBase={productBase} />
          : <CampaignManager />}
      </section>
    </>
  )
}
