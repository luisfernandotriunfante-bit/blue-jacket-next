import type { CanonicalProduct } from './productMotor'

export type ProductGroup = { code: string; name: string; family: string }
const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const haystack = (product: CanonicalProduct) => normalize([product.description, product.brand, product.category, product.subcategory, product.productLine].filter(Boolean).join(' '))

const rules: Array<{ group: ProductGroup; matches: (text: string) => boolean }> = [
  { group: { code: '22', name: 'COLGATE - FIO DENTAL', family: 'FIO DENTAL' }, matches: text => /FIO DENTAL|DENTAL FLOSS/.test(text) },
  { group: { code: '3', name: 'COLGATE - ENXAGUANTES', family: 'ENXAGUANTES' }, matches: text => /ENXAG|MOUTHWASH|\bMW\b/.test(text) },
  { group: { code: '21', name: 'COLGATE - CD TOTAL', family: 'CREME DENTAL' }, matches: text => /COLGATE.*TOTAL|\bCD TOTAL\b/.test(text) },
  { group: { code: '9', name: 'COLGATE - CREME SORRISO', family: 'CREME DENTAL' }, matches: text => /SORRISO/.test(text) },
  { group: { code: '14', name: 'COLGATE - CREME COLGATE PREMIUM', family: 'CREME DENTAL' }, matches: text => /PREMIUM|LUMINOUS|NATURALS|TT12/.test(text) && /COLGATE|CREME|DENTAL/.test(text) },
  { group: { code: '1', name: 'COLGATE - CREME COLGATE BASE', family: 'CREME DENTAL' }, matches: text => /CREME DENTAL|TOOTHPASTE|\bCD\b/.test(text) },
  { group: { code: '17', name: 'COLGATE - ESCOVA SORRISO', family: 'ESCOVA' }, matches: text => /ESCOVA.*SORRISO|TB SORRISO/.test(text) },
  { group: { code: '2', name: 'COLGATE - ESCOVAS COLGATE', family: 'ESCOVA' }, matches: text => /ESCOVA|TOOTHBRUSH|\bTB\b/.test(text) },
  { group: { code: '6', name: 'COLGATE - AJAX', family: 'LIMPEZA' }, matches: text => /AJAX/.test(text) },
  { group: { code: '10', name: 'COLGATE - PINHO SOL', family: 'LIMPEZA' }, matches: text => /PINHO SOL|\bPINHO\b/.test(text) },
  { group: { code: '16', name: 'COLGATE - OLA', family: 'LIMPEZA' }, matches: text => /\bOLA\b/.test(text) },
  { group: { code: '4', name: 'COLGATE - SAB BARRA PROTEX', family: 'SABONETE EM BARRA' }, matches: text => /PROTEX/.test(text) && /SAB|SOAP/.test(text) },
  { group: { code: '20', name: 'COLGATE - SAB BARRA PALMOLIVE 150', family: 'SABONETE EM BARRA' }, matches: text => /PALMOLIVE.*150|150.*PALMOLIVE/.test(text) && /SAB|SOAP/.test(text) },
  { group: { code: '15', name: 'COLGATE - SAB BARRA PALMOLIVE', family: 'SABONETE EM BARRA' }, matches: text => /PALMOLIVE/.test(text) && /SAB|SOAP/.test(text) },
  { group: { code: '5', name: 'COLGATE - SHAMPOO PALMOLIVE', family: 'SHAMPOO' }, matches: text => /PALMOLIVE/.test(text) && /SHAMPOO|\bSH\b/.test(text) },
  { group: { code: '18', name: 'COLGATE - SHAMPOO DARLING', family: 'SHAMPOO' }, matches: text => /DARLING/.test(text) && /SHAMPOO|\bSH\b/.test(text) },
  { group: { code: '8', name: 'COLGATE - CONDICIONADOR', family: 'CONDICIONADOR' }, matches: text => /CONDICIONADOR|\bCOND\b/.test(text) },
  { group: { code: '7', name: 'COLGATE - SAB LIQUIDOS CORPO', family: 'SABONETE LÍQUIDO' }, matches: text => /SHOWER GEL|BODY WASH|\bBW\b/.test(text) },
  { group: { code: '19', name: 'COLGATE - SAB LIQUIDOS GERAL', family: 'SABONETE LÍQUIDO' }, matches: text => /SAB LIQ|LIQUID SOAP|LHS|BABY|INTIMO/.test(text) },
]

export function classifyProduct(product: CanonicalProduct): { group?: ProductGroup; status: 'automatic' | 'review' } {
  const matches = rules.filter(rule => rule.matches(haystack(product)))
  return matches.length === 1 ? { group: matches[0].group, status: 'automatic' } : { status: 'review' }
}
