import { useState, useEffect } from 'react'

/* ── types ───────────────────────────────────────────── */
export interface CampaignRecord {
  id: string
  name: string
  brand: string
  mechanic: string
  startDate: string
  endDate: string
  status: 'active' | 'inactive'
  notes: string
}

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

const BRANDS = ['Colgate', 'Palmolive', 'Speed Stick', 'Ladybug', 'Protex', 'Ajax', 'Fabuloso', 'Outra']

const EMPTY: Omit<CampaignRecord, 'id'> = {
  name: '', brand: '', mechanic: '', startDate: '', endDate: '', status: 'active', notes: '',
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

/* ── CampaignManager ─────────────────────────────────── */
export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(readCampaigns)
  const [editing, setEditing] = useState<CampaignRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [formErrors, setFormErrors] = useState<string[]>([])

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
    setEditing({ id: newId(), ...EMPTY })
    setIsNew(true)
    setFormErrors([])
  }

  function openEdit(c: CampaignRecord) {
    setEditing({ ...c })
    setIsNew(false)
    setFormErrors([])
  }

  function validate(c: CampaignRecord): string[] {
    const e: string[] = []
    if (!c.name.trim()) e.push('Nome da campanha é obrigatório.')
    if (!c.brand.trim()) e.push('Marca é obrigatória.')
    if (c.startDate && c.endDate && c.startDate > c.endDate) e.push('Data de início não pode ser após a data de término.')
    return e
  }

  function save() {
    if (!editing) return
    const errs = validate(editing)
    if (errs.length) { setFormErrors(errs); return }
    const cleaned: CampaignRecord = { ...editing, name: editing.name.trim(), brand: editing.brand.trim() }
    persist(isNew ? [...campaigns, cleaned] : campaigns.map(c => c.id === cleaned.id ? cleaned : c))
    setEditing(null)
  }

  function toggleStatus(id: string) {
    persist(campaigns.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c))
  }

  function remove(id: string) {
    if (!confirm('Excluir esta campanha permanentemente?')) return
    persist(campaigns.filter(c => c.id !== id))
  }

  function setField<K extends keyof CampaignRecord>(key: K, val: CampaignRecord[K]) {
    setEditing(v => v ? { ...v, [key]: val } : v)
    setFormErrors([])
  }

  const q = search.toLowerCase()
  const filtered = campaigns.filter(c =>
    (filterStatus === 'all' || c.status === filterStatus) &&
    (!q || c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q) || c.mechanic.toLowerCase().includes(q))
  )

  const activeCount = campaigns.filter(c => c.status === 'active').length
  const inactiveCount = campaigns.filter(c => c.status === 'inactive').length

  return (
    <div className="rca-manager">
      {/* ── toolbar ───────────────────────────────────── */}
      <div className="rca-toolbar">
        <input
          className="stock-search"
          style={{ flex: 1 }}
          placeholder="Buscar por nome, marca, mecânica…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="rca-btn-group" style={{ flexShrink: 0 }}>
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`rca-opt-btn${filterStatus === s ? ' on' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>
        <button className="process-button" style={{ margin: 0, flexShrink: 0 }} type="button" onClick={openNew}>
          + Nova campanha
        </button>
      </div>

      <div className="rca-count">
        {filtered.length} campanha{filtered.length !== 1 ? 's' : ''} {filterStatus === 'active' ? 'ativas' : filterStatus === 'inactive' ? 'inativas' : ''}
        <span style={{ marginLeft: 12, color: 'var(--muted)' }}>· {activeCount} ativas · {inactiveCount} inativas</span>
      </div>

      {/* ── modal ─────────────────────────────────────── */}
      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="modal rca-modal camp-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="close" type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button>
            <h2 style={{ marginBottom: 18 }}>{isNew ? 'Nova campanha' : 'Editar campanha'}</h2>
            {formErrors.length > 0 && (
              <ul className="rca-errors">
                {formErrors.map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
            <div className="rca-form">
              <div className="rca-field rca-field-full">
                <label>Nome da campanha *</label>
                <input
                  value={editing.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Ex.: Promoção Escova Colgate + Creme"
                  autoFocus={isNew}
                />
              </div>

              <div className="rca-field">
                <label>Marca *</label>
                <input
                  value={editing.brand}
                  onChange={e => setField('brand', e.target.value)}
                  placeholder="Ex.: Colgate"
                  list="camp-brands"
                />
                <datalist id="camp-brands">
                  {BRANDS.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>

              <div className="rca-field">
                <label>Status</label>
                <div className="rca-btn-group">
                  {(['active', 'inactive'] as const).map(v => (
                    <button key={v} type="button" className={`rca-opt-btn${editing.status === v ? ' on' : ''}`} onClick={() => setField('status', v)}>
                      {v === 'active' ? 'Ativa' : 'Inativa'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rca-field">
                <label>Início</label>
                <input type="date" value={editing.startDate} onChange={e => setField('startDate', e.target.value)} />
              </div>

              <div className="rca-field">
                <label>Término</label>
                <input type="date" value={editing.endDate} onChange={e => setField('endDate', e.target.value)} />
              </div>

              <div className="rca-field rca-field-full">
                <label>Mecânica da campanha</label>
                <textarea
                  className="camp-textarea"
                  value={editing.mechanic}
                  onChange={e => setField('mechanic', e.target.value)}
                  placeholder="Descreva a mecânica: ex. compra 3 unidades da escova Colgate 360 e ganha brinde, ou leve 4 pague 3, etc."
                  rows={4}
                />
              </div>

              <div className="rca-field rca-field-full">
                <label>Observações</label>
                <textarea
                  className="camp-textarea"
                  value={editing.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="Informações adicionais, regras específicas, público-alvo…"
                  rows={3}
                />
              </div>
            </div>
            <div className="rca-modal-actions">
              <button className="process-button" style={{ margin: 0 }} type="button" onClick={save}>Salvar</button>
              <button className="add-button" style={{ marginTop: 0 }} type="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </section>
        </div>
      )}

      {/* ── cards ─────────────────────────────────────── */}
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
                  <span className="camp-brand-tag">{c.brand || '—'}</span>
                  {statusBadge(c.status)}
                </div>
              </div>
              {(c.startDate || c.endDate) && (
                <div className="camp-card-dates">
                  {c.startDate ? fmtDate(c.startDate) : '—'} → {c.endDate ? fmtDate(c.endDate) : '—'}
                </div>
              )}
              {c.mechanic && (
                <div className="camp-card-mechanic">{c.mechanic}</div>
              )}
              {c.notes && (
                <div className="camp-card-notes">{c.notes}</div>
              )}
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
