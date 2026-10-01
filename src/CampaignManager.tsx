import { useState, useEffect } from 'react'
import {
  type CampaignRecord, type CampaignConfig, type CampaignType,
  type MixSkusConfig, type ValorEansConfig, type CotaConfig,
  type VizinhancaQtdConfig, type VizinhancaFamiliasConfig,
  type VizinhancaHairConfig, type MetaCnpjConfig, type CustomConfig,
  defaultConfig, CAMPAIGN_TYPE_LABEL, CUSTOM_TEMPLATES,
} from './domain/campaignEngine'

/* ── persistence ─────────────────────────────────────── */
export function readCampaigns(): CampaignRecord[] {
  try { const v = localStorage.getItem('rj-campaigns'); return v ? (JSON.parse(v) as CampaignRecord[]) : [] }
  catch { return [] }
}

function persistCampaigns(list: CampaignRecord[]) {
  try {
    localStorage.setItem('rj-campaigns', JSON.stringify(list))
    window.dispatchEvent(new Event('rj-campaigns-changed'))
  } catch { /* quota */ }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d ? `${d}/${m}/${y}` : iso
}

function statusBadge(status: CampaignRecord['status']) {
  return status === 'active'
    ? <span className="rca-badge rca-badge-active">Ativa</span>
    : <span className="rca-badge rca-badge-inac">Inativa</span>
}

const CAMPAIGN_TYPES: CampaignType[] = [
  'mix_skus', 'valor_eans', 'cota', 'vizinhanca_qtd',
  'vizinhanca_familias', 'vizinhanca_hair', 'meta_cnpj', 'custom',
]

/* ── helpers para edição inline de arrays/records ────── */
function codeListToText(codes: string[]) { return codes.join('\n') }
function textToCodeList(text: string) {
  return text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
}
function cnpjRecordToText(obj: Record<string, number>) {
  return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join('\n')
}
function textToCnpjRecord(text: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const line of text.split(/\n/)) {
    const [k, v] = line.split(':')
    if (k && v) result[k.trim().replace(/\D/g, '')] = parseFloat(v.trim()) || 0
  }
  return result
}
function categoryReqsToText(reqs: VizinhancaQtdConfig['categoryRequirements']) {
  return reqs.map(r => `${r.category}:${r.min}`).join('\n')
}
function textToCategoryReqs(text: string): VizinhancaQtdConfig['categoryRequirements'] {
  return text.split(/\n/).map(l => {
    const [cat, min] = l.split(':')
    return { category: cat?.trim() ?? '', min: parseInt(min?.trim() ?? '0') || 0 }
  }).filter(r => r.category)
}
function tiersToText(tiers: Array<{ minSkus: number; prize: number }>) {
  return tiers.map(t => `${t.minSkus}:${t.prize}`).join('\n')
}
function textToTiers(text: string) {
  return text.split(/\n/).map(l => {
    const [minSkus, prize] = l.split(':')
    return { minSkus: parseInt(minSkus?.trim() ?? '0') || 0, prize: parseFloat(prize?.trim() ?? '0') || 0 }
  }).filter(t => t.minSkus > 0)
}
function prizeTiersToText(tiers: CotaConfig['prizeTiers']) {
  return tiers.map(t => `${t.maxGoal}:${t.prize}`).join('\n')
}
function textToPrizeTiers(text: string): CotaConfig['prizeTiers'] {
  return text.split(/\n/).map(l => {
    const [max, prize] = l.split(':')
    return { maxGoal: parseFloat(max?.trim() ?? '0') || 0, prize: parseFloat(prize?.trim() ?? '0') || 0 }
  }).filter(t => t.prize > 0)
}
function metricTiersToText(tiers: CustomConfig['metricTiers']) {
  return tiers.map(t => `${t.minValue}:${t.prize}`).join('\n')
}
function textToMetricTiers(text: string): CustomConfig['metricTiers'] {
  return text.split(/\n/).map(l => {
    const [min, prize] = l.split(':')
    return { minValue: parseFloat(min?.trim() ?? '0') || 0, prize: parseFloat(prize?.trim() ?? '0') || 0 }
  }).filter(t => t.prize > 0)
}
function goalTiersToText(tiers: CustomConfig['goalTiers']) {
  return tiers.map(t => `${t.maxGoal}:${t.prize}`).join('\n')
}
function textToGoalTiers(text: string): CustomConfig['goalTiers'] {
  return text.split(/\n/).map(l => {
    const [max, prize] = l.split(':')
    return { maxGoal: parseFloat(max?.trim() ?? '0') || 0, prize: parseFloat(prize?.trim() ?? '0') || 0 }
  }).filter(t => t.prize > 0)
}

/* ── UI primitives ───────────────────────────────────── */

const WINDOW_PRESETS = [
  { label: 'Mensal', months: 1 },
  { label: 'Bimestral', months: 2 },
  { label: 'Trimestral', months: 3 },
  { label: 'Semestral', months: 6 },
  { label: 'Anual', months: 12 },
]

function WindowMonthsField({ months, onChange }: { months: number; onChange: (v: number) => void }) {
  return (
    <div className="rca-field rca-field-full">
      <label>Janela de acompanhamento</label>
      <div className="camp-chip-group">
        {WINDOW_PRESETS.map(p => (
          <button key={p.months} type="button"
            className={`camp-chip${months === p.months ? ' on' : ''}`}
            onClick={() => onChange(p.months)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const FAIXAS_OPCOES = [1, 2, 3, 4, 5]

function FaixaButtons({ faixas, onChange }: { faixas: number[]; onChange: (v: number[]) => void }) {
  const toggle = (n: number) => onChange(
    faixas.includes(n) ? faixas.filter(x => x !== n) : [...faixas, n].sort((a, b) => a - b)
  )
  return (
    <div className="rca-field rca-field-full">
      <label>Faixas de clientes (vazio = todas)</label>
      <div className="camp-chip-group">
        {FAIXAS_OPCOES.map(n => (
          <button key={n} type="button"
            className={`camp-chip${faixas.includes(n) ? ' on' : ''}`}
            onClick={() => toggle(n)}>
            Faixa {n}
          </button>
        ))}
        {faixas.length > 0 && (
          <button type="button" className="camp-chip clear" onClick={() => onChange([])}>
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

const PERFIS_OPCOES = [
  { value: 'varejo', label: 'Varejo' },
  { value: 'vizinhança pequena', label: 'Viz. Pequena' },
  { value: 'vizinhança grande', label: 'Viz. Grande' },
  { value: 'hiper', label: 'Hiper' },
  { value: 'super', label: 'Super' },
  { value: 'farmácia', label: 'Farmácia' },
]

function PerfilButtons({ perfis, onChange }: { perfis: string[]; onChange: (v: string[]) => void }) {
  const norm = (p: string) => p.toLowerCase().trim()
  const toggle = (v: string) => {
    const n = norm(v)
    onChange(perfis.some(x => norm(x) === n) ? perfis.filter(x => norm(x) !== n) : [...perfis, v])
  }
  return (
    <div className="rca-field rca-field-full">
      <label>Perfil / Canal (vazio = todos)</label>
      <div className="camp-chip-group">
        {PERFIS_OPCOES.map(p => (
          <button key={p.value} type="button"
            className={`camp-chip${perfis.some(x => norm(x) === p.value) ? ' on' : ''}`}
            onClick={() => toggle(p.value)}>
            {p.label}
          </button>
        ))}
        {perfis.length > 0 && (
          <button type="button" className="camp-chip clear" onClick={() => onChange([])}>
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

function YesNoToggle({
  label, value, onChange,
  trueLabel = 'Sim', falseLabel = 'Não',
}: {
  label: string; value: boolean; onChange: (v: boolean) => void
  trueLabel?: string; falseLabel?: string
}) {
  return (
    <div className="rca-field rca-field-full">
      <label>{label}</label>
      <div className="rca-btn-group">
        <button type="button" className={`rca-opt-btn${value ? ' on' : ''}`} onClick={() => onChange(true)}>{trueLabel}</button>
        <button type="button" className={`rca-opt-btn${!value ? ' on' : ''}`} onClick={() => onChange(false)}>{falseLabel}</button>
      </div>
    </div>
  )
}

function CnpjFilterField({ cnpjs, onChange }: { cnpjs: string[]; onChange: (v: string[]) => void }) {
  const [show, setShow] = useState(cnpjs.length > 0)
  return (
    <>
      <YesNoToggle
        label="Restringir a CNPJs específicos?"
        value={show}
        trueLabel="Sim, só alguns"
        falseLabel="Não, todos os clientes"
        onChange={v => { setShow(v); if (!v) onChange([]) }}
      />
      {show && (
        <div className="rca-field rca-field-full">
          <label>CNPJs válidos (um por linha)</label>
          <textarea className="camp-textarea" rows={3}
            value={codeListToText(cnpjs)}
            onChange={e => onChange(textToCodeList(e.target.value))}
            placeholder="12345678000100&#10;98765432000100" />
        </div>
      )}
    </>
  )
}

/* ── CampaignForm ────────────────────────────────────── */
interface FormProps {
  record: CampaignRecord
  isNew: boolean
  onSave: (r: CampaignRecord) => void
  onCancel: () => void
}

function CampaignForm({ record, isNew, onSave, onCancel }: FormProps) {
  const [r, setR] = useState<CampaignRecord>(record)
  const [errors, setErrors] = useState<string[]>([])

  function setField<K extends keyof CampaignRecord>(key: K, val: CampaignRecord[K]) {
    setR(v => ({ ...v, [key]: val }))
    setErrors([])
  }
  function setCfg(cfg: CampaignConfig) {
    setR(v => ({ ...v, config: cfg }))
    setErrors([])
  }

  function changeType(t: CampaignType) {
    setR(v => ({ ...v, config: defaultConfig(t) }))
    setErrors([])
  }

  function validate(): string[] {
    const e: string[] = []
    if (!r.name.trim()) e.push('Nome da campanha é obrigatório.')
    if (r.startDate && r.endDate && r.startDate > r.endDate) e.push('Data início não pode ser após data término.')
    return e
  }

  function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    onSave({ ...r, name: r.name.trim() })
  }

  const cfg = r.config

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <section className="modal rca-modal camp-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <button className="close" type="button" aria-label="Fechar" onClick={onCancel}>×</button>
        <h2 style={{ marginBottom: 18 }}>{isNew ? 'Nova campanha' : 'Editar campanha'}</h2>

        {errors.length > 0 && (
          <ul className="rca-errors">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}

        <div className="rca-form">
          {/* Nome */}
          <div className="rca-field rca-field-full">
            <label>Nome da campanha *</label>
            <input value={r.name} onChange={e => setField('name', e.target.value)} placeholder="Ex.: Mix Obrigatório Set/25" autoFocus={isNew} />
          </div>

          {/* Tipo */}
          <div className="rca-field rca-field-full">
            <label>Tipo de campanha *</label>
            <div className="camp-type-grid">
              {CAMPAIGN_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`camp-type-btn${cfg.type === t ? ' on' : ''}`}
                  onClick={() => changeType(t)}
                >
                  {CAMPAIGN_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="rca-field">
            <label>Início</label>
            <input type="date" value={r.startDate} onChange={e => setField('startDate', e.target.value)} />
          </div>
          <div className="rca-field">
            <label>Término</label>
            <input type="date" value={r.endDate} onChange={e => setField('endDate', e.target.value)} />
          </div>

          {/* Status */}
          <div className="rca-field rca-field-full">
            <label>Status</label>
            <div className="rca-btn-group">
              {(['active', 'inactive'] as const).map(v => (
                <button key={v} type="button" className={`rca-opt-btn${r.status === v ? ' on' : ''}`} onClick={() => setField('status', v)}>
                  {v === 'active' ? 'Ativa' : 'Inativa'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Config por tipo ─────────────────────────── */}
          <div className="rca-field rca-field-full">
            <div className="camp-cfg-section">
              <span className="camp-cfg-title">{CAMPAIGN_TYPE_LABEL[cfg.type]}</span>
            </div>
          </div>

          {cfg.type === 'mix_skus' && <MixSkusFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'valor_eans' && <ValorEansFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'cota' && <CotaFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'vizinhanca_qtd' && <VizinhancaQtdFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'vizinhanca_familias' && <VizinhancaFamiliasFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'vizinhanca_hair' && <VizinhancaHairFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'meta_cnpj' && <MetaCnpjFields cfg={cfg} onChange={setCfg} />}
          {cfg.type === 'custom' && <CustomFields cfg={cfg} onChange={setCfg} />}

          {/* Observações */}
          <div className="rca-field rca-field-full">
            <label>Observações</label>
            <textarea
              className="camp-textarea"
              value={r.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Informações adicionais…"
              rows={2}
            />
          </div>
        </div>

        <div className="rca-modal-actions">
          <button className="process-button" style={{ margin: 0 }} type="button" onClick={save}>Salvar</button>
          <button className="add-button" style={{ marginTop: 0 }} type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </section>
    </div>
  )
}

/* ── Type-specific field groups ──────────────────────── */

function PrizeFields({ prize, onChange }: { prize: { vendedor: number; supervisor: number; gerente: number }; onChange: (p: typeof prize) => void }) {
  return (
    <div className="camp-prize-row">
      <div className="camp-prize-field">
        <label>Vendedor (R$)</label>
        <input type="number" min={0} value={prize.vendedor} onChange={e => onChange({ ...prize, vendedor: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="camp-prize-field">
        <label>Supervisor (R$)</label>
        <input type="number" min={0} value={prize.supervisor} onChange={e => onChange({ ...prize, supervisor: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="camp-prize-field">
        <label>Gerente (R$)</label>
        <input type="number" min={0} value={prize.gerente} onChange={e => onChange({ ...prize, gerente: parseFloat(e.target.value) || 0 })} />
      </div>
    </div>
  )
}

function MixSkusFields({ cfg, onChange }: { cfg: MixSkusConfig; onChange: (c: CampaignConfig) => void }) {
  const [showSKUList, setShowSKUList] = useState(cfg.mandatoryCodes.length > 0 || cfg.optionalCodes.length > 0)
  const [showMandatory, setShowMandatory] = useState(cfg.mandatoryCodes.length > 0)

  return (
    <>
      <WindowMonthsField months={cfg.windowMonths} onChange={v => onChange({ ...cfg, windowMonths: v })} />

      <hr className="camp-section-divider" />

      <YesNoToggle
        label="Usa lista de SKUs específica?"
        value={showSKUList}
        trueLabel="Sim, lista definida"
        falseLabel="Não, todos os produtos"
        onChange={v => { setShowSKUList(v); if (!v) { setShowMandatory(false); onChange({ ...cfg, mandatoryCodes: [], optionalCodes: [] }) } }}
      />

      {showSKUList && (
        <>
          <YesNoToggle
            label="Tem itens mandatórios?"
            value={showMandatory}
            onChange={v => { setShowMandatory(v); if (!v) onChange({ ...cfg, mandatoryCodes: [] }) }}
          />

          {showMandatory && (
            <div className="rca-field rca-field-full">
              <label>Códigos mandatórios (um por linha)</label>
              <textarea className="camp-textarea" rows={4} value={codeListToText(cfg.mandatoryCodes)}
                onChange={e => onChange({ ...cfg, mandatoryCodes: textToCodeList(e.target.value) })}
                placeholder="Ex.: 12345&#10;67890" />
            </div>
          )}

          <div className="rca-field rca-field-full">
            <label>{showMandatory ? 'Demais códigos válidos (um por linha)' : 'Códigos válidos (um por linha)'}</label>
            <textarea className="camp-textarea" rows={4} value={codeListToText(cfg.optionalCodes)}
              onChange={e => onChange({ ...cfg, optionalCodes: textToCodeList(e.target.value) })}
              placeholder="Ex.: 11111&#10;22222" />
          </div>
        </>
      )}

      <div className="rca-field">
        <label>Mínimo de SKUs</label>
        <input type="number" min={1} value={cfg.minSkus} onChange={e => onChange({ ...cfg, minSkus: parseInt(e.target.value) || 1 })} />
      </div>

      <hr className="camp-section-divider" />

      <CnpjFilterField cnpjs={cfg.validCnpjs} onChange={v => onChange({ ...cfg, validCnpjs: v })} />

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Prêmios por PDV qualificado</label>
        <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
      </div>
    </>
  )
}

function ValorEansFields({ cfg, onChange }: { cfg: ValorEansConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <WindowMonthsField months={cfg.windowMonths} onChange={v => onChange({ ...cfg, windowMonths: v })} />

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Códigos de produto obrigatórios (um por linha)</label>
        <textarea className="camp-textarea" rows={4} value={codeListToText(cfg.productCodes)}
          onChange={e => onChange({ ...cfg, productCodes: textToCodeList(e.target.value) })}
          placeholder="Ex.: 12345&#10;67890" />
      </div>

      <YesNoToggle
        label="Exige todos os códigos?"
        value={cfg.requireAllCodes}
        trueLabel="Todos obrigatórios"
        falseLabel="Qualquer um"
        onChange={v => onChange({ ...cfg, requireAllCodes: v })}
      />

      <div className="rca-field">
        <label>Valor mínimo (R$)</label>
        <input type="number" min={0} value={cfg.minValue} onChange={e => onChange({ ...cfg, minValue: parseFloat(e.target.value) || 0 })} />
      </div>

      <hr className="camp-section-divider" />

      <CnpjFilterField cnpjs={cfg.validCnpjs} onChange={v => onChange({ ...cfg, validCnpjs: v })} />

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Prêmios por PDV qualificado</label>
        <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
      </div>
    </>
  )
}

function CotaFields({ cfg, onChange }: { cfg: CotaConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <div className="rca-field">
        <label>% meta até dia 20 (informativo)</label>
        <input type="number" min={0} max={100} value={cfg.day20Threshold} onChange={e => onChange({ ...cfg, day20Threshold: parseFloat(e.target.value) || 0 })} />
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Faixas de prêmio por meta (maxMeta:prêmio, 0 = acima de tudo)</label>
        <textarea className="camp-textarea" rows={4}
          value={prizeTiersToText(cfg.prizeTiers)}
          onChange={e => onChange({ ...cfg, prizeTiers: textToPrizeTiers(e.target.value) })}
          placeholder="50000:500&#10;100000:1000&#10;0:1500" />
        <small style={{ color: 'var(--muted)', fontSize: 11 }}>Formato: maxMeta:prêmio. Use 0 como maxMeta para a última faixa (sem teto).</small>
      </div>

      <div className="rca-field">
        <label>Prêmio supervisor (R$)</label>
        <input type="number" min={0} value={cfg.supervisorPrize} onChange={e => onChange({ ...cfg, supervisorPrize: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="rca-field">
        <label>Prêmio gerente (R$)</label>
        <input type="number" min={0} value={cfg.gerentePrize} onChange={e => onChange({ ...cfg, gerentePrize: parseFloat(e.target.value) || 0 })} />
      </div>
    </>
  )
}

function VizinhancaQtdFields({ cfg, onChange }: { cfg: VizinhancaQtdConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <FaixaButtons faixas={cfg.faixas} onChange={f => onChange({ ...cfg, faixas: f })} />
      <PerfilButtons perfis={cfg.perfis} onChange={p => onChange({ ...cfg, perfis: p })} />

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Quantidades por categoria (categoria:min, um por linha)</label>
        <textarea className="camp-textarea" rows={4}
          value={categoryReqsToText(cfg.categoryRequirements)}
          onChange={e => onChange({ ...cfg, categoryRequirements: textToCategoryReqs(e.target.value) })}
          placeholder="creme dental:12&#10;escova:6&#10;enxaguante:1" />
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Prêmios por PDV qualificado</label>
        <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
      </div>
    </>
  )
}

function VizinhancaFamiliasFields({ cfg, onChange }: { cfg: VizinhancaFamiliasConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <FaixaButtons faixas={cfg.faixas} onChange={f => onChange({ ...cfg, faixas: f })} />
      <PerfilButtons perfis={cfg.perfis} onChange={p => onChange({ ...cfg, perfis: p })} />

      <hr className="camp-section-divider" />

      <div className="rca-field">
        <label>Mínimo de famílias</label>
        <input type="number" min={1} value={cfg.minFamilies} onChange={e => onChange({ ...cfg, minFamilies: parseInt(e.target.value) || 1 })} />
      </div>
      <div className="rca-field rca-field-full">
        <label>Famílias obrigatórias (uma por linha)</label>
        <textarea className="camp-textarea" rows={3}
          value={cfg.mandatoryFamilies.join('\n')}
          onChange={e => onChange({ ...cfg, mandatoryFamilies: textToCodeList(e.target.value) })}
          placeholder="CD Total&#10;Escova Colgate&#10;Enxaguante" />
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Prêmios por PDV qualificado</label>
        <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
      </div>
    </>
  )
}

function VizinhancaHairFields({ cfg, onChange }: { cfg: VizinhancaHairConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <FaixaButtons faixas={cfg.faixas} onChange={f => onChange({ ...cfg, faixas: f })} />
      <PerfilButtons perfis={cfg.perfis} onChange={p => onChange({ ...cfg, perfis: p })} />

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Patamares (minSKUs:prêmio por PDV, um por linha)</label>
        <textarea className="camp-textarea" rows={3}
          value={tiersToText(cfg.tiers)}
          onChange={e => onChange({ ...cfg, tiers: textToTiers(e.target.value) })}
          placeholder="15:20&#10;25:50" />
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field">
        <label>Multiplicador supervisor (ex.: 0.5)</label>
        <input type="number" min={0} step={0.1} value={cfg.supervisorMultiplier} onChange={e => onChange({ ...cfg, supervisorMultiplier: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="rca-field">
        <label>Multiplicador gerente (ex.: 0.25)</label>
        <input type="number" min={0} step={0.1} value={cfg.gerenteMultiplier} onChange={e => onChange({ ...cfg, gerenteMultiplier: parseFloat(e.target.value) || 0 })} />
      </div>
    </>
  )
}

function MetaCnpjFields({ cfg, onChange }: { cfg: MetaCnpjConfig; onChange: (c: CampaignConfig) => void }) {
  return (
    <>
      <div className="rca-field rca-field-full">
        <label>Códigos de produto (um por linha)</label>
        <textarea className="camp-textarea" rows={4} value={codeListToText(cfg.productCodes)}
          onChange={e => onChange({ ...cfg, productCodes: textToCodeList(e.target.value) })}
          placeholder="Ex.: 12345&#10;67890" />
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Meta por CNPJ (cnpj:meta, um por linha)</label>
        <textarea className="camp-textarea" rows={5}
          value={cnpjRecordToText(cfg.goalByCnpj)}
          onChange={e => onChange({ ...cfg, goalByCnpj: textToCnpjRecord(e.target.value) })}
          placeholder="12345678000100:5&#10;98765432000100:3" />
        <small style={{ color: 'var(--muted)', fontSize: 11 }}>Formato: CNPJ:quantidade de SKUs esperados</small>
      </div>

      <hr className="camp-section-divider" />

      <div className="rca-field rca-field-full">
        <label>Prêmios por PDV qualificado</label>
        <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
      </div>
    </>
  )
}

function CustomFields({ cfg, onChange }: { cfg: CustomConfig; onChange: (c: CampaignConfig) => void }) {
  const [showMandatory, setShowMandatory] = useState(cfg.mandatoryCodes.length > 0)
  const [showFamilies, setShowFamilies] = useState(cfg.mandatoryFamilies.length > 0)

  const showCategoryReqs = cfg.metric === 'qty_by_category'
  const showMetricTiers = cfg.prizeType === 'tiered_metric'
  const showGoalTiers = cfg.prizeType === 'tiered_goal'
  const showFlatPrize = cfg.prizeType === 'flat'

  return (
    <>
      {/* Templates rápidos */}
      <div className="rca-field rca-field-full">
        <label>Carregar template</label>
        <div className="camp-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {CUSTOM_TEMPLATES.map(t => (
            <button key={t.label} type="button" className="camp-type-btn"
              onClick={() => onChange(t.config)}>
              {t.label}
            </button>
          ))}
        </div>
        <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Carregar preenche todos os campos com os valores padrão do modelo escolhido.</small>
      </div>

      <hr className="camp-section-divider" />

      {/* Unidade de apuração */}
      <div className="rca-field rca-field-full">
        <label>Unidade de apuração</label>
        <div className="rca-btn-group">
          <button type="button" className={`rca-opt-btn${cfg.unit === 'pdv' ? ' on' : ''}`} onClick={() => onChange({ ...cfg, unit: 'pdv' })}>Por PDV</button>
          <button type="button" className={`rca-opt-btn${cfg.unit === 'seller' ? ' on' : ''}`} onClick={() => onChange({ ...cfg, unit: 'seller' })}>Por Vendedor</button>
        </div>
      </div>

      {/* Público */}
      {cfg.unit === 'pdv' && (
        <>
          <FaixaButtons faixas={cfg.faixas} onChange={f => onChange({ ...cfg, faixas: f })} />
          <PerfilButtons perfis={cfg.perfis} onChange={p => onChange({ ...cfg, perfis: p })} />
        </>
      )}

      <hr className="camp-section-divider" />

      {/* Janela */}
      {cfg.unit === 'pdv' && (
        <WindowMonthsField months={cfg.windowMonths} onChange={v => onChange({ ...cfg, windowMonths: v })} />
      )}

      {/* day20Threshold (seller) */}
      {cfg.unit === 'seller' && (
        <div className="rca-field">
          <label>% meta até dia 20 (informativo)</label>
          <input type="number" min={0} max={100} value={cfg.day20Threshold}
            onChange={e => onChange({ ...cfg, day20Threshold: parseFloat(e.target.value) || 0 })} />
        </div>
      )}

      {/* Métrica */}
      <div className="rca-field rca-field-full">
        <label>Métrica de qualificação</label>
        <div className="camp-chip-group">
          {(cfg.unit === 'pdv'
            ? [['sku_count', 'Qtd. de SKUs'], ['value', 'Valor (R$)'], ['family_count', 'Qtd. de Famílias'], ['qty_by_category', 'Qtd. por Categoria']] as const
            : [['seller_goal_pct', '% da Meta do Vendedor']] as const
          ).map(([v, label]) => (
            <button key={v} type="button"
              className={`camp-chip${cfg.metric === v ? ' on' : ''}`}
              onClick={() => onChange({ ...cfg, metric: v as CustomConfig['metric'] })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Threshold */}
      {cfg.metric !== 'qty_by_category' && (
        <div className="rca-field">
          <label>
            {cfg.metric === 'sku_count' ? 'Mín. SKUs' : cfg.metric === 'value' ? 'Valor mínimo (R$)' : cfg.metric === 'family_count' ? 'Mín. famílias' : '% meta mínima'}
          </label>
          <input type="number" min={0} value={cfg.threshold}
            onChange={e => onChange({ ...cfg, threshold: parseFloat(e.target.value) || 0 })} />
        </div>
      )}

      <hr className="camp-section-divider" />

      {/* Produtos */}
      <div className="rca-field rca-field-full">
        <label>Códigos de produto (um por linha, vazio = todos)</label>
        <textarea className="camp-textarea" rows={4} value={codeListToText(cfg.productCodes)}
          onChange={e => onChange({ ...cfg, productCodes: textToCodeList(e.target.value) })}
          placeholder="Opcional — deixe vazio para considerar todos os produtos" />
      </div>

      {/* Mandatórios */}
      {cfg.metric === 'sku_count' && (
        <>
          <YesNoToggle
            label="Tem itens mandatórios?"
            value={showMandatory}
            onChange={v => { setShowMandatory(v); if (!v) onChange({ ...cfg, mandatoryCodes: [] }) }}
          />
          {showMandatory && (
            <div className="rca-field rca-field-full">
              <label>Códigos mandatórios (subconjunto obrigatório, um por linha)</label>
              <textarea className="camp-textarea" rows={3} value={codeListToText(cfg.mandatoryCodes)}
                onChange={e => onChange({ ...cfg, mandatoryCodes: textToCodeList(e.target.value) })}
                placeholder="Opcional" />
            </div>
          )}
        </>
      )}

      {/* Famílias mandatórias */}
      {cfg.metric === 'family_count' && (
        <>
          <YesNoToggle
            label="Tem famílias obrigatórias?"
            value={showFamilies}
            onChange={v => { setShowFamilies(v); if (!v) onChange({ ...cfg, mandatoryFamilies: [] }) }}
          />
          {showFamilies && (
            <div className="rca-field rca-field-full">
              <label>Famílias obrigatórias (uma por linha)</label>
              <textarea className="camp-textarea" rows={3} value={cfg.mandatoryFamilies.join('\n')}
                onChange={e => onChange({ ...cfg, mandatoryFamilies: textToCodeList(e.target.value) })}
                placeholder="Ex.: CD Total&#10;Escova Colgate" />
            </div>
          )}
        </>
      )}

      {/* Quantidades por categoria */}
      {showCategoryReqs && (
        <div className="rca-field rca-field-full">
          <label>Quantidades por categoria (categoria:min, uma por linha)</label>
          <textarea className="camp-textarea" rows={4}
            value={categoryReqsToText(cfg.categoryRequirements)}
            onChange={e => onChange({ ...cfg, categoryRequirements: textToCategoryReqs(e.target.value) })}
            placeholder="creme dental:12&#10;escova:6&#10;enxaguante:1" />
        </div>
      )}

      <hr className="camp-section-divider" />

      {/* CNPJs */}
      <CnpjFilterField cnpjs={cfg.validCnpjs} onChange={v => onChange({ ...cfg, validCnpjs: v })} />

      {/* Meta por CNPJ (sobrescreve threshold) */}
      <div className="rca-field rca-field-full">
        <label>Meta individual por CNPJ — sobrescreve mínimo (cnpj:meta, um por linha)</label>
        <textarea className="camp-textarea" rows={4}
          value={cnpjRecordToText(cfg.goalByCnpj)}
          onChange={e => onChange({ ...cfg, goalByCnpj: textToCnpjRecord(e.target.value) })}
          placeholder="Opcional — ex.: 12345678000100:5" />
      </div>

      <hr className="camp-section-divider" />

      {/* Tipo de prêmio */}
      <div className="rca-field rca-field-full">
        <label>Tipo de prêmio</label>
        <div className="rca-btn-group">
          <button type="button" className={`rca-opt-btn${cfg.prizeType === 'flat' ? ' on' : ''}`} onClick={() => onChange({ ...cfg, prizeType: 'flat' })}>Fixo por PDV</button>
          <button type="button" className={`rca-opt-btn${cfg.prizeType === 'tiered_metric' ? ' on' : ''}`} onClick={() => onChange({ ...cfg, prizeType: 'tiered_metric' })}>Patamar por métrica</button>
          <button type="button" className={`rca-opt-btn${cfg.prizeType === 'tiered_goal' ? ' on' : ''}`} onClick={() => onChange({ ...cfg, prizeType: 'tiered_goal' })}>Faixa por meta</button>
        </div>
      </div>

      {showFlatPrize && (
        <div className="rca-field rca-field-full">
          <label>Prêmios por PDV/vendedor qualificado</label>
          <PrizeFields prize={cfg.prize} onChange={p => onChange({ ...cfg, prize: p })} />
        </div>
      )}

      {showMetricTiers && (
        <div className="rca-field rca-field-full">
          <label>Patamares de prêmio (minValor:prêmio por PDV, um por linha)</label>
          <textarea className="camp-textarea" rows={3}
            value={metricTiersToText(cfg.metricTiers)}
            onChange={e => onChange({ ...cfg, metricTiers: textToMetricTiers(e.target.value) })}
            placeholder="15:20&#10;25:50" />
          <small style={{ color: 'var(--muted)', fontSize: 11 }}>Maior patamar aplicável vence.</small>
        </div>
      )}

      {showGoalTiers && (
        <div className="rca-field rca-field-full">
          <label>Faixas de prêmio por meta (maxMeta:prêmio, 0=sem teto)</label>
          <textarea className="camp-textarea" rows={4}
            value={goalTiersToText(cfg.goalTiers)}
            onChange={e => onChange({ ...cfg, goalTiers: textToGoalTiers(e.target.value) })}
            placeholder="50000:500&#10;100000:1000&#10;0:1500" />
        </div>
      )}

      {/* Supervisor/gerente */}
      <div className="rca-field">
        <label>Prêmio supervisor (R$, fixo)</label>
        <input type="number" min={0} value={cfg.supervisorPrize}
          onChange={e => onChange({ ...cfg, supervisorPrize: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="rca-field">
        <label>Prêmio gerente (R$, fixo)</label>
        <input type="number" min={0} value={cfg.gerentePrize}
          onChange={e => onChange({ ...cfg, gerentePrize: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="rca-field">
        <label>Multiplicador supervisor (ex.: 0.5)</label>
        <input type="number" min={0} step={0.05} value={cfg.supervisorMultiplier}
          onChange={e => onChange({ ...cfg, supervisorMultiplier: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="rca-field">
        <label>Multiplicador gerente (ex.: 0.25)</label>
        <input type="number" min={0} step={0.05} value={cfg.gerenteMultiplier}
          onChange={e => onChange({ ...cfg, gerenteMultiplier: parseFloat(e.target.value) || 0 })} />
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--muted)', marginTop: -4 }}>
        Se o multiplicador for &gt; 0, ele substitui o valor fixo de supervisor/gerente.
      </div>
    </>
  )
}

/* ── CampaignManager (entry point) ───────────────────── */
export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(readCampaigns)
  const [editing, setEditing] = useState<CampaignRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')

  useEffect(() => {
    const onUpdate = () => setCampaigns(readCampaigns())
    window.addEventListener('rj-campaigns-changed', onUpdate)
    return () => window.removeEventListener('rj-campaigns-changed', onUpdate)
  }, [])

  function persist(updated: CampaignRecord[]) {
    setCampaigns(updated)
    persistCampaigns(updated)
  }

  function openNew() {
    setEditing({ id: newId(), name: '', brand: '', startDate: '', endDate: '', status: 'active', notes: '', config: defaultConfig('mix_skus') })
    setIsNew(true)
  }

  function openEdit(c: CampaignRecord) {
    const cfg = c.config ?? defaultConfig('mix_skus')
    setEditing({ ...c, config: cfg })
    setIsNew(false)
  }

  function save(updated: CampaignRecord) {
    persist(isNew ? [...campaigns, updated] : campaigns.map(c => c.id === updated.id ? updated : c))
    setEditing(null)
  }

  function toggleStatus(id: string) {
    persist(campaigns.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c))
  }

  function remove(id: string) {
    if (!confirm('Excluir esta campanha permanentemente?')) return
    persist(campaigns.filter(c => c.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = campaigns.filter(c =>
    (filterStatus === 'all' || c.status === filterStatus) &&
    (!q || c.name.toLowerCase().includes(q) || CAMPAIGN_TYPE_LABEL[c.config?.type]?.toLowerCase().includes(q))
  )

  const activeCount = campaigns.filter(c => c.status === 'active').length
  const inactiveCount = campaigns.filter(c => c.status === 'inactive').length

  return (
    <div className="rca-manager">
      <div className="rca-toolbar">
        <input
          className="stock-search"
          style={{ flex: 1 }}
          placeholder="Buscar por nome ou tipo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="rca-btn-group" style={{ flexShrink: 0 }}>
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} type="button" className={`rca-opt-btn${filterStatus === s ? ' on' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>
        <button className="process-button" style={{ margin: 0, flexShrink: 0 }} type="button" onClick={openNew}>
          + Nova campanha
        </button>
      </div>

      <div className="rca-count">
        {filtered.length} campanha{filtered.length !== 1 ? 's' : ''}{filterStatus !== 'all' ? ` ${filterStatus === 'active' ? 'ativas' : 'inativas'}` : ''}
        <span style={{ marginLeft: 12, color: 'var(--muted)' }}>· {activeCount} ativas · {inactiveCount} inativas</span>
      </div>

      {editing && (
        <CampaignForm
          record={editing}
          isNew={isNew}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', marginTop: 28, textAlign: 'center' }}>
          {campaigns.length ? 'Nenhuma campanha encontrada.' : 'Nenhuma campanha cadastrada. Clique em "+ Nova campanha" para começar.'}
        </p>
      ) : (
        <div className="camp-grid">
          {filtered.map(c => (
            <div key={c.id} className={`camp-card${c.status === 'inactive' ? ' camp-card-inactive' : ''}`}>
              <div className="camp-card-header">
                <div className="camp-card-title">{c.name}</div>
                <div className="camp-card-badges">
                  <span className="camp-brand-tag">{c.config ? CAMPAIGN_TYPE_LABEL[c.config.type] : '—'}</span>
                  {statusBadge(c.status)}
                </div>
              </div>
              {(c.startDate || c.endDate) && (
                <div className="camp-card-dates">
                  {c.startDate ? fmtDate(c.startDate) : '—'} → {c.endDate ? fmtDate(c.endDate) : '—'}
                </div>
              )}
              {c.notes && <div className="camp-card-notes">{c.notes}</div>}
              <div className="rca-actions" style={{ marginTop: 12 }}>
                <button type="button" className="rca-btn" onClick={() => openEdit(c)}>Editar</button>
                <button type="button" className="rca-btn" onClick={() => toggleStatus(c.id)}>
                  {c.status === 'active' ? 'Inativar' : 'Reativar'}
                </button>
                <button type="button" className="rca-btn rca-btn-del" onClick={() => remove(c.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
