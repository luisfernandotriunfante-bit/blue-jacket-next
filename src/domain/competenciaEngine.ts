import type { CanonicalMovement } from './movementMotor'
import type { CanonicalProduct } from './productMotor'
import type { CanonicalClient } from './clientMotor'
import type { CanonicalHistory } from './historyMotor'
import type { CanonicalReceipt } from './receiptMotor'
import type { RcaRecord } from '../RcaManager'
import type { CampaignRecord } from './campaignEngine'

export interface CompetenciaSnapshot {
  competencia: string
  closedAt: string
  movements: CanonicalMovement[]
  products: CanonicalProduct[]
  clients: CanonicalClient[]
  history: CanonicalHistory[]
  receipts: CanonicalReceipt[]
  rcas: RcaRecord[]
  campaigns: CampaignRecord[]
  markupPct: string
  covDays: string
  selloutMeta: string
  positivMeta: string
}

const PREFIX = 'rj-snap-'

export function saveCompetenciaSnap(snap: CompetenciaSnapshot): boolean {
  try {
    localStorage.setItem(PREFIX + snap.competencia, JSON.stringify(snap))
    window.dispatchEvent(new Event('rj-competencias-changed'))
    return true
  } catch { return false }
}

export function loadCompetenciaSnap(comp: string): CompetenciaSnapshot | null {
  try {
    const v = localStorage.getItem(PREFIX + comp)
    return v ? (JSON.parse(v) as CompetenciaSnapshot) : null
  } catch { return null }
}

export function listClosedCompetencias(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length))
    }
  } catch { /* */ }
  return keys.sort().reverse()
}

export function deleteCompetenciaSnap(comp: string): void {
  try {
    localStorage.removeItem(PREFIX + comp)
    window.dispatchEvent(new Event('rj-competencias-changed'))
  } catch { /* */ }
}

export function currentCompetenciaCode(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const ACTIVE_COMP_KEY = 'rj-active-comp'

export function getActiveComp(): string {
  try {
    return localStorage.getItem(ACTIVE_COMP_KEY) ?? currentCompetenciaCode()
  } catch {
    return currentCompetenciaCode()
  }
}

export function setActiveComp(comp: string): void {
  try {
    localStorage.setItem(ACTIVE_COMP_KEY, comp)
    window.dispatchEvent(new Event('rj-active-comp-changed'))
  } catch { /* */ }
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function fmtCompetencia(comp: string): string {
  const [y, m] = comp.split('-')
  return `${MONTHS[parseInt(m) - 1] ?? m}/${y}`
}
