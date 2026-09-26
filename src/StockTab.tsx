import { useState, useEffect, useMemo, useRef } from 'react'
import type { CanonicalProduct } from './domain/productMotor'
import type { CanonicalReceipt } from './domain/receiptMotor'

type ProductTag = { launch?: boolean; pex?: boolean }
type Tags = Record<string, ProductTag>
type StockFilter = 'all' | 'com_estoque' | 'sem_estoque' | 'em_transito'

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const COMMERCIAL_LINES = ['Creme Dental', 'Esc + Enx + Fio', 'Sabonetes', 'Hair', 'Limpeza'] as const
type CommercialLine = (typeof COMMERCIAL_LINES)[number]

const FAMILY_TO_LINE: Record<string, CommercialLine> = {
  'CREME DENTAL': 'Creme Dental',
  'ESCOVA': 'Esc + Enx + Fio',
  'ENXAGUANTES': 'Esc + Enx + Fio',
  'FIO DENTAL': 'Esc + Enx + Fio',
  'SABONETE EM BARRA': 'Sabonetes',
  'SABONETE LÍQUIDO': 'Sabonetes',
  'SHAMPOO': 'Hair',
  'CONDICIONADOR': 'Hair',
  'LIMPEZA': 'Limpeza',
}

function classifyCommercialLine(description?: string, category?: string, subcategory?: string): CommercialLine | null {
  const up = (s?: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const sub = up(subcategory), cat = up(category), d = up(description)
  if (sub.includes('TOOTHPASTE')) return 'Creme Dental'
  if (sub.includes('MANUAL TB') || sub.includes('TOOTHBRUSH') || sub.includes('MOUTHWASH') || sub.includes('INTERDENTAL') || sub.includes('FLOSS')) return 'Esc + Enx + Fio'
  if (sub.includes('BAR SOAP') || sub.includes('LIQUID SOAP') || sub.includes('HAND SOAP') || sub.includes('BODY WASH')) return 'Sabonetes'
  if (sub.includes('SHAMPOO') || sub.includes('CONDITIONER') || sub.includes('HAIR')) return 'Hair'
  if (sub.includes('CLEAN') || sub.includes('LAUNDRY') || sub.includes('FABRIC')) return 'Limpeza'
  if (/^CD\b/.test(d) || d.includes('CREME DENTAL') || d.includes('DENTIFRICIO')) return 'Creme Dental'
  if (/^(ED|ENX|ENXAG|FITA DENT|FIO|GD)\b/.test(d) || d.includes('ESCOVA DENTAL') || d.includes('ENXAGUANTE') || d.includes('FIO DENTAL')) return 'Esc + Enx + Fio'
  if (/^SAB\b/.test(d) || d.includes('SABONETE')) return 'Sabonetes'
  if (/^(SH|COND|CR PENT|KIT SH)\b/.test(d) || d.includes('SHAMPOO') || d.includes('CONDICIONADOR')) return 'Hair'
  if (/^(PINHO SOL|LIMP|LAVA ROUPA|AJAX|DESINF|DESENG)\b/.test(d) || d.includes('LIMPADOR') || d.includes('DESINFETANTE')) return 'Limpeza'
  if (cat.includes('HOME CARE')) return 'Limpeza'
  return null
}

function resolveCommercialLine(p: { groupFamily?: string; description?: string; category?: string; subcategory?: string }): CommercialLine | null {
  if (p.groupFamily) {
    const fromFamily = FAMILY_TO_LINE[p.groupFamily]
    if (fromFamily) return fromFamily
  }
  return classifyCommercialLine(p.description, p.category, p.subcategory)
}

function resolveSubBrand(p: { subBrand?: string; description?: string; brand?: string; category?: string; subcategory?: string; productLine?: string }): string {
  if (p.subBrand) return p.subBrand
  const up = (s?: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const h = [p.description, p.brand, p.category, p.subcategory, p.productLine].filter(Boolean).map(v => up(v)).join(' ')
  if (/FIO DENTAL|DENTAL FLOSS/.test(h)) return 'Fio Dental'
  if (/ENXAG|MOUTHWASH/.test(h)) return 'Enxaguantes'
  if (/COLGATE.*TOTAL|\bCD TOTAL\b/.test(h)) return 'CD Total'
  if (/SORRISO/.test(h) && /ESCOVA|\bTB\b/.test(h)) return 'Escova Sorriso'
  if (/SORRISO/.test(h) && !/ESCOVA|\bTB\b/.test(h)) return 'Creme Sorriso'
  if (/LUMINOUS|TT12|NATURALS|PREMIUM/.test(h)) return 'CD Premium'
  if (/ESCOVA.*DENTAL|TOOTHBRUSH/.test(h)) return 'Escovas'
  if (/\bESCOVA\b/.test(h)) return 'Escovas'
  if (/AJAX/.test(h)) return 'Ajax'
  if (/PINHO SOL|\bPINHO\b/.test(h)) return 'Pinho Sol'
  if (/\bOLA\b/.test(h)) return 'Ola'
  if (/PROTEX/.test(h)) return 'Protex'
  if (/PALMOLIVE/.test(h) && /SHAMPOO|\bSH\b/.test(h)) return 'Shampoo Palmolive'
  if (/PALMOLIVE/.test(h) && /CONDICIONADOR|\bCOND\b/.test(h)) return 'Condicionador Palmolive'
  if (/PALMOLIVE/.test(h) && /SAB|SOAP/.test(h)) return 'Palmolive Sabonete'
  if (/PALMOLIVE/.test(h)) return 'Palmolive'
  if (/DARLING/.test(h) && /SHAMPOO|\bSH\b/.test(h)) return 'Shampoo Darling'
  if (/DARLING/.test(h) && /CONDICIONADOR|\bCOND\b/.test(h)) return 'Condicionador Darling'
  if (/DARLING/.test(h)) return 'Darling'
  if (/CONDICIONADOR|\bCOND\b/.test(h)) return 'Condicionador'
  if (/SHAMPOO|\bSH\b/.test(h)) return 'Shampoo'
  if (/CREME DENTAL|TOOTHPASTE|\bCD\b/.test(h)) return 'Creme Dental'
  if (/\bSAB\b|SABONETE|SOAP/.test(h)) return 'Sabonetes'
  if (/LIMPADOR|DESINFETANTE|DESINF|LIMP/.test(h)) return 'Limpeza'
  return '(sem sub-brand)'
}
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kpiCurrency = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`
  return `R$ ${brl(n)}`
}
const fmtDate = (iso?: string) => {
  if (!iso) return 'Sem data'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

const fmtWeight = (kg: number) => {
  if (kg <= 0) return null
  if (kg < 1) return `${Math.round(kg * 1000)}g`
  const s = kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
  return `${s}kg`
}

const normCh = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const isBlockedChannel = (ch: string) => {
  const n = normCh(ch)
  return n === 'clubs' || n.startsWith('ecommerce') || n === 'sortimentoatacados' || n === 'sortimentodistribuidores'
}

function loadTags(): Tags {
  try { return JSON.parse(localStorage.getItem('rj-product-tags') ?? '{}') }
  catch { return {} }
}

export function StockTab({ productBase, receiptBase }: {
  productBase: CanonicalProduct[]
  receiptBase: CanonicalReceipt[]
}) {
  const [subTab, setSubTab] = useState<'estoque' | 'produtos' | 'lancamentos'>('estoque')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<StockFilter>('all')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterMarcacao, setFilterMarcacao] = useState<'all' | 'mandatory' | 'important'>('all')
  const [selected, setSelected] = useState<CanonicalProduct | null>(null)
  const [tags, setTags] = useState<Tags>(loadTags)
  const [lncSearch, setLncSearch] = useState('')
  const [lncFilter, setLncFilter] = useState<'all' | 'launch' | 'pex'>('all')
  const [lncStatus, setLncStatus] = useState<StockFilter>('all')
  const [markup, setMarkup] = useState<number>(() => {
    try { return Number(localStorage.getItem('rj-markup-pct') ?? '0') || 0 }
    catch { return 0 }
  })
  const [covDays, setCovDays] = useState<[number, number]>(() => {
    try { return JSON.parse(localStorage.getItem('rj-cov-days') ?? 'null') ?? [30, 90] }
    catch { return [30, 90] }
  })
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = () => {
      try { setMarkup(Number(localStorage.getItem('rj-markup-pct') ?? '0') || 0) }
      catch { /* */ }
    }
    window.addEventListener('rj-markup-changed', handler)
    return () => window.removeEventListener('rj-markup-changed', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      try { setCovDays(JSON.parse(localStorage.getItem('rj-cov-days') ?? 'null') ?? [30, 90]) }
      catch { /* */ }
    }
    window.addEventListener('rj-covdays-changed', handler)
    return () => window.removeEventListener('rj-covdays-changed', handler)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('rj-product-tags', JSON.stringify(tags)) }
    catch { /* quota exceeded */ }
  }, [tags])

  const kpis = useMemo(() => {
    // Agrega carteira dos receipts em_transito (productCode = código fabricante / material)
    const transitByMfr = new Map<string, { qty: number; value: number }>()
    for (const r of receiptBase) {
      if (r.status !== 'em_transito' || !r.productCode) continue
      const cur = transitByMfr.get(r.productCode) ?? { qty: 0, value: 0 }
      transitByMfr.set(r.productCode, { qty: cur.qty + (r.quantity ?? 0), value: cur.value + (r.value ?? 0) })
    }

    let comEstoque = 0, semEstoque = 0, emTransito = 0, comPreco = 0
    let custoCusto = 0, custoVenda = 0, carteiraCusto = 0
    for (const p of productBase) {
      const avail = p.availableStock ?? 0
      if (avail > 0) {
        comEstoque++
        if (p.sellerPrice !== undefined) comPreco++
      } else semEstoque++
      // Trânsito: preferência pelo campo do produto (productMotor), fallback pelos receipts
      const tQty = (p.inTransitQuantity ?? 0) > 0
        ? (p.inTransitQuantity ?? 0)
        : (p.manufacturerCode ? transitByMfr.get(p.manufacturerCode)?.qty ?? 0 : 0)
      const tVal = (p.inTransitValue ?? 0) > 0
        ? (p.inTransitValue ?? 0)
        : (p.manufacturerCode ? transitByMfr.get(p.manufacturerCode)?.value ?? 0 : 0)
      if (tQty > 0) emTransito++
      const cost = p.realCost ?? p.financialCost
      if (cost !== undefined && avail > 0) custoCusto += avail * cost
      if (p.sellerPrice !== undefined && avail > 0) custoVenda += avail * p.sellerPrice
      carteiraCusto += tVal
    }
    const projetadoCusto = custoCusto + carteiraCusto
    const projetadoVenda = markup > 0 ? projetadoCusto * (1 + markup / 100) : null
    const pricedCoverage = comEstoque > 0 ? comPreco / comEstoque : null
    const marginRatio = custoVenda > 0 ? custoCusto / custoVenda : null
    const transitRatio = projetadoCusto > 0 ? carteiraCusto / projetadoCusto : null
    return { comEstoque, semEstoque, emTransito, comPreco, total: productBase.length, custoCusto, custoVenda, carteiraCusto, projetadoCusto, projetadoVenda, pricedCoverage, marginRatio, transitRatio }
  }, [productBase, receiptBase, markup])

  const coverageStats = useMemo(() => {
    const now = Date.now()
    // Taxa de reposição por internalCode a partir das entradas "atual" (têm productCode)
    const acc = new Map<string, { qty: number; firstMs: number }>()
    for (const r of receiptBase) {
      if (r.status !== 'recebida' || !r.productCode || !r.quantity || !r.entryDate) continue
      const ms = new Date(r.entryDate).getTime()
      if (!Number.isFinite(ms)) continue
      const cur = acc.get(r.productCode)
      if (!cur) acc.set(r.productCode, { qty: r.quantity, firstMs: ms })
      else { cur.qty += r.quantity; if (ms < cur.firstMs) cur.firstMs = ms }
    }
    const receiptRate = new Map<string, number>()
    for (const [c, s] of acc) {
      const span = Math.max(1, (now - s.firstMs) / 86_400_000)
      receiptRate.set(c, s.qty / span)
    }
    let critico = 0, adequado = 0, excesso = 0, semHistorico = 0
    const [low, high] = covDays
    for (const p of productBase) {
      const avail = p.availableStock ?? 0
      if (avail <= 0) { critico++; continue }
      // Fonte 1: dailyTurnover do Winthor (campo nativo, mais preciso)
      // Fonte 2: taxa de reposição derivada dos recebimentos com productCode
      const rate = (p.dailyTurnover && p.dailyTurnover > 0)
        ? p.dailyTurnover
        : (p.internalCode ? receiptRate.get(p.internalCode) : undefined)
      if (!rate) { semHistorico++; continue }
      const dias = avail / rate
      if (dias < low) critico++
      else if (dias <= high) adequado++
      else excesso++
    }
    const total = critico + adequado + excesso + semHistorico
    return { critico, adequado, excesso, semHistorico, total, hasHistory: total > semHistorico }
  }, [productBase, receiptBase, covDays])

  const treemapData = useMemo(() => {
    const lineMap = new Map<CommercialLine, Map<string, { value: number; items: number }>>()
    for (const p of productBase) {
      const line = resolveCommercialLine(p)
      if (!line) continue
      const sub = resolveSubBrand(p)
      const avail = p.availableStock ?? 0
      const val = avail > 0 && p.sellerPrice !== undefined ? avail * p.sellerPrice : 0
      if (!lineMap.has(line)) lineMap.set(line, new Map())
      const sm = lineMap.get(line)!
      const cur = sm.get(sub) ?? { value: 0, items: 0 }
      sm.set(sub, { value: cur.value + val, items: cur.items + 1 })
    }
    return COMMERCIAL_LINES
      .map(line => {
        const sm = lineMap.get(line)
        if (!sm) return null
        const tiles = Array.from(sm.entries())
          .map(([label, d]) => ({ key: label, label, ...d }))
          .filter(t => t.value > 0)
          .sort((a, b) => b.value - a.value)
        const totalValue = tiles.reduce((s, t) => s + t.value, 0)
        return { line, totalValue, subbrands: tiles.length, tiles }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.totalValue > 0)
  }, [productBase])

  const arrivalInvoices = useMemo(() => {
    const transit = receiptBase
      .filter(r => r.status === 'em_transito')
      .sort((a, b) => (a.entryDate ?? '').localeCompare(b.entryDate ?? ''))
    const groups = new Map<string, CanonicalReceipt[]>()
    for (const r of transit) {
      const key = r.invoice ?? `_${r.entryDate ?? ''}_${r.productCode ?? ''}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries()).map(([invoice, items]) => ({
      invoice,
      displayInvoice: items[0]?.invoice ?? 'Sem nota',
      items,
      date: items[0]?.entryDate,
      supplier: items[0]?.supplierName,
      totalQty: items.reduce((s, r) => s + (r.quantity ?? 0), 0),
      totalValue: items.reduce((s, r) => s + (r.value ?? 0), 0),
    }))
  }, [receiptBase])

  const arrivalBuckets = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const buckets = [
      { key: 'atrasadas', label: 'Atrasadas', count: 0, value: 0 },
      { key: 'ate7', label: 'Até 7 dias', count: 0, value: 0 },
      { key: 'ate15', label: '8 a 15 dias', count: 0, value: 0 },
      { key: 'mais16', label: '16+ dias', count: 0, value: 0 },
      { key: 'semdata', label: 'Sem previsão', count: 0, value: 0 },
    ]
    for (const inv of arrivalInvoices) {
      if (!inv.date) { buckets[4].count++; buckets[4].value += inv.totalValue; continue }
      const diff = Math.round((new Date(inv.date).setHours(0,0,0,0) - todayMs) / 86_400_000)
      if (diff < 0) { buckets[0].count++; buckets[0].value += inv.totalValue }
      else if (diff <= 7) { buckets[1].count++; buckets[1].value += inv.totalValue }
      else if (diff <= 15) { buckets[2].count++; buckets[2].value += inv.totalValue }
      else { buckets[3].count++; buckets[3].value += inv.totalValue }
    }
    return buckets
  }, [arrivalInvoices])

  const availableChannels = useMemo(() => {
    const seen = new Set<string>()
    for (const p of productBase)
      if (p.sortimentChannels)
        for (const ch of Object.keys(p.sortimentChannels)) seen.add(ch)
    return Array.from(seen).filter(ch => !isBlockedChannel(ch)).sort()
  }, [productBase])

  const filtered = useMemo(() => {
    const q = search.trim()
    return productBase.filter(p => {
      if (q) {
        const allDigits = /^\d+$/.test(q)
        const mixed = /[A-Za-z]/.test(q) && /\d/.test(q) && !q.includes(' ')
        if (allDigits) {
          if (q.length === 13) { if ((p.ean ?? '') !== q) return false }
          else if (q.length >= 7) { if (!(p.ean ?? '').endsWith(q)) return false }
          else {
            const byCode = (p.internalCode ?? '').startsWith(q)
            const byEan = q.length >= 4 && (p.ean ?? '').endsWith(q)
            if (!byCode && !byEan) return false
          }
        } else if (mixed) {
          if (!norm(p.manufacturerCode).startsWith(norm(q))) return false
        } else {
          const words = q.split(/\s+/).filter(Boolean).map(norm)
          if (!words.every(w => norm(p.description).includes(w))) return false
        }
      }
      if (filterStatus === 'com_estoque' && (p.availableStock ?? 0) <= 0) return false
      if (filterStatus === 'sem_estoque' && (p.availableStock ?? 0) > 0) return false
      if (filterStatus === 'em_transito' && (p.inTransitQuantity ?? 0) <= 0) return false
      if (filterChannel && (p.sortimentChannels?.[filterChannel] ?? 0) <= 0) return false
      if (filterMarcacao === 'mandatory' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 1)) return false
      if (filterMarcacao === 'important' && !Object.values(p.sortimentChannels ?? {}).some(v => v === 2)) return false
      return true
    })
  }, [productBase, search, filterStatus, filterChannel, filterMarcacao])

  const filteredLnc = useMemo(() => {
    const q = lncSearch.trim()
    return productBase.filter(p => {
      const t = tags[p.id]
      const isLaunch = !!t?.launch
      const isPex = !!t?.pex
      if (!isLaunch && !isPex) return false
      if (lncFilter === 'launch' && !isLaunch) return false
      if (lncFilter === 'pex' && !isPex) return false
      if (lncStatus === 'com_estoque' && (p.availableStock ?? 0) <= 0) return false
      if (lncStatus === 'sem_estoque' && (p.availableStock ?? 0) > 0) return false
      if (lncStatus === 'em_transito' && (p.inTransitQuantity ?? 0) <= 0) return false
      if (q) {
        const allDigits = /^\d+$/.test(q)
        const mixed = /[A-Za-z]/.test(q) && /\d/.test(q) && !q.includes(' ')
        if (allDigits) {
          if (q.length === 13) { if ((p.ean ?? '') !== q) return false }
          else { if (!(p.internalCode ?? '').startsWith(q) && !(p.ean ?? '').endsWith(q)) return false }
        } else if (mixed) {
          if (!norm(p.manufacturerCode).startsWith(norm(q))) return false
        } else {
          const words = q.split(/\s+/).filter(Boolean).map(norm)
          if (!words.every(w => norm(p.description).includes(w))) return false
        }
      }
      return true
    })
  }, [productBase, tags, lncSearch, lncFilter, lncStatus])

  const lncCounts = useMemo(() => {
    let launch = 0, pex = 0
    for (const p of productBase) {
      if (tags[p.id]?.launch) launch++
      if (tags[p.id]?.pex) pex++
    }
    return { launch, pex, total: launch + pex }
  }, [productBase, tags])

  const lastReceipt = useMemo(() => {
    if (!selected) return null
    return receiptBase
      .filter(r => r.productCode === selected.internalCode && r.status === 'recebida')
      .sort((a, b) => (b.entryDate ?? '').localeCompare(a.entryDate ?? ''))[0] ?? null
  }, [selected, receiptBase])

  function toggleTag(id: string, key: 'launch' | 'pex') {
    setTags(cur => {
      const prev = cur[id] ?? {}
      return { ...cur, [id]: { ...prev, [key]: !prev[key] } }
    })
  }

  const channelLevel = (v: number) => v === 1 ? 'Mandatório' : v === 2 ? 'Importante' : 'Fora'
  const channelClass = (v: number) => v === 1 ? 'ch-mandatory' : v === 2 ? 'ch-important' : 'ch-none'

  return (
    <>
      <header className="topbar stock-topbar">
        <button
          type="button"
          className={`stock-nav-btn${subTab === 'estoque' ? ' on' : ''}`}
          onClick={() => setSubTab('estoque')}
        >Estoque</button>
        <button
          type="button"
          className={`stock-nav-btn${subTab === 'produtos' ? ' on' : ''}`}
          onClick={() => setSubTab('produtos')}
        >Produtos</button>
        <button
          type="button"
          className={`stock-nav-btn${subTab === 'lancamentos' ? ' on' : ''}`}
          onClick={() => { setSubTab('lancamentos'); setSelected(null) }}
        >
          Lançamentos
          {lncCounts.total > 0 && <span className="nav-badge">{lncCounts.total}</span>}
        </button>
      </header>

      <section className="content">
        {subTab === 'estoque' ? (
          <>
            <div className="stock-kpis">
              <KpiCard
                label="Estoque a custo"
                value={kpis.custoCusto > 0 ? kpiCurrency(kpis.custoCusto) : '—'}
                percent={kpis.marginRatio !== null ? kpis.marginRatio * 100 : undefined}
                pctLabel={kpis.marginRatio !== null ? `${(kpis.marginRatio * 100).toFixed(0)}% do valor a venda` : 'Sem preço de venda'}
              />
              <KpiCard
                label="Estoque à venda"
                value={kpis.custoVenda > 0 ? kpiCurrency(kpis.custoVenda) : '—'}
                accent="green"
                percent={kpis.pricedCoverage !== null ? kpis.pricedCoverage * 100 : undefined}
                pctLabel={kpis.pricedCoverage !== null ? `${(kpis.pricedCoverage * 100).toFixed(0)}% dos SKUs com saldo têm preço` : 'Sem SKUs com saldo'}
              />
              <KpiCard
                label="Carteira em trânsito"
                value={kpis.carteiraCusto > 0 ? kpiCurrency(kpis.carteiraCusto) : '—'}
                accent="amber"
                percent={kpis.emTransito > 0 && kpis.total > 0 ? (kpis.emTransito / kpis.total) * 100 : undefined}
                pctLabel={kpis.emTransito > 0 ? `${kpis.emTransito.toLocaleString('pt-BR')} SKUs em trânsito` : 'Sem Carteira em aberto'}
              />
              <KpiCard
                label="Projetado a custo"
                value={kpis.projetadoCusto > 0 ? kpiCurrency(kpis.projetadoCusto) : '—'}
                percent={kpis.transitRatio !== null ? kpis.transitRatio * 100 : undefined}
                pctLabel={kpis.carteiraCusto > 0 ? `${kpiCurrency(kpis.carteiraCusto)} vêm da Carteira` : 'Sem entradas projetadas'}
              />
              <KpiCard
                label="Projetado à venda"
                value={kpis.projetadoVenda !== null ? kpiCurrency(kpis.projetadoVenda) : '—'}
                accent={kpis.projetadoVenda !== null ? 'green' : undefined}
                percent={markup > 0 ? Math.min(markup, 100) : undefined}
                pctLabel={markup === 0 ? 'Configure markup em Administração' : `markup ${markup.toLocaleString('pt-BR')}%`}
              />
            </div>

            <div className="stock-sku-overview">
              {/* Donut 1 — status físico */}
              <StockDonut
                segments={[
                  { value: kpis.comEstoque, color: 'var(--green)', label: 'Com estoque' },
                  { value: kpis.semEstoque, color: 'var(--red)', label: 'Sem estoque' },
                  ...(kpis.emTransito > 0 ? [{ value: kpis.emTransito, color: 'var(--amber)', label: 'Em trânsito' }] : []),
                ]}
                total={kpis.total}
                centerLabel="SKUs"
              />
              <div className="cov-divider" />
              {/* Donut 2 — cobertura de dias */}
              <StockDonut
                segments={coverageStats.hasHistory ? [
                  { value: coverageStats.critico, color: 'var(--red)', label: `Crítico  <${covDays[0]}d` },
                  { value: coverageStats.adequado, color: 'var(--green)', label: `Adequado  ${covDays[0]}–${covDays[1]}d` },
                  { value: coverageStats.excesso, color: 'var(--amber)', label: `Excesso  >${covDays[1]}d` },
                  ...(coverageStats.semHistorico > 0 ? [{ value: coverageStats.semHistorico, color: 'var(--border)', label: 'Sem histórico' }] : []),
                ] : [
                  { value: 1, color: 'var(--border)', label: 'Sem histórico de entradas' },
                ]}
                total={coverageStats.total || 1}
                centerLabel="Cobertura"
              />
              <div className="cov-divider" />
              {/* Donut 3 — saúde comercial: vendável vs sem preço vs ruptura */}
              {(() => {
                const semPreco = kpis.comEstoque - kpis.comPreco
                return (
                  <StockDonut
                    segments={[
                      { value: kpis.comPreco, color: 'var(--green)', label: 'Vendável' },
                      ...(semPreco > 0 ? [{ value: semPreco, color: 'var(--amber)', label: 'Sem preço' }] : []),
                      { value: kpis.semEstoque, color: 'var(--red)', label: 'Ruptura' },
                    ]}
                    total={kpis.total}
                    centerLabel="Comercial"
                  />
                )
              })()}
            </div>

            <StockTreemap data={treemapData} />

            <div className="arrivals-panel">
              <div className="arrivals-panel-head">
                <span className="arrivals-panel-label">Entradas previstas</span>
                <span className="arrivals-panel-total">
                  {arrivalInvoices.length > 0
                    ? `${arrivalInvoices.length} NF${arrivalInvoices.length !== 1 ? 's' : ''} · R$ ${brl(arrivalInvoices.reduce((s, i) => s + i.totalValue, 0))}`
                    : 'Sem carteira em aberto'}
                </span>
              </div>
              <div className="arrivals-buckets">
                {arrivalBuckets.map((b, idx) => (
                  <div key={b.key} className={`arrivals-bucket${b.key === 'atrasadas' && b.count > 0 ? ' is-late' : ''}`}>
                    {idx > 0 && <div className="arrivals-bucket-sep" />}
                    <div className="arrivals-bucket-label">{b.label}</div>
                    <div className="arrivals-bucket-count">
                      {b.count > 0
                        ? <><strong>{b.count}</strong> <span>NF{b.count !== 1 ? 's' : ''}</span></>
                        : <span className="arrivals-bucket-empty">—</span>}
                    </div>
                    {b.value > 0 && (
                      <div className="arrivals-bucket-value">R$ {brl(b.value)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : subTab === 'produtos' ? (
          <>
            <div className="stock-toolbar">
              <div className="pf-bar">
                <input
                  ref={searchRef}
                  className="pf-input"
                  placeholder="Buscar produto, EAN ou código interno…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="pf-select"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as StockFilter)}
                  aria-label="Filtrar situação"
                >
                  <option value="all">Todas as situações</option>
                  <option value="com_estoque">Com estoque</option>
                  <option value="sem_estoque">Sem estoque</option>
                  <option value="em_transito">Em trânsito</option>
                </select>
              </div>
              {availableChannels.length > 0 && (
                <fieldset className="pf-range">
                  <legend>Sortimento</legend>
                  <div>
                    <button type="button" className={filterChannel === '' ? 'is-active' : ''} onClick={() => setFilterChannel('')}>Todos</button>
                    {availableChannels.map(ch => (
                      <button key={ch} type="button" className={filterChannel === ch ? 'is-active' : ''} onClick={() => setFilterChannel(ch)}>{ch}</button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="pf-range">
                <legend>Marcação</legend>
                <div>
                  {(['all', 'mandatory', 'important'] as const).map(m => (
                    <button key={m} type="button" className={filterMarcacao === m ? 'is-active' : ''} onClick={() => setFilterMarcacao(m)}>
                      {m === 'all' ? 'Todos' : m === 'mandatory' ? 'Mandatório' : 'Importante'}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="stock-count">
              <strong>{filtered.length.toLocaleString('pt-BR')}</strong>{' '}
              produto{filtered.length !== 1 ? 's' : ''}
              {productBase.length !== filtered.length && ` de ${productBase.length.toLocaleString('pt-BR')}`}
            </div>

            <div className={`stock-layout${selected ? ' has-detail' : ''}`}>
              <div className="stock-list stock-list--estoque">
                <div className="stock-head">
                  <span className="sc-desc">Produto</span>
                  <span className="sc-num">Disponível</span>
                  <span className="sc-num sc-hide-sm">Preço sem ST</span>
                  <span className="sc-num">Preço com ST</span>
                </div>
                {filtered.length === 0 && (
                  <p className="empty" style={{ padding: '24px 16px' }}>Nenhum produto encontrado.</p>
                )}
                {filtered.map(p => {
                  const isSel = selected?.id === p.id
                  const avail = p.availableStock ?? 0
                  const availCx = p.unitsPerBox ? Math.floor(avail / p.unitsPerBox) : undefined
                  const semStCx = (p.sellerPriceWithoutTax !== undefined && p.unitsPerBox) ? p.sellerPriceWithoutTax * p.unitsPerBox : undefined
                  const comStCx = (p.sellerPrice !== undefined && p.unitsPerBox) ? p.sellerPrice * p.unitsPerBox : undefined
                  return (
                    <div
                      key={p.id}
                      className={`stock-row${isSel ? ' sel' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(isSel ? null : p)}
                      onKeyDown={e => e.key === 'Enter' && setSelected(isSel ? null : p)}
                    >
                      <span className="sc-desc">
                        <span className="p-name">{p.description ?? '—'}</span>
                        {(p.package || p.netWeightUnit !== undefined) && (
                          <span className="p-pkg-line">
                            {p.package && <span className="p-pack">{p.package}</span>}
                            {p.netWeightUnit !== undefined && fmtWeight(p.netWeightUnit) && (
                              <span className="p-weight">{fmtWeight(p.netWeightUnit)}</span>
                            )}
                          </span>
                        )}
                        <span className="p-meta">
                          {p.internalCode && <code>{p.internalCode}</code>}
                          {p.brand && <span>{p.brand}</span>}
                          {p.groupName && <span className="p-group">{p.groupName}</span>}
                          {tags[p.id]?.launch && <span className="badge-launch">Lançamento</span>}
                          {tags[p.id]?.pex && <span className="badge-pex">PEX</span>}
                        </span>
                      </span>
                      <span className="sc-num">
                        <span className="dual-val">
                          <strong className={avail > 0 ? 'c-green' : 'c-muted'}>{avail.toLocaleString('pt-BR')}</strong>
                          <small>UN</small>
                        </span>
                        {availCx !== undefined && (
                          <span className="dual-val">
                            <strong className={availCx > 0 ? 'c-green' : 'c-muted'}>{availCx.toLocaleString('pt-BR')}</strong>
                            <small>CX</small>
                          </span>
                        )}
                      </span>
                      <span className="sc-num sc-hide-sm">
                        {p.sellerPriceWithoutTax !== undefined ? <>
                          <span className="dual-val">
                            <strong>{`R$ ${brl(p.sellerPriceWithoutTax)}`}</strong>
                            <small>UN</small>
                          </span>
                          {semStCx !== undefined && (
                            <span className="dual-val">
                              <strong>{`R$ ${brl(semStCx)}`}</strong>
                              <small>CX</small>
                            </span>
                          )}
                        </> : <strong className="c-muted">—</strong>}
                      </span>
                      <span className="sc-num">
                        {p.sellerPrice !== undefined ? <>
                          <span className="dual-val">
                            <strong>{`R$ ${brl(p.sellerPrice)}`}</strong>
                            <small>UN</small>
                          </span>
                          {comStCx !== undefined && (
                            <span className="dual-val">
                              <strong>{`R$ ${brl(comStCx)}`}</strong>
                              <small>CX</small>
                            </span>
                          )}
                        </> : <strong className="c-muted">—</strong>}
                      </span>
                    </div>
                  )
                })}
              </div>

              {selected && (
                <aside className="stock-detail">
                  <div className="sd-header">
                    <div className="sd-title-area">
                      <h3 className="sd-name">{selected.description ?? '—'}</h3>
                      <div className="sd-codes">
                        {selected.internalCode && <span>Cód. <strong>{selected.internalCode}</strong></span>}
                        {selected.manufacturerCode && <span>Fab. <strong>{selected.manufacturerCode}</strong></span>}
                        {selected.ean && <span>EAN <strong>{selected.ean}</strong></span>}
                      </div>
                    </div>
                    <button type="button" className="close" onClick={() => setSelected(null)}>×</button>
                  </div>

                  <div className="sd-tags">
                    <button type="button" className={`tag-pill${tags[selected.id]?.launch ? ' tl' : ''}`} onClick={() => toggleTag(selected.id, 'launch')}>
                      {tags[selected.id]?.launch ? '★ Lançamento' : '☆ Lançamento'}
                    </button>
                    <button type="button" className={`tag-pill${tags[selected.id]?.pex ? ' tp' : ''}`} onClick={() => toggleTag(selected.id, 'pex')}>
                      {tags[selected.id]?.pex ? '★ PEX' : '☆ PEX'}
                    </button>
                  </div>

                  <div className="sd-section">
                    <div className="sd-section-title">Estoque</div>
                    <div className="sd-grid">
                      <DI label="Disponível" value={(selected.availableStock ?? 0).toLocaleString('pt-BR')} hi={(selected.availableStock ?? 0) > 0} />
                      <DI label="Total" value={(selected.totalStock ?? 0).toLocaleString('pt-BR')} />
                      <DI label="Reservado" value={(selected.reservedStock ?? 0).toLocaleString('pt-BR')} />
                      <DI label="Bloqueado" value={(selected.blockedStock ?? 0).toLocaleString('pt-BR')} />
                      {(selected.damagedStock ?? 0) > 0 && <DI label="Avariado" value={(selected.damagedStock ?? 0).toLocaleString('pt-BR')} />}
                      <DI label="Ind. em estoque" value={(selected.industryQuantity ?? 0).toLocaleString('pt-BR')} />
                    </div>
                  </div>

                  {(selected.inTransitQuantity ?? 0) > 0 && (
                    <div className="sd-section">
                      <div className="sd-section-title">Carteira (a chegar)</div>
                      <div className="sd-grid">
                        <DI label="Quantidade" value={(selected.inTransitQuantity ?? 0).toLocaleString('pt-BR')} hi />
                        <DI label="Valor" value={selected.inTransitValue !== undefined ? `R$ ${brl(selected.inTransitValue)}` : '—'} />
                      </div>
                    </div>
                  )}

                  {lastReceipt && (
                    <div className="sd-section">
                      <div className="sd-section-title">Última entrada</div>
                      <div className="sd-grid">
                        <DI label="Data" value={lastReceipt.entryDate ?? '—'} />
                        <DI label="Nota" value={lastReceipt.invoice ?? '—'} />
                        <DI label="Quantidade" value={(lastReceipt.quantity ?? 0).toLocaleString('pt-BR')} />
                        <DI label="Custo unit." value={lastReceipt.unitPrice !== undefined ? `R$ ${brl(lastReceipt.unitPrice)}` : '—'} />
                        <DI label="Fornecedor" value={lastReceipt.supplierName ?? '—'} />
                      </div>
                    </div>
                  )}

                  <div className="sd-section">
                    <div className="sd-section-title">Preços e custos</div>
                    <div className="sd-grid">
                      <DI label="Preço com ST" value={selected.sellerPrice !== undefined ? `R$ ${brl(selected.sellerPrice)}` : '—'} hi={selected.sellerPrice !== undefined} />
                      <DI label="Preço sem ST" value={selected.sellerPriceWithoutTax !== undefined ? `R$ ${brl(selected.sellerPriceWithoutTax)}` : '—'} />
                      <DI label="Custo financeiro" value={selected.financialCost !== undefined ? `R$ ${brl(selected.financialCost)}` : '—'} />
                      <DI label="Custo real" value={selected.realCost !== undefined ? `R$ ${brl(selected.realCost)}` : '—'} />
                      <DI label="Margem bruta" value={selected.margin !== undefined ? `${selected.margin.toFixed(1)}%` : '—'} hi={selected.margin !== undefined && selected.margin >= 30} />
                      <DI label="Giro diário" value={selected.dailyTurnover !== undefined ? selected.dailyTurnover.toString() : '—'} />
                      <DI label="Cobertura" value={selected.stockCoverage !== undefined ? `${selected.stockCoverage} dias` : '—'} />
                      {selected.industryBasePrice !== undefined && <DI label="Ref. indústria" value={`R$ ${brl(selected.industryBasePrice)}`} />}
                    </div>
                  </div>

                  <div className="sd-section">
                    <div className="sd-section-title">Sortimento</div>
                    <DI label="Status" value={selected.sortimentStatus ?? '—'} />
                    <DI label="Ciclo de vida" value={selected.lifestageStatus ?? '—'} />
                    {selected.sortimentChannels && Object.keys(selected.sortimentChannels).length > 0 && (
                      <div className="channel-grid" style={{ marginTop: 8 }}>
                        {Object.entries(selected.sortimentChannels)
                          .sort((a, b) => b[1] - a[1])
                          .map(([ch, lv]) => (
                            <div key={ch} className={`channel-item ${channelClass(lv)}`}>
                              <span className="ch-name">{ch}</span>
                              <span className="ch-level">{channelLevel(lv)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {(selected.category || selected.brand || selected.subBrand || selected.department) && (
                    <div className="sd-section">
                      <div className="sd-section-title">Classificação</div>
                      <div className="sd-grid">
                        {selected.brand && <DI label="Marca" value={selected.brand} />}
                        {selected.subBrand && <DI label="Sub-marca" value={selected.subBrand} />}
                        {selected.category && <DI label="Categoria" value={selected.category} />}
                        {selected.subcategory && <DI label="Subcategoria" value={selected.subcategory} />}
                        {selected.department && <DI label="Departamento" value={selected.department} />}
                        {selected.ncm && <DI label="NCM" value={selected.ncm} />}
                        {selected.taxClassification && <DI label="Tributação" value={selected.taxClassification} />}
                        {selected.buyer && <DI label="Comprador" value={selected.buyer} />}
                      </div>
                    </div>
                  )}

                  {selected.unitsPerBox && (
                    <div className="sd-section">
                      <div className="sd-section-title">Embalagem</div>
                      <div className="sd-grid">
                        <DI label="Un. por caixa" value={selected.unitsPerBox.toString()} />
                        {selected.boxesPerPallet !== undefined && <DI label="Cx. por palete" value={selected.boxesPerPallet.toString()} />}
                        {selected.grossWeightUnit !== undefined && <DI label="Peso bruto unit." value={`${selected.grossWeightUnit} kg`} />}
                        {selected.netWeightUnit !== undefined && <DI label="Peso líq. unit." value={`${selected.netWeightUnit} kg`} />}
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="stock-toolbar">
              <div className="pf-bar">
                <input
                  className="pf-input"
                  placeholder="Buscar produto, EAN ou código interno…"
                  value={lncSearch}
                  onChange={e => setLncSearch(e.target.value)}
                />
                <select
                  className="pf-select"
                  value={lncStatus}
                  onChange={e => setLncStatus(e.target.value as StockFilter)}
                  aria-label="Filtrar situação"
                >
                  <option value="all">Todas as situações</option>
                  <option value="com_estoque">Com estoque</option>
                  <option value="sem_estoque">Sem estoque</option>
                  <option value="em_transito">Em trânsito</option>
                </select>
              </div>
              <fieldset className="pf-range">
                <legend>Tipo</legend>
                <div>
                  <button type="button" className={lncFilter === 'all' ? 'is-active' : ''} onClick={() => setLncFilter('all')}>
                    Todos {lncCounts.total > 0 && `(${lncCounts.total})`}
                  </button>
                  <button type="button" className={lncFilter === 'launch' ? 'is-active' : ''} onClick={() => setLncFilter('launch')}>
                    Lançamentos {lncCounts.launch > 0 && `(${lncCounts.launch})`}
                  </button>
                  <button type="button" className={lncFilter === 'pex' ? 'is-active' : ''} onClick={() => setLncFilter('pex')}>
                    PEX {lncCounts.pex > 0 && `(${lncCounts.pex})`}
                  </button>
                </div>
              </fieldset>
            </div>

            <div className="stock-count">
              <strong>{filteredLnc.length.toLocaleString('pt-BR')}</strong>{' '}
              produto{filteredLnc.length !== 1 ? 's' : ''}
              {lncCounts.total !== filteredLnc.length && ` de ${lncCounts.total.toLocaleString('pt-BR')}`}
            </div>

            {lncCounts.total === 0 && (
              <p className="empty" style={{ padding: '40px 0', textAlign: 'center' }}>
                Nenhum produto marcado como Lançamento ou PEX.<br />
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Acesse a aba Produtos, selecione um item e use as marcações no painel lateral.</span>
              </p>
            )}

            {lncCounts.total > 0 && (
              <div className={`stock-layout${selected ? ' has-detail' : ''}`}>
                <div className="stock-list stock-list--estoque">
                  <div className="stock-head">
                    <span className="sc-desc">Produto</span>
                    <span className="sc-num">Disponível</span>
                    <span className="sc-num sc-hide-sm">Preço sem ST</span>
                    <span className="sc-num">Preço com ST</span>
                  </div>
                  {filteredLnc.length === 0 && (
                    <p className="empty" style={{ padding: '24px 16px' }}>Nenhum produto encontrado.</p>
                  )}
                  {filteredLnc.map(p => {
                    const isSel = selected?.id === p.id
                    const avail = p.availableStock ?? 0
                    const availCx = p.unitsPerBox ? Math.floor(avail / p.unitsPerBox) : undefined
                    const semStCx = (p.sellerPriceWithoutTax !== undefined && p.unitsPerBox) ? p.sellerPriceWithoutTax * p.unitsPerBox : undefined
                    const comStCx = (p.sellerPrice !== undefined && p.unitsPerBox) ? p.sellerPrice * p.unitsPerBox : undefined
                    return (
                      <div
                        key={p.id}
                        className={`stock-row${isSel ? ' sel' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(isSel ? null : p)}
                        onKeyDown={e => e.key === 'Enter' && setSelected(isSel ? null : p)}
                      >
                        <span className="sc-desc">
                          <span className="p-name">{p.description ?? '—'}</span>
                          {(p.package || p.netWeightUnit !== undefined) && (
                            <span className="p-pkg-line">
                              {p.package && <span className="p-pack">{p.package}</span>}
                              {p.netWeightUnit !== undefined && fmtWeight(p.netWeightUnit) && (
                                <span className="p-weight">{fmtWeight(p.netWeightUnit)}</span>
                              )}
                            </span>
                          )}
                          <span className="p-meta">
                            {p.internalCode && <code>{p.internalCode}</code>}
                            {p.brand && <span>{p.brand}</span>}
                            {p.groupName && <span className="p-group">{p.groupName}</span>}
                            {tags[p.id]?.launch && <span className="badge-launch">Lançamento</span>}
                            {tags[p.id]?.pex && <span className="badge-pex">PEX</span>}
                          </span>
                        </span>
                        <span className="sc-num">
                          <span className="dual-val">
                            <strong className={avail > 0 ? 'c-green' : 'c-muted'}>{avail.toLocaleString('pt-BR')}</strong>
                            <small>UN</small>
                          </span>
                          {availCx !== undefined && (
                            <span className="dual-val">
                              <strong className={availCx > 0 ? 'c-green' : 'c-muted'}>{availCx.toLocaleString('pt-BR')}</strong>
                              <small>CX</small>
                            </span>
                          )}
                        </span>
                        <span className="sc-num sc-hide-sm">
                          {p.sellerPriceWithoutTax !== undefined ? <>
                            <span className="dual-val">
                              <strong>{`R$ ${brl(p.sellerPriceWithoutTax)}`}</strong>
                              <small>UN</small>
                            </span>
                            {semStCx !== undefined && (
                              <span className="dual-val">
                                <strong>{`R$ ${brl(semStCx)}`}</strong>
                                <small>CX</small>
                              </span>
                            )}
                          </> : <strong className="c-muted">—</strong>}
                        </span>
                        <span className="sc-num">
                          {p.sellerPrice !== undefined ? <>
                            <span className="dual-val">
                              <strong>{`R$ ${brl(p.sellerPrice)}`}</strong>
                              <small>UN</small>
                            </span>
                            {comStCx !== undefined && (
                              <span className="dual-val">
                                <strong>{`R$ ${brl(comStCx)}`}</strong>
                                <small>CX</small>
                              </span>
                            )}
                          </> : <strong className="c-muted">—</strong>}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {selected && (
                  <aside className="stock-detail">
                    <div className="sd-header">
                      <div className="sd-title-area">
                        <h3 className="sd-name">{selected.description ?? '—'}</h3>
                        <div className="sd-codes">
                          {selected.internalCode && <span>Cód. <strong>{selected.internalCode}</strong></span>}
                          {selected.manufacturerCode && <span>Fab. <strong>{selected.manufacturerCode}</strong></span>}
                          {selected.ean && <span>EAN <strong>{selected.ean}</strong></span>}
                        </div>
                      </div>
                      <button type="button" className="close" onClick={() => setSelected(null)}>×</button>
                    </div>

                    <div className="sd-tags">
                      <button type="button" className={`tag-pill${tags[selected.id]?.launch ? ' tl' : ''}`} onClick={() => toggleTag(selected.id, 'launch')}>
                        {tags[selected.id]?.launch ? '★ Lançamento' : '☆ Lançamento'}
                      </button>
                      <button type="button" className={`tag-pill${tags[selected.id]?.pex ? ' tp' : ''}`} onClick={() => toggleTag(selected.id, 'pex')}>
                        {tags[selected.id]?.pex ? '★ PEX' : '☆ PEX'}
                      </button>
                    </div>

                    <div className="sd-section">
                      <div className="sd-section-title">Estoque</div>
                      <div className="sd-grid">
                        <DI label="Disponível" value={(selected.availableStock ?? 0).toLocaleString('pt-BR')} hi={(selected.availableStock ?? 0) > 0} />
                        <DI label="Total" value={(selected.totalStock ?? 0).toLocaleString('pt-BR')} />
                        <DI label="Reservado" value={(selected.reservedStock ?? 0).toLocaleString('pt-BR')} />
                        <DI label="Bloqueado" value={(selected.blockedStock ?? 0).toLocaleString('pt-BR')} />
                        {(selected.damagedStock ?? 0) > 0 && <DI label="Avariado" value={(selected.damagedStock ?? 0).toLocaleString('pt-BR')} />}
                        <DI label="Ind. em estoque" value={(selected.industryQuantity ?? 0).toLocaleString('pt-BR')} />
                      </div>
                    </div>

                    {(selected.inTransitQuantity ?? 0) > 0 && (
                      <div className="sd-section">
                        <div className="sd-section-title">Carteira (a chegar)</div>
                        <div className="sd-grid">
                          <DI label="Quantidade" value={(selected.inTransitQuantity ?? 0).toLocaleString('pt-BR')} hi />
                          <DI label="Valor" value={selected.inTransitValue !== undefined ? `R$ ${brl(selected.inTransitValue)}` : '—'} />
                        </div>
                      </div>
                    )}

                    {lastReceipt && (
                      <div className="sd-section">
                        <div className="sd-section-title">Última entrada</div>
                        <div className="sd-grid">
                          <DI label="Data" value={lastReceipt.entryDate ?? '—'} />
                          <DI label="Nota" value={lastReceipt.invoice ?? '—'} />
                          <DI label="Quantidade" value={(lastReceipt.quantity ?? 0).toLocaleString('pt-BR')} />
                          <DI label="Custo unit." value={lastReceipt.unitPrice !== undefined ? `R$ ${brl(lastReceipt.unitPrice)}` : '—'} />
                          <DI label="Fornecedor" value={lastReceipt.supplierName ?? '—'} />
                        </div>
                      </div>
                    )}

                    <div className="sd-section">
                      <div className="sd-section-title">Preços e custos</div>
                      <div className="sd-grid">
                        <DI label="Preço com ST" value={selected.sellerPrice !== undefined ? `R$ ${brl(selected.sellerPrice)}` : '—'} hi={selected.sellerPrice !== undefined} />
                        <DI label="Preço sem ST" value={selected.sellerPriceWithoutTax !== undefined ? `R$ ${brl(selected.sellerPriceWithoutTax)}` : '—'} />
                        <DI label="Custo financeiro" value={selected.financialCost !== undefined ? `R$ ${brl(selected.financialCost)}` : '—'} />
                        <DI label="Custo real" value={selected.realCost !== undefined ? `R$ ${brl(selected.realCost)}` : '—'} />
                        <DI label="Margem bruta" value={selected.margin !== undefined ? `${selected.margin.toFixed(1)}%` : '—'} hi={selected.margin !== undefined && selected.margin >= 30} />
                        <DI label="Giro diário" value={selected.dailyTurnover !== undefined ? selected.dailyTurnover.toString() : '—'} />
                        <DI label="Cobertura" value={selected.stockCoverage !== undefined ? `${selected.stockCoverage} dias` : '—'} />
                        {selected.industryBasePrice !== undefined && <DI label="Ref. indústria" value={`R$ ${brl(selected.industryBasePrice)}`} />}
                      </div>
                    </div>

                    <div className="sd-section">
                      <div className="sd-section-title">Sortimento</div>
                      <DI label="Status" value={selected.sortimentStatus ?? '—'} />
                      <DI label="Ciclo de vida" value={selected.lifestageStatus ?? '—'} />
                      {selected.sortimentChannels && Object.keys(selected.sortimentChannels).length > 0 && (
                        <div className="channel-grid" style={{ marginTop: 8 }}>
                          {Object.entries(selected.sortimentChannels)
                            .sort((a, b) => b[1] - a[1])
                            .map(([ch, lv]) => (
                              <div key={ch} className={`channel-item ${channelClass(lv)}`}>
                                <span className="ch-name">{ch}</span>
                                <span className="ch-level">{channelLevel(lv)}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {(selected.category || selected.brand || selected.subBrand || selected.department) && (
                      <div className="sd-section">
                        <div className="sd-section-title">Classificação</div>
                        <div className="sd-grid">
                          {selected.brand && <DI label="Marca" value={selected.brand} />}
                          {selected.subBrand && <DI label="Sub-marca" value={selected.subBrand} />}
                          {selected.category && <DI label="Categoria" value={selected.category} />}
                          {selected.subcategory && <DI label="Subcategoria" value={selected.subcategory} />}
                          {selected.department && <DI label="Departamento" value={selected.department} />}
                          {selected.ncm && <DI label="NCM" value={selected.ncm} />}
                          {selected.taxClassification && <DI label="Tributação" value={selected.taxClassification} />}
                          {selected.buyer && <DI label="Comprador" value={selected.buyer} />}
                        </div>
                      </div>
                    )}

                    {selected.unitsPerBox && (
                      <div className="sd-section">
                        <div className="sd-section-title">Embalagem</div>
                        <div className="sd-grid">
                          <DI label="Un. por caixa" value={selected.unitsPerBox.toString()} />
                          {selected.boxesPerPallet !== undefined && <DI label="Cx. por palete" value={selected.boxesPerPallet.toString()} />}
                          {selected.grossWeightUnit !== undefined && <DI label="Peso bruto unit." value={`${selected.grossWeightUnit} kg`} />}
                          {selected.netWeightUnit !== undefined && <DI label="Peso líq. unit." value={`${selected.netWeightUnit} kg`} />}
                        </div>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

const LINE_HUES = [351, 207, 148, 272, 38]
function tileBg(lineIdx: number, tileIdx: number): string {
  const hue = LINE_HUES[lineIdx % LINE_HUES.length]!
  const shift = (tileIdx % 4) * 4
  return `linear-gradient(145deg, hsl(${hue} ${58 - shift}% ${32 + shift}% / .98), hsl(${hue + 10} ${48 - shift}% ${22 + shift}% / .99))`
}

function squarifiedLayout(
  items: Array<{ id: string; value: number }>,
  x: number, y: number, w: number, h: number
): Array<{ id: string; x: number; y: number; w: number; h: number }> {
  if (items.length === 0) return []
  if (items.length === 1) return [{ id: items[0].id, x, y, w, h }]
  const total = items.reduce((s, it) => s + it.value, 0)
  if (total === 0) return []
  let acc = 0
  const half = total / 2
  let split = items.length - 1
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value
    if (acc >= half) { split = i + 1; break }
  }
  const first = items.slice(0, split)
  const rest = items.slice(split)
  const frac = first.reduce((s, it) => s + it.value, 0) / total
  if (w >= h) {
    return [...squarifiedLayout(first, x, y, w * frac, h), ...squarifiedLayout(rest, x + w * frac, y, w * (1 - frac), h)]
  }
  return [...squarifiedLayout(first, x, y, w, h * frac), ...squarifiedLayout(rest, x, y + h * frac, w, h * (1 - frac))]
}

function StockTreemap({ data }: {
  data: Array<{ line: string; totalValue: number; subbrands: number; tiles: Array<{ key: string; label: string; value: number }> }>
}) {
  const totalAll = data.reduce((s, g) => s + g.totalValue, 0)
  const pct = (n: number, t: number) => t > 0 ? `${((n / t) * 100).toFixed(1)}%` : '—'
  if (data.length === 0) return (
    <div className="stock-treemap-empty">Sem estoque valorizado por linha. Configure grupos de produto e sub-brands.</div>
  )
  return (
    <div className="stock-treemap-section">
      <div className="stock-treemap-header">
        <span className="stock-treemap-eyebrow">Estoque por linha</span>
        <span className="stock-treemap-title">Composição por sub-brand</span>
      </div>
      <div className="stock-line-list">
        {data.map((group, lineIdx) => {
          const rects = squarifiedLayout(group.tiles.map(t => ({ id: t.key, value: t.value })), 0, 0, 100, 100)
          const rectMap = new Map(rects.map(r => [r.id, r]))
          return (
            <section key={group.line} className="stock-line-card" data-hue={lineIdx % 5}>
              <header className="stock-line-head">
                <strong>{group.line}</strong>
                <span>{kpiCurrency(group.totalValue)}</span>
                <small>{group.subbrands} sub-brand{group.subbrands !== 1 ? 's' : ''} · {pct(group.totalValue, totalAll)} do estoque</small>
              </header>
              <div className="stock-line-body">
                <div className="stock-subbrand-treemap">
                  {group.tiles.map((tile, tileIdx) => {
                    const rect = rectMap.get(tile.key)
                    if (!rect) return null
                    const label = `${tile.label}: ${kpiCurrency(tile.value)} · ${pct(tile.value, group.totalValue)}`
                    return (
                      <div key={tile.key} className="stock-tile" title={label}
                        style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`, background: tileBg(lineIdx, tileIdx) }}>
                        <strong>{tile.label}</strong>
                        <span>{kpiCurrency(tile.value)}</span>
                        <small>{pct(tile.value, group.totalValue)}</small>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent, sub, percent, pctLabel }: {
  label: string; value: string; accent?: 'green' | 'red' | 'amber'; sub?: string;
  percent?: number; pctLabel?: string
}) {
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {(pctLabel || sub) && <div className="kpi-pct">{pctLabel ?? sub}</div>}
      </div>
      <div className="kpi-bar">
        <div className="kpi-bar-fill" style={{ width: percent !== undefined ? `${Math.min(100, percent)}%` : '0%' }} />
      </div>
    </div>
  )
}

function StockDonut({ segments, total, centerLabel }: {
  segments: Array<{ value: number; color: string; label: string }>
  total: number
  centerLabel?: string
}) {
  const r = 48, cx = 60, cy = 60
  const circ = 2 * Math.PI * r
  const gap = 3
  let offset = 0
  const arcs = segments.map(seg => {
    const dash = Math.max(0, (seg.value / total) * circ - gap)
    const arc = { ...seg, dash, offset }
    offset += (seg.value / total) * circ
    return arc
  })
  return (
    <div className="stock-donut-wrap">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 120 120">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {arcs.map((arc, i) => arc.dash > 0 && (
              <circle key={i} cx={cx} cy={cy} r={r}
                fill="none" stroke={arc.color} strokeWidth="12"
                strokeDasharray={`${arc.dash} ${circ}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="round"
              />
            ))}
          </g>
        </svg>
        <div className="donut-center">
          <span className="donut-center-val">{total.toLocaleString('pt-BR')}</span>
          <span className="donut-center-label">{centerLabel ?? 'SKUs'}</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map(s => (
          <div key={s.label} className="donut-leg-item">
            <span className="donut-leg-dot" style={{ background: s.color }} />
            <span className="donut-leg-label">{s.label}</span>
            <span className="donut-leg-val" style={{ color: s.color }}>{s.value.toLocaleString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DI({ label, value, hi }: { label: string; value: string; hi?: boolean }) {
  return (
    <div className="di">
      <span className="di-label">{label}</span>
      <strong className={hi ? 'c-green' : ''}>{value}</strong>
    </div>
  )
}
