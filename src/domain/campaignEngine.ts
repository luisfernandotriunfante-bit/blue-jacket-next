import type { CanonicalMovement } from './movementMotor'
import type { CanonicalProduct } from './productMotor'
import type { CanonicalClient } from './clientMotor'
import type { RcaRecord } from '../RcaManager'

/* ── Campaign types ──────────────────────────────────────── */
export type CampaignType =
  | 'mix_skus'             // Positivação por lista de SKUs (Mix Obrigatório)
  | 'valor_eans'           // Valor mínimo comprando EANs específicos (Pinho Sol)
  | 'cota'                 // Meta do vendedor (Acelere e Ganhe)
  | 'vizinhanca_qtd'       // Quantidade por categoria (Regime OC)
  | 'vizinhanca_familias'  // Número de famílias (Desconto Progressivo)
  | 'vizinhanca_hair'      // SKUs Hair por patamar (Transição Hair)
  | 'meta_cnpj'            // Meta de SKUs novos por CNPJ (Underfill)
  | 'custom'               // Personalizado — configura qualquer mecânica via parâmetros

export interface PrizeLevel {
  vendedor: number
  supervisor: number
  gerente: number
}

/* ── Type-specific config ────────────────────────────────── */
export interface MixSkusConfig {
  type: 'mix_skus'
  mandatoryCodes: string[]   // códigos que obrigatoriamente devem estar no pedido
  optionalCodes: string[]    // outros SKUs que contam para o total
  minSkus: number            // total mínimo necessário (ex.: 17)
  windowMonths: number       // 1 = só mês atual, 3 = mês + 2 anteriores
  validCnpjs: string[]       // lista de CNPJs válidos (vazio = todos)
  prize: PrizeLevel
}

export interface ValorEansConfig {
  type: 'valor_eans'
  productCodes: string[]     // EANs ou codes obrigatórios
  requireAllCodes: boolean   // true = precisa de todos os EANs
  minValue: number           // valor mínimo R$ somado dos EANs
  windowMonths: number
  validCnpjs: string[]
  prize: PrizeLevel
}

export interface CotaConfig {
  type: 'cota'
  day20Threshold: number     // % da meta necessária até dia 20 (ex.: 70)
  prizeTiers: Array<{ maxGoal: number; prize: number }> // última tier sem maxGoal = "acima de"
  supervisorPrize: number
  gerentePrize: number
}

export interface VizinhancaQtdConfig {
  type: 'vizinhanca_qtd'
  faixas: number[]           // ex.: [4, 5]
  perfis: string[]           // ex.: ['varejo']
  categoryRequirements: Array<{ category: string; min: number }> // ex.: [{category:'creme dental',min:12}]
  prize: PrizeLevel
}

export interface VizinhancaFamiliasConfig {
  type: 'vizinhanca_familias'
  faixas: number[]
  perfis: string[]
  mandatoryFamilies: string[]  // ex.: ['CD Total','Escova Colgate','Enxaguante']
  minFamilies: number
  prize: PrizeLevel
}

export interface VizinhancaHairConfig {
  type: 'vizinhanca_hair'
  faixas: number[]
  perfis: string[]
  tiers: Array<{ minSkus: number; prize: number }> // ex.: [{minSkus:15,prize:20},{minSkus:25,prize:50}]
  supervisorMultiplier: number   // ex.: 0.5 = metade do prêmio do vendedor
  gerenteMultiplier: number
}

export interface MetaCnpjConfig {
  type: 'meta_cnpj'
  productCodes: string[]
  // goalByCnpj: Record<cnpj, goal> — goals pasted by user as "cnpj:goal" lines
  goalByCnpj: Record<string, number>
  prize: PrizeLevel
}

/* ── Tipo personalizado (genérico) ───────────────────────── */
export interface CustomConfig {
  type: 'custom'

  // Escopo
  productCodes: string[]        // vazio = todos
  mandatoryCodes: string[]      // subset de productCodes que devem estar presentes
  validCnpjs: string[]          // vazio = todos
  faixas: number[]              // vazio = todas
  perfis: string[]              // vazio = todos
  windowMonths: number          // 1 = mês atual; N = janela backward a partir de endDate

  // Qualificação
  unit: 'pdv' | 'seller'
  metric: 'sku_count' | 'value' | 'family_count' | 'qty_by_category' | 'seller_goal_pct'
  threshold: number             // min SKUs, min R$, min famílias ou % meta
  categoryRequirements: Array<{ category: string; min: number }>
  mandatoryFamilies: string[]
  day20Threshold: number        // informativo (seller_goal_pct)
  goalByCnpj: Record<string, number>  // sobrescreve threshold por CNPJ

  // Prêmio
  prizeType: 'flat' | 'tiered_metric' | 'tiered_goal'
  prize: PrizeLevel                                           // flat
  metricTiers: Array<{ minValue: number; prize: number }>    // tiered_metric
  goalTiers: Array<{ maxGoal: number; prize: number }>       // tiered_goal
  supervisorPrize: number
  gerentePrize: number
  supervisorMultiplier: number   // se > 0 usa em vez de supervisorPrize/prize.supervisor
  gerenteMultiplier: number
}

export type CampaignConfig =
  | MixSkusConfig
  | ValorEansConfig
  | CotaConfig
  | VizinhancaQtdConfig
  | VizinhancaFamiliasConfig
  | VizinhancaHairConfig
  | MetaCnpjConfig
  | CustomConfig

/* ── CampaignRecord (full) ───────────────────────────────── */
export interface CampaignRecord {
  id: string
  name: string
  brand: string
  startDate: string
  endDate: string
  status: 'active' | 'inactive'
  notes: string
  config: CampaignConfig
}

/* ── Apuration result ────────────────────────────────────── */
export interface SellerResult {
  sellerCode: string
  sellerName: string
  supervisorCode: string
  supervisorName: string
  qualifiedPdvs: number
  prizeVendedor: number
  prizeSupervisor: number
  prizeGerente: number
  totalPrize: number
  details: PdvDetail[]
  /** 0..1+ — melhor PDV como fração do critério (ex.: 0.8 = 80% do mínimo de SKUs) */
  bestPdvProgress?: number
  /** Soma do valor de compra de todos os PDVs do vendedor (desempate) */
  totalValue?: number
}

export interface PdvDetail {
  customerCode: string
  customerName: string
  value?: number
  skuCount?: number
  qualified: boolean
  reason?: string
  /** 0..100+ — percentual do critério atingido neste PDV */
  progressPct?: number
}

export interface ApurationDiagnostic {
  movementsInWindow: number
  movementsMatched: number
  pdvsFound: number
  /** Primeiros códigos que a campanha procurou nas movimentações */
  campaignCodesSample?: string[]
  /** Primeiros productCode das movimentações na janela */
  movementCodesSample?: string[]
  /** true quando os códigos da campanha parecem EAN (13 dígitos) mas a base de produtos não foi importada */
  eanWithoutProductBase?: boolean
}

export interface ApurationGoal {
  metric: 'sku_count' | 'value'
  target: number
}

export interface ApurationResult {
  campaignId: string
  campaignName: string
  totalPdvs: number
  totalPrize: number
  sellers: SellerResult[]
  diagnostic?: ApurationDiagnostic
  goal?: ApurationGoal
}

/* ── helpers ─────────────────────────────────────────────── */
function parseDate(iso: string) {
  return new Date(iso + 'T00:00:00')
}

function isInWindow(movDate: string | undefined, startDate: string, endDate: string) {
  if (!movDate) return false
  return movDate >= startDate && movDate <= endDate
}

/** Expand window backwards by N months (ISO dates) */
function expandStart(endDate: string, windowMonths: number): string {
  if (windowMonths <= 1) return endDate.slice(0, 7) + '-01'
  const d = parseDate(endDate)
  d.setMonth(d.getMonth() - (windowMonths - 1))
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function fmtCnpj(raw: string) {
  return raw.replace(/\D/g, '')
}

/* ── lookup helpers ──────────────────────────────────────── */
function buildProductCodeSet(productCodes: string[]) {
  return new Set(productCodes.map(c => c.trim().toUpperCase()))
}

function buildCnpjSet(cnpjs: string[]) {
  return new Set(cnpjs.map(fmtCnpj).filter(Boolean))
}

/** EAN / manufacturerCode → Winthor internalCode */
function buildEanToWinthorMap(productBase: CanonicalProduct[]) {
  const m = new Map<string, string>()
  for (const p of productBase) {
    if (!p.internalCode) continue
    const winthor = p.internalCode.toUpperCase()
    if (p.ean) m.set(p.ean.toUpperCase(), winthor)
    if (p.manufacturerCode) m.set(p.manufacturerCode.toUpperCase(), winthor)
  }
  return m
}

/** Normalize a code the same way the movement motor does (strips leading zeros, .0 suffix, spaces) */
function normalizeCode(raw: string): string {
  return raw.replace(/\s/g, '').replace(/\.0$/, '').replace(/^0+(?=\d)/, '').toUpperCase()
}

/** Expand a list of codes: each entry is kept as-is AND normalized AND resolved via EAN/manufacturer → Winthor */
function resolveProductCodes(codes: string[], eanMap: Map<string, string>): Set<string> {
  const result = new Set<string>()
  for (const c of codes) {
    const raw = c.trim()
    if (!raw) continue
    const upper = raw.toUpperCase()
    const norm = normalizeCode(raw)
    result.add(upper)
    if (norm && norm !== upper) result.add(norm)
    const resolved = eanMap.get(upper) ?? eanMap.get(norm)
    if (resolved) result.add(resolved)
  }
  return result
}

/** productCode → category (from productBase) */
function buildCategoryMap(productBase: CanonicalProduct[]) {
  const m = new Map<string, string>()
  for (const p of productBase) {
    if (p.internalCode && p.category) m.set(p.internalCode.toUpperCase(), p.category.toLowerCase())
  }
  return m
}

/** productCode → product line / family (description keyword) */
function buildFamilyMap(productBase: CanonicalProduct[]) {
  const m = new Map<string, string>()
  for (const p of productBase) {
    if (p.internalCode && p.productLine) m.set(p.internalCode.toUpperCase(), p.productLine.toLowerCase())
    else if (p.internalCode && p.description) m.set(p.internalCode.toUpperCase(), p.description.toLowerCase())
  }
  return m
}

/** clientCode → {faixa, perfil, cnpj, document} */
function buildClientMap(clientBase: CanonicalClient[]) {
  const m = new Map<string, { faixa: string; perfil: string; cnpj: string }>()
  for (const c of clientBase) {
    const key = c.winthorCode ?? c.document ?? ''
    if (!key) continue
    m.set(key, {
      faixa: c.premiseRange ?? '',
      perfil: c.premiseProfile ?? '',
      cnpj: fmtCnpj(c.document ?? ''),
    })
  }
  return m
}

/** rcaCode → {goal, supervisor, supervisorCode} */
function buildRcaMap(rcas: RcaRecord[]) {
  const m = new Map<string, RcaRecord>()
  for (const r of rcas) m.set(r.code, r)
  return m
}

/* ── filter movements for a campaign window ─────────────── */
function getWindowedMovements(
  movements: CanonicalMovement[],
  startDate: string,
  endDate: string,
  types: CanonicalMovement['movementType'][] = ['venda_faturada', 'a_faturar']
) {
  return movements.filter(m =>
    m.movementDate && isInWindow(m.movementDate, startDate, endDate) &&
    types.includes(m.movementType)
  )
}

/* ══════════════════════════════════════════════════════════
   APURATION ENGINES
══════════════════════════════════════════════════════════ */

/* ── Mix de SKUs ─────────────────────────────────────────── */
function apurateMixSkus(
  cfg: MixSkusConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  productBase: CanonicalProduct[],
  rcas: RcaRecord[]
): ApurationResult {
  const windowStart = expandStart(campaign.endDate || new Date().toISOString().slice(0, 10), cfg.windowMonths)
  const windowEnd = campaign.endDate || new Date().toISOString().slice(0, 10)
  const eanMap = buildEanToWinthorMap(productBase)
  const mandatorySet = resolveProductCodes(cfg.mandatoryCodes, eanMap)
  const optionalSet = resolveProductCodes(cfg.optionalCodes, eanMap)
  const allCodes = new Set([...mandatorySet, ...optionalSet])
  const validCnpjs = buildCnpjSet(cfg.validCnpjs)
  const rcaMap = buildRcaMap(rcas)

  const filtered = getWindowedMovements(movements, windowStart, windowEnd)

  // Detect if campaign codes look like EANs (13 numeric digits) but product base wasn't imported
  const isEanLike = (c: string) => /^\d{13}$/.test(c.replace(/\s/g, ''))
  const allRawCodes = [...cfg.mandatoryCodes, ...cfg.optionalCodes].map(c => c.trim()).filter(Boolean)
  const eanWithoutProductBase = allRawCodes.length > 0
    && allRawCodes.some(isEanLike)
    && productBase.length === 0

  if (import.meta.env.DEV) {
    console.debug('[CampaignEngine] mix_skus:', campaign.name, {
      window: `${windowStart} → ${windowEnd}`,
      movementsInWindow: filtered.length,
      allCodesSize: allCodes.size,
      allCodesSample: [...allCodes].slice(0, 20),
      movementCodeSample: filtered.slice(0, 10).map(m => ({ productCode: m.productCode, manufacturerCode: m.manufacturerCode })),
      eanWithoutProductBase,
    })
  }

  type PdvEntry = { name: string; codes: Set<string>; value: number; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()
  let movementsMatched = 0

  for (const m of filtered) {
    const code = m.productCode?.toUpperCase()
    if (!code) continue
    const mfr = m.manufacturerCode?.toUpperCase()
    if (allCodes.size > 0 && !allCodes.has(code) && !(mfr && allCodes.has(mfr))) continue
    const cust = m.customerCode ?? ''; if (!cust) continue
    if (validCnpjs.size > 0 && !validCnpjs.has(cust) && !validCnpjs.has(fmtCnpj(m.customerCode ?? ''))) continue

    movementsMatched++
    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, codes: new Set(), value: 0, sellerCode: seller })
    const e = custMap.get(cust)!
    e.codes.add(code)
    e.value += m.value ?? 0
  }

  const pdvsFound = [...bySellerCustomer.values()].reduce((s, m) => s + m.size, 0)

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0

    for (const [custCode, entry] of custMap) {
      const hasMandatory = cfg.mandatoryCodes.length === 0 ||
        [...mandatorySet].every(c => entry.codes.has(c))
      const totalSkus = entry.codes.size
      const qualified = hasMandatory && totalSkus >= cfg.minSkus
      const progressPct = cfg.minSkus > 0 ? Math.round((totalSkus / cfg.minSkus) * 100) : (qualified ? 100 : 0)

      if (qualified) qualifiedPdvs++
      details.push({
        customerCode: custCode, customerName: entry.name,
        skuCount: totalSkus, value: entry.value, qualified, progressPct,
        reason: qualified ? undefined : !hasMandatory ? 'Mandatórios faltando' : `${totalSkus}/${cfg.minSkus} SKUs`,
      })
    }

    details.sort((a, b) => (b.progressPct - a.progressPct) || (b.value ?? 0) - (a.value ?? 0))
    const bestPdvProgress = details.length > 0 ? (details[0].progressPct / 100) : 0
    const totalValue = details.reduce((s, d) => s + (d.value ?? 0), 0)
    const prizeV = qualifiedPdvs * cfg.prize.vendedor
    const prizeS = qualifiedPdvs * cfg.prize.supervisor
    const prizeG = qualifiedPdvs * cfg.prize.gerente
    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: prizeV + prizeS + prizeG, details, bestPdvProgress, totalValue,
    })
  }

  sellers.sort((a, b) =>
    b.qualifiedPdvs - a.qualifiedPdvs ||
    b.bestPdvProgress - a.bestPdvProgress ||
    b.totalValue - a.totalValue
  )
  const totalPrize = sellers.reduce((s, r) => s + r.prizeVendedor, 0)
  return {
    campaignId: campaign.id, campaignName: campaign.name,
    totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0), totalPrize, sellers,
    diagnostic: {
      movementsInWindow: filtered.length, movementsMatched, pdvsFound,
      campaignCodesSample: [...allCodes].slice(0, 15),
      movementCodesSample: [...new Set(filtered.map(m => m.productCode).filter(Boolean))].slice(0, 15) as string[],
      eanWithoutProductBase,
    },
    goal: { metric: 'sku_count', target: cfg.minSkus },
  }
}

/* ── Valor + EANs ────────────────────────────────────────── */
function apurateValorEans(
  cfg: ValorEansConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  productBase: CanonicalProduct[],
  rcas: RcaRecord[]
): ApurationResult {
  const windowStart = expandStart(campaign.endDate || new Date().toISOString().slice(0, 10), cfg.windowMonths)
  const windowEnd = campaign.endDate || new Date().toISOString().slice(0, 10)
  const eanMap = buildEanToWinthorMap(productBase)
  const codeSet = resolveProductCodes(cfg.productCodes, eanMap)
  const validCnpjs = buildCnpjSet(cfg.validCnpjs)
  const rcaMap = buildRcaMap(rcas)

  const filtered = getWindowedMovements(movements, windowStart, windowEnd, ['venda_faturada', 'devolucao'])

  type PdvEntry = { name: string; value: number; codes: Set<string>; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  for (const m of filtered) {
    const code = m.productCode?.toUpperCase()
    if (!code || !codeSet.has(code)) continue
    const cust = m.customerCode ?? ''; if (!cust) continue
    if (validCnpjs.size > 0 && !validCnpjs.has(cust)) continue

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, value: 0, codes: new Set(), sellerCode: seller })
    const e = custMap.get(cust)!
    e.value += m.value ?? 0
    if (m.movementType === 'venda_faturada') e.codes.add(code)
  }

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0

    for (const [custCode, entry] of custMap) {
      const hasAllCodes = !cfg.requireAllCodes || [...codeSet].every(c => entry.codes.has(c))
      const qualified = hasAllCodes && entry.value >= cfg.minValue
      const progressPct = cfg.minValue > 0 ? Math.round((entry.value / cfg.minValue) * 100) : (qualified ? 100 : 0)

      if (qualified) qualifiedPdvs++
      details.push({
        customerCode: custCode, customerName: entry.name, value: entry.value, qualified, progressPct,
        reason: qualified ? undefined : !hasAllCodes ? 'EANs faltando' : `R$${entry.value.toFixed(0)} < R$${cfg.minValue}`,
      })
    }

    details.sort((a, b) => b.progressPct - a.progressPct)
    const bestPdvProgress = details.length > 0 ? (details[0].progressPct / 100) : 0
    const totalValue = details.reduce((s, d) => s + (d.value ?? 0), 0)
    const prizeV = qualifiedPdvs * cfg.prize.vendedor
    const prizeS = qualifiedPdvs * cfg.prize.supervisor
    const prizeG = qualifiedPdvs * cfg.prize.gerente
    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: prizeV, details, bestPdvProgress, totalValue,
    })
  }

  sellers.sort((a, b) =>
    b.qualifiedPdvs - a.qualifiedPdvs ||
    b.bestPdvProgress - a.bestPdvProgress ||
    b.totalValue - a.totalValue
  )
  return {
    campaignId: campaign.id, campaignName: campaign.name,
    totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0),
    totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0), sellers,
    goal: { metric: 'value', target: cfg.minValue },
  }
}

/* ── Cota (Acelere e Ganhe) ──────────────────────────────── */
function apurateCota(
  cfg: CotaConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  rcas: RcaRecord[]
): ApurationResult {
  const startDate = campaign.startDate || new Date().toISOString().slice(0, 7) + '-01'
  const endDate = campaign.endDate || new Date().toISOString().slice(0, 10)

  // day-20 boundary in the same month as startDate
  const day20 = startDate.slice(0, 7) + '-20'

  const rcaMap = buildRcaMap(rcas)
  const allMovements = getWindowedMovements(movements, startDate, endDate, ['venda_faturada', 'devolucao'])

  // Group by seller
  const bySeller = new Map<string, { fat: number; fatUntilDay20: number }>()
  for (const m of allMovements) {
    const seller = m.sellerCode ?? '?'
    if (!bySeller.has(seller)) bySeller.set(seller, { fat: 0, fatUntilDay20: 0 })
    const e = bySeller.get(seller)!
    const v = m.value ?? 0
    e.fat += v
    if (m.movementDate && m.movementDate <= day20) e.fatUntilDay20 += v
  }

  const sellers: SellerResult[] = []
  for (const [sellerCode, data] of bySeller) {
    const rca = rcaMap.get(sellerCode)
    const goal = rca?.goal ?? 0
    if (!goal) continue

    const pct20 = goal > 0 ? (data.fatUntilDay20 / goal) * 100 : 0
    const pctFinal = goal > 0 ? (data.fat / goal) * 100 : 0
    const hitDay20 = pct20 >= cfg.day20Threshold
    const hitFinal = pctFinal >= 100

    const qualified = hitFinal // day20 is informational; prize requires 100% final
    const prize = qualified
      ? (cfg.prizeTiers.find(t => !t.maxGoal || goal <= t.maxGoal)?.prize ?? cfg.prizeTiers[cfg.prizeTiers.length - 1]?.prize ?? 0)
      : 0

    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs: qualified ? 1 : 0,
      prizeVendedor: prize,
      prizeSupervisor: qualified ? cfg.supervisorPrize : 0,
      prizeGerente: qualified ? cfg.gerentePrize : 0,
      totalPrize: qualified ? prize + cfg.supervisorPrize + cfg.gerentePrize : 0,
      details: [{
        customerCode: sellerCode, customerName: rca?.name ?? sellerCode,
        value: data.fat, qualified,
        reason: qualified ? undefined : !hitFinal ? `${pctFinal.toFixed(0)}% da meta` : undefined,
      }],
    })
  }

  sellers.sort((a, b) => b.prizeVendedor - a.prizeVendedor)
  return {
    campaignId: campaign.id, campaignName: campaign.name,
    totalPdvs: sellers.filter(s => s.qualifiedPdvs > 0).length,
    totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0),
    sellers,
  }
}

/* ── Vizinhança — Quantidades ────────────────────────────── */
function apurateVizinhancaQtd(
  cfg: VizinhancaQtdConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  clientBase: CanonicalClient[],
  productBase: CanonicalProduct[],
  rcas: RcaRecord[]
): ApurationResult {
  const startDate = campaign.startDate; const endDate = campaign.endDate
  if (!startDate || !endDate) return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: 0, totalPrize: 0, sellers: [] }

  const categoryMap = buildCategoryMap(productBase)
  const clientMap = buildClientMap(clientBase)
  const rcaMap = buildRcaMap(rcas)
  const faixaSet = new Set(cfg.faixas.map(String))
  const perfilSet = new Set(cfg.perfis.map(p => p.toLowerCase()))

  const filtered = getWindowedMovements(movements, startDate, endDate)

  type PdvEntry = { name: string; qtdByCategory: Record<string, number>; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  for (const m of filtered) {
    const cust = m.customerCode ?? ''; if (!cust) continue
    const cli = clientMap.get(cust)
    if (!cli) continue
    if (faixaSet.size > 0 && !faixaSet.has(cli.faixa)) continue
    if (perfilSet.size > 0 && !perfilSet.has(cli.perfil.toLowerCase())) continue

    const code = m.productCode?.toUpperCase()
    if (!code) continue
    const cat = categoryMap.get(code); if (!cat) continue
    const needed = cfg.categoryRequirements.some(r => cat.includes(r.category.toLowerCase()))
    if (!needed) continue

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, qtdByCategory: {}, sellerCode: seller })
    const e = custMap.get(cust)!
    e.qtdByCategory[cat] = (e.qtdByCategory[cat] ?? 0) + (m.quantity ?? 1)
  }

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0

    for (const [custCode, entry] of custMap) {
      const qualified = cfg.categoryRequirements.every(req => {
        const total = Object.entries(entry.qtdByCategory)
          .filter(([cat]) => cat.includes(req.category.toLowerCase()))
          .reduce((s, [, q]) => s + q, 0)
        return total >= req.min
      })
      if (qualified) qualifiedPdvs++
      details.push({ customerCode: custCode, customerName: entry.name, qualified })
    }

    const prizeV = qualifiedPdvs * cfg.prize.vendedor
    const prizeS = qualifiedPdvs * cfg.prize.supervisor
    const prizeG = qualifiedPdvs * cfg.prize.gerente
    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: prizeV, details,
    })
  }

  sellers.sort((a, b) => b.qualifiedPdvs - a.qualifiedPdvs)
  return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0), totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0), sellers }
}

/* ── Vizinhança — Famílias ───────────────────────────────── */
function apurateVizinhancaFamilias(
  cfg: VizinhancaFamiliasConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  clientBase: CanonicalClient[],
  productBase: CanonicalProduct[],
  rcas: RcaRecord[]
): ApurationResult {
  const startDate = campaign.startDate; const endDate = campaign.endDate
  if (!startDate || !endDate) return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: 0, totalPrize: 0, sellers: [] }

  const familyMap = buildFamilyMap(productBase)
  const clientMap = buildClientMap(clientBase)
  const rcaMap = buildRcaMap(rcas)
  const faixaSet = new Set(cfg.faixas.map(String))
  const perfilSet = new Set(cfg.perfis.map(p => p.toLowerCase()))

  const filtered = getWindowedMovements(movements, startDate, endDate)

  type PdvEntry = { name: string; families: Set<string>; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  for (const m of filtered) {
    const cust = m.customerCode ?? ''; if (!cust) continue
    const cli = clientMap.get(cust)
    if (!cli) continue
    if (faixaSet.size > 0 && !faixaSet.has(cli.faixa)) continue
    if (perfilSet.size > 0 && !perfilSet.has(cli.perfil.toLowerCase())) continue

    const code = m.productCode?.toUpperCase()
    if (!code) continue
    const family = familyMap.get(code); if (!family) continue

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, families: new Set(), sellerCode: seller })
    custMap.get(cust)!.families.add(family)
  }

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0

    for (const [custCode, entry] of custMap) {
      const hasMandatory = cfg.mandatoryFamilies.length === 0 ||
        cfg.mandatoryFamilies.every(f => [...entry.families].some(ef => ef.includes(f.toLowerCase())))
      const qualified = hasMandatory && entry.families.size >= cfg.minFamilies
      if (qualified) qualifiedPdvs++
      details.push({ customerCode: custCode, customerName: entry.name, skuCount: entry.families.size, qualified })
    }

    const prizeV = qualifiedPdvs * cfg.prize.vendedor
    const prizeS = qualifiedPdvs * cfg.prize.supervisor
    const prizeG = qualifiedPdvs * cfg.prize.gerente
    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: prizeV, details,
    })
  }

  sellers.sort((a, b) => b.qualifiedPdvs - a.qualifiedPdvs)
  return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0), totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0), sellers }
}

/* ── Vizinhança — Hair SKUs ──────────────────────────────── */
function apurateVizinhancaHair(
  cfg: VizinhancaHairConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  clientBase: CanonicalClient[],
  productBase: CanonicalProduct[],
  rcas: RcaRecord[]
): ApurationResult {
  const startDate = campaign.startDate; const endDate = campaign.endDate
  if (!startDate || !endDate) return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: 0, totalPrize: 0, sellers: [] }

  // Hair products: category or brand keyword
  const hairCodes = new Set(
    productBase
      .filter(p => {
        const desc = (p.description ?? '').toLowerCase()
        const cat = (p.category ?? '').toLowerCase()
        const brand = (p.brand ?? '').toLowerCase()
        return cat.includes('hair') || cat.includes('cabelo') || cat.includes('shampoo') ||
          cat.includes('condicionador') || brand.includes('hair') ||
          desc.includes('shampoo') || desc.includes('condicionador')
      })
      .map(p => p.internalCode?.toUpperCase() ?? '')
      .filter(Boolean)
  )

  const clientMap = buildClientMap(clientBase)
  const rcaMap = buildRcaMap(rcas)
  const faixaSet = new Set(cfg.faixas.map(String))
  const perfilSet = new Set(cfg.perfis.map(p => p.toLowerCase()))

  const filtered = getWindowedMovements(movements, startDate, endDate)

  type PdvEntry = { name: string; skus: Set<string>; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  for (const m of filtered) {
    const code = m.productCode?.toUpperCase()
    if (!code || !hairCodes.has(code)) continue
    const cust = m.customerCode ?? ''; if (!cust) continue
    const cli = clientMap.get(cust)
    if (!cli) continue
    if (faixaSet.size > 0 && !faixaSet.has(cli.faixa)) continue
    if (perfilSet.size > 0 && !perfilSet.has(cli.perfil.toLowerCase())) continue

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, skus: new Set(), sellerCode: seller })
    custMap.get(cust)!.skus.add(code)
  }

  const sortedTiers = [...cfg.tiers].sort((a, b) => b.minSkus - a.minSkus)

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0
    let totalPrizeV = 0

    for (const [custCode, entry] of custMap) {
      const skuCount = entry.skus.size
      const tier = sortedTiers.find(t => skuCount >= t.minSkus)
      const qualified = !!tier
      if (qualified) {
        qualifiedPdvs++
        totalPrizeV += tier!.prize
      }
      details.push({ customerCode: custCode, customerName: entry.name, skuCount, qualified })
    }

    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: totalPrizeV,
      prizeSupervisor: Math.round(totalPrizeV * cfg.supervisorMultiplier),
      prizeGerente: Math.round(totalPrizeV * cfg.gerenteMultiplier),
      totalPrize: totalPrizeV, details,
    })
  }

  sellers.sort((a, b) => b.qualifiedPdvs - a.qualifiedPdvs)
  return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0), totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0), sellers }
}

/* ── Meta por CNPJ ───────────────────────────────────────── */
function apurateMetaCnpj(
  cfg: MetaCnpjConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  clientBase: CanonicalClient[],
  rcas: RcaRecord[]
): ApurationResult {
  const startDate = campaign.startDate; const endDate = campaign.endDate
  if (!startDate || !endDate) return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: 0, totalPrize: 0, sellers: [] }

  const codeSet = buildProductCodeSet(cfg.productCodes)
  const clientMap = buildClientMap(clientBase)
  const rcaMap = buildRcaMap(rcas)
  const goalByCnpj: Record<string, number> = {}
  for (const [k, v] of Object.entries(cfg.goalByCnpj)) goalByCnpj[fmtCnpj(k)] = v

  const filtered = getWindowedMovements(movements, startDate, endDate)

  type PdvEntry = { name: string; skus: Set<string>; cnpj: string; sellerCode: string }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  for (const m of filtered) {
    const code = m.productCode?.toUpperCase()
    if (!code || !codeSet.has(code)) continue
    const cust = m.customerCode ?? ''; if (!cust) continue
    const cli = clientMap.get(cust)
    const cnpj = cli?.cnpj ?? fmtCnpj(m.customerCode ?? '')

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, skus: new Set(), cnpj, sellerCode: seller })
    custMap.get(cust)!.skus.add(code)
  }

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0

    for (const [custCode, entry] of custMap) {
      const goal = goalByCnpj[entry.cnpj] ?? 0
      const qualified = goal > 0 ? entry.skus.size >= goal : entry.skus.size > 0
      if (qualified) qualifiedPdvs++
      details.push({ customerCode: custCode, customerName: entry.name, skuCount: entry.skus.size, qualified })
    }

    const prizeV = qualifiedPdvs * cfg.prize.vendedor
    const prizeS = qualifiedPdvs * cfg.prize.supervisor
    const prizeG = qualifiedPdvs * cfg.prize.gerente
    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: prizeV, details,
    })
  }

  sellers.sort((a, b) => b.qualifiedPdvs - a.qualifiedPdvs)
  return { campaignId: campaign.id, campaignName: campaign.name, totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0), totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0), sellers }
}

/* ── Personalizado (genérico) ────────────────────────────── */
function apurateCustom(
  cfg: CustomConfig,
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  productBase: CanonicalProduct[],
  clientBase: CanonicalClient[],
  rcas: RcaRecord[]
): ApurationResult {
  const today = new Date().toISOString().slice(0, 10)
  const windowEnd = campaign.endDate || today
  const windowStart = cfg.windowMonths > 1
    ? expandStart(windowEnd, cfg.windowMonths)
    : (campaign.startDate || expandStart(windowEnd, 1))

  const rcaMap = buildRcaMap(rcas)
  const clientMap = buildClientMap(clientBase)
  const categoryMap = buildCategoryMap(productBase)
  const familyMap = buildFamilyMap(productBase)

  const productSet = buildProductCodeSet(cfg.productCodes)
  const mandatorySet = buildProductCodeSet(cfg.mandatoryCodes)
  const cnpjSet = buildCnpjSet(cfg.validCnpjs)
  const faixaSet = new Set(cfg.faixas.map(String))
  const perfilSet = new Set(cfg.perfis.map(p => p.toLowerCase()))

  const goalByCnpjNorm: Record<string, number> = {}
  for (const [k, v] of Object.entries(cfg.goalByCnpj)) goalByCnpjNorm[fmtCnpj(k)] = v

  /* ── unit = seller ── */
  if (cfg.unit === 'seller') {
    const startDate = campaign.startDate || windowStart
    const day20 = startDate.slice(0, 7) + '-20'
    const allMovs = getWindowedMovements(movements, startDate, windowEnd, ['venda_faturada', 'devolucao'])

    const bySeller = new Map<string, { fat: number; fatUntil20: number }>()
    for (const m of allMovs) {
      if (productSet.size > 0) {
        const code = m.productCode?.toUpperCase()
        if (!code || !productSet.has(code)) continue
      }
      const seller = m.sellerCode ?? '?'
      if (!bySeller.has(seller)) bySeller.set(seller, { fat: 0, fatUntil20: 0 })
      const e = bySeller.get(seller)!
      e.fat += m.value ?? 0
      if (m.movementDate && m.movementDate <= day20) e.fatUntil20 += m.value ?? 0
    }

    const sellers: SellerResult[] = []
    for (const [sellerCode, data] of bySeller) {
      const rca = rcaMap.get(sellerCode)
      const goal = rca?.goal ?? 0
      if (!goal) continue

      const pct = goal > 0 ? (data.fat / goal) * 100 : 0
      const qualified = pct >= (cfg.threshold || 100)

      let prizeV = 0
      if (qualified) {
        if (cfg.prizeType === 'flat') {
          prizeV = cfg.prize.vendedor
        } else if (cfg.prizeType === 'tiered_goal') {
          const sorted = [...cfg.goalTiers].sort((a, b) => (a.maxGoal || Infinity) - (b.maxGoal || Infinity))
          const tier = sorted.find(t => !t.maxGoal || goal <= t.maxGoal)
          prizeV = tier?.prize ?? 0
        } else if (cfg.prizeType === 'tiered_metric') {
          const sorted = [...cfg.metricTiers].sort((a, b) => b.minValue - a.minValue)
          const tier = sorted.find(t => pct >= t.minValue)
          prizeV = tier?.prize ?? 0
        }
      }

      const prizeS = cfg.supervisorMultiplier > 0
        ? Math.round(prizeV * cfg.supervisorMultiplier)
        : (qualified ? cfg.supervisorPrize : 0)
      const prizeG = cfg.gerenteMultiplier > 0
        ? Math.round(prizeV * cfg.gerenteMultiplier)
        : (qualified ? cfg.gerentePrize : 0)

      sellers.push({
        sellerCode, sellerName: rca?.name ?? sellerCode,
        supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
        qualifiedPdvs: qualified ? 1 : 0,
        prizeVendedor: prizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
        totalPrize: prizeV + prizeS + prizeG,
        details: [{
          customerCode: sellerCode, customerName: rca?.name ?? sellerCode,
          value: data.fat, qualified,
          reason: qualified ? undefined : `${pct.toFixed(0)}% da meta (mín ${cfg.threshold || 100}%)`,
        }],
      })
    }

    sellers.sort((a, b) => b.prizeVendedor - a.prizeVendedor)
    return {
      campaignId: campaign.id, campaignName: campaign.name,
      totalPdvs: sellers.filter(s => s.qualifiedPdvs > 0).length,
      totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0),
      sellers,
    }
  }

  /* ── unit = pdv ── */
  type PdvEntry = {
    name: string; codes: Set<string>; value: number
    families: Set<string>; qtdByCategory: Record<string, number>
  }
  const bySellerCustomer = new Map<string, Map<string, PdvEntry>>()

  const filtered = getWindowedMovements(movements, windowStart, windowEnd)
  for (const m of filtered) {
    const code = m.productCode?.toUpperCase()
    const cust = m.customerCode ?? ''; if (!cust) continue
    if (productSet.size > 0 && (!code || !productSet.has(code))) continue

    if (cnpjSet.size > 0) {
      const cli = clientMap.get(cust)
      const cnpj = cli?.cnpj ?? fmtCnpj(cust)
      if (!cnpjSet.has(cnpj) && !cnpjSet.has(cust)) continue
    }
    if (faixaSet.size > 0 || perfilSet.size > 0) {
      const cli = clientMap.get(cust)
      if (!cli) continue
      if (faixaSet.size > 0 && !faixaSet.has(cli.faixa)) continue
      if (perfilSet.size > 0 && !perfilSet.has(cli.perfil.toLowerCase())) continue
    }

    const seller = m.sellerCode ?? '?'
    if (!bySellerCustomer.has(seller)) bySellerCustomer.set(seller, new Map())
    const custMap = bySellerCustomer.get(seller)!
    if (!custMap.has(cust)) custMap.set(cust, { name: m.customerName ?? cust, codes: new Set(), value: 0, families: new Set(), qtdByCategory: {} })
    const e = custMap.get(cust)!

    if (code) {
      e.codes.add(code)
      e.value += m.value ?? 0
      const fam = familyMap.get(code); if (fam) e.families.add(fam)
      const cat = categoryMap.get(code); if (cat) e.qtdByCategory[cat] = (e.qtdByCategory[cat] ?? 0) + (m.quantity ?? 1)
    }
  }

  const sortedMetricTiers = [...cfg.metricTiers].sort((a, b) => b.minValue - a.minValue)

  const sellers: SellerResult[] = []
  for (const [sellerCode, custMap] of bySellerCustomer) {
    const rca = rcaMap.get(sellerCode)
    const details: PdvDetail[] = []
    let qualifiedPdvs = 0
    let totalPrizeV = 0

    for (const [custCode, entry] of custMap) {
      const hasMandatory = mandatorySet.size === 0 || [...mandatorySet].every(c => entry.codes.has(c))
      const hasMandatoryFamilies = cfg.mandatoryFamilies.length === 0 ||
        cfg.mandatoryFamilies.every(f => [...entry.families].some(ef => ef.includes(f.toLowerCase())))

      const cli = clientMap.get(custCode)
      const cnpj = cli?.cnpj ?? fmtCnpj(custCode)
      const effectiveThreshold = goalByCnpjNorm[cnpj] !== undefined ? goalByCnpjNorm[cnpj] : cfg.threshold

      let metricValue = 0
      let qualified = false
      let reason: string | undefined

      if (cfg.metric === 'sku_count') {
        metricValue = entry.codes.size
        qualified = hasMandatory && hasMandatoryFamilies && metricValue >= effectiveThreshold
        if (!qualified) reason = !hasMandatory ? 'Mandatórios faltando' : `${metricValue}/${effectiveThreshold} SKUs`
      } else if (cfg.metric === 'value') {
        metricValue = entry.value
        qualified = hasMandatory && metricValue >= effectiveThreshold
        if (!qualified) reason = !hasMandatory ? 'Mandatórios faltando' : `R$${metricValue.toFixed(0)} < R$${effectiveThreshold}`
      } else if (cfg.metric === 'family_count') {
        metricValue = entry.families.size
        qualified = hasMandatory && hasMandatoryFamilies && metricValue >= effectiveThreshold
        if (!qualified) reason = !hasMandatoryFamilies ? 'Famílias mandatórias faltando' : `${metricValue}/${effectiveThreshold} famílias`
      } else if (cfg.metric === 'qty_by_category') {
        const allMet = cfg.categoryRequirements.every(req => {
          const total = Object.entries(entry.qtdByCategory)
            .filter(([cat]) => cat.includes(req.category.toLowerCase()))
            .reduce((s, [, q]) => s + q, 0)
          return total >= req.min
        })
        metricValue = Object.values(entry.qtdByCategory).reduce((s, q) => s + q, 0)
        qualified = allMet
        if (!qualified) reason = 'Quantidades insuficientes por categoria'
      }

      let pdvPrize = 0
      if (qualified) {
        if (cfg.prizeType === 'flat') {
          pdvPrize = cfg.prize.vendedor
        } else if (cfg.prizeType === 'tiered_metric') {
          const tier = sortedMetricTiers.find(t => metricValue >= t.minValue)
          pdvPrize = tier?.prize ?? 0
        }
        qualifiedPdvs++
        totalPrizeV += pdvPrize
      }

      details.push({
        customerCode: custCode, customerName: entry.name,
        value: cfg.metric === 'value' ? metricValue : undefined,
        skuCount: cfg.metric !== 'value' ? metricValue : undefined,
        qualified, reason,
      })
    }

    const prizeS = cfg.supervisorMultiplier > 0
      ? Math.round(totalPrizeV * cfg.supervisorMultiplier)
      : qualifiedPdvs * cfg.supervisorPrize
    const prizeG = cfg.gerenteMultiplier > 0
      ? Math.round(totalPrizeV * cfg.gerenteMultiplier)
      : qualifiedPdvs * cfg.gerentePrize

    sellers.push({
      sellerCode, sellerName: rca?.name ?? sellerCode,
      supervisorCode: rca?.supervisorCode ?? '', supervisorName: rca?.supervisor ?? '—',
      qualifiedPdvs, prizeVendedor: totalPrizeV, prizeSupervisor: prizeS, prizeGerente: prizeG,
      totalPrize: totalPrizeV + prizeS + prizeG, details,
    })
  }

  sellers.sort((a, b) => b.qualifiedPdvs - a.qualifiedPdvs)
  return {
    campaignId: campaign.id, campaignName: campaign.name,
    totalPdvs: sellers.reduce((s, r) => s + r.qualifiedPdvs, 0),
    totalPrize: sellers.reduce((s, r) => s + r.prizeVendedor, 0),
    sellers,
  }
}

/* ── Main dispatch ───────────────────────────────────────── */
export function apurateCampaign(
  campaign: CampaignRecord,
  movements: CanonicalMovement[],
  productBase: CanonicalProduct[],
  clientBase: CanonicalClient[],
  rcas: RcaRecord[]
): ApurationResult {
  const cfg = campaign.config
  switch (cfg.type) {
    case 'mix_skus':            return apurateMixSkus(cfg, campaign, movements, productBase, rcas)
    case 'valor_eans':          return apurateValorEans(cfg, campaign, movements, productBase, rcas)
    case 'cota':                return apurateCota(cfg, campaign, movements, rcas)
    case 'vizinhanca_qtd':      return apurateVizinhancaQtd(cfg, campaign, movements, clientBase, productBase, rcas)
    case 'vizinhanca_familias': return apurateVizinhancaFamilias(cfg, campaign, movements, clientBase, productBase, rcas)
    case 'vizinhanca_hair':     return apurateVizinhancaHair(cfg, campaign, movements, clientBase, productBase, rcas)
    case 'meta_cnpj':           return apurateMetaCnpj(cfg, campaign, movements, clientBase, rcas)
    case 'custom':              return apurateCustom(cfg, campaign, movements, productBase, clientBase, rcas)
  }
}

/* ── Default configs per type ────────────────────────────── */
export function defaultConfig(type: CampaignType): CampaignConfig {
  switch (type) {
    case 'mix_skus': return { type, mandatoryCodes: [], optionalCodes: [], minSkus: 17, windowMonths: 3, validCnpjs: [], prize: { vendedor: 300, supervisor: 200, gerente: 0 } }
    case 'valor_eans': return { type, productCodes: [], requireAllCodes: true, minValue: 150, windowMonths: 3, validCnpjs: [], prize: { vendedor: 30, supervisor: 15, gerente: 5 } }
    case 'cota': return { type, day20Threshold: 70, prizeTiers: [{ maxGoal: 50000, prize: 500 }, { maxGoal: 100000, prize: 1000 }, { maxGoal: 0, prize: 1500 }], supervisorPrize: 1000, gerentePrize: 2000 }
    case 'vizinhanca_qtd': return { type, faixas: [4, 5], perfis: ['varejo'], categoryRequirements: [{ category: 'creme dental', min: 12 }, { category: 'escova', min: 6 }, { category: 'enxaguante', min: 1 }], prize: { vendedor: 20, supervisor: 10, gerente: 5 } }
    case 'vizinhanca_familias': return { type, faixas: [4, 5], perfis: ['varejo'], mandatoryFamilies: ['CD Total', 'Escova Colgate', 'Enxaguante'], minFamilies: 12, prize: { vendedor: 20, supervisor: 10, gerente: 5 } }
    case 'vizinhanca_hair': return { type, faixas: [4, 5], perfis: ['varejo'], tiers: [{ minSkus: 15, prize: 20 }, { minSkus: 25, prize: 50 }], supervisorMultiplier: 0.5, gerenteMultiplier: 0.25 }
    case 'meta_cnpj': return { type, productCodes: [], goalByCnpj: {}, prize: { vendedor: 500, supervisor: 500, gerente: 0 } }
    case 'custom': return {
      type, unit: 'pdv', metric: 'sku_count', threshold: 10, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [], perfis: [],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 0, supervisor: 0, gerente: 0 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0,
      supervisorMultiplier: 0, gerenteMultiplier: 0,
    }
  }
}

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  mix_skus: 'Mix de SKUs',
  valor_eans: 'Valor + EANs',
  cota: 'Cota (Acelere)',
  vizinhanca_qtd: 'Vizinhança — Quantidades',
  vizinhanca_familias: 'Vizinhança — Famílias',
  vizinhanca_hair: 'Vizinhança — Hair',
  meta_cnpj: 'Meta por CNPJ',
  custom: 'Personalizado',
}

/* ── Templates prontos para o tipo Personalizado ─────────── */
export const CUSTOM_TEMPLATES: Array<{ label: string; config: CustomConfig }> = [
  {
    label: 'Mix de SKUs',
    config: {
      type: 'custom', unit: 'pdv', metric: 'sku_count', threshold: 17, windowMonths: 3,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [], perfis: [],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 300, supervisor: 200, gerente: 0 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
  {
    label: 'Valor + EANs',
    config: {
      type: 'custom', unit: 'pdv', metric: 'value', threshold: 150, windowMonths: 3,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [], perfis: [],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 30, supervisor: 15, gerente: 5 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
  {
    label: 'Cota (Acelere)',
    config: {
      type: 'custom', unit: 'seller', metric: 'seller_goal_pct', threshold: 100, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [], perfis: [],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 70, goalByCnpj: {},
      prizeType: 'tiered_goal', prize: { vendedor: 0, supervisor: 0, gerente: 0 },
      metricTiers: [],
      goalTiers: [{ maxGoal: 50000, prize: 500 }, { maxGoal: 100000, prize: 1000 }, { maxGoal: 0, prize: 1500 }],
      supervisorPrize: 1000, gerentePrize: 2000, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
  {
    label: 'Vizinhança — Quantidades',
    config: {
      type: 'custom', unit: 'pdv', metric: 'qty_by_category', threshold: 0, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [4, 5], perfis: ['varejo'],
      categoryRequirements: [{ category: 'creme dental', min: 12 }, { category: 'escova', min: 6 }, { category: 'enxaguante', min: 1 }],
      mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 20, supervisor: 10, gerente: 5 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
  {
    label: 'Vizinhança — Famílias',
    config: {
      type: 'custom', unit: 'pdv', metric: 'family_count', threshold: 12, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [4, 5], perfis: ['varejo'],
      categoryRequirements: [], mandatoryFamilies: ['CD Total', 'Escova Colgate', 'Enxaguante'],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 20, supervisor: 10, gerente: 5 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
  {
    label: 'Vizinhança — Hair',
    config: {
      type: 'custom', unit: 'pdv', metric: 'sku_count', threshold: 0, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [4, 5], perfis: ['varejo'],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'tiered_metric', prize: { vendedor: 0, supervisor: 0, gerente: 0 },
      metricTiers: [{ minValue: 15, prize: 20 }, { minValue: 25, prize: 50 }],
      goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0.5, gerenteMultiplier: 0.25,
    },
  },
  {
    label: 'Meta por CNPJ',
    config: {
      type: 'custom', unit: 'pdv', metric: 'sku_count', threshold: 1, windowMonths: 1,
      productCodes: [], mandatoryCodes: [], validCnpjs: [],
      faixas: [], perfis: [],
      categoryRequirements: [], mandatoryFamilies: [],
      day20Threshold: 0, goalByCnpj: {},
      prizeType: 'flat', prize: { vendedor: 500, supervisor: 500, gerente: 0 },
      metricTiers: [], goalTiers: [],
      supervisorPrize: 0, gerentePrize: 0, supervisorMultiplier: 0, gerenteMultiplier: 0,
    },
  },
]
