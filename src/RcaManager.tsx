import { useState, useEffect } from 'react'

/* ── types ───────────────────────────────────────────── */
export interface RcaRecord {
  code: string
  name: string
  city: string
  supervisor: string
  supervisorCode: string
  type: 'clt' | 'pj' | ''
  class: string
  goal: number | null
  active: boolean
}

const CLASS_LABEL: Record<string, string> = {
  varejo: 'Varejo',
  medias_contas: 'Médias Contas',
  grandes_contas: 'Grandes Contas',
  televendas: 'Televendas',
}

/* ── localStorage helpers (exported for other tabs) ─── */
export function readRcas(): RcaRecord[] {
  try { const v = localStorage.getItem('rj-rcas'); return v ? (JSON.parse(v) as RcaRecord[]) : [] }
  catch { return [] }
}

function persistRcas(list: RcaRecord[]) {
  try {
    localStorage.setItem('rj-rcas', JSON.stringify(list))
    window.dispatchEvent(new Event('rj-rcas-changed'))
  } catch { /* quota */ }
}

/* ── empty form ──────────────────────────────────────── */
const EMPTY: RcaRecord = { code: '', name: '', city: '', supervisor: '', supervisorCode: '', type: '', class: '', goal: null, active: true }

/* ── RcaManager ──────────────────────────────────────── */
export function RcaManager() {
  const [rcas, setRcas] = useState<RcaRecord[]>(readRcas)
  const [editing, setEditing] = useState<RcaRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])

  useEffect(() => {
    const onUpdate = () => setRcas(readRcas())
    window.addEventListener('rj-rcas-changed', onUpdate)
    return () => window.removeEventListener('rj-rcas-changed', onUpdate)
  }, [])

  function persist(updated: RcaRecord[]) {
    setRcas(updated)
    persistRcas(updated)
  }

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setFormErrors([]) }
  function openEdit(r: RcaRecord) { setEditing({ ...r }); setIsNew(false); setFormErrors([]) }

  function validate(r: RcaRecord): string[] {
    const e: string[] = []
    if (!r.code.trim()) e.push('Código é obrigatório.')
    if (!r.name.trim()) e.push('Nome é obrigatório.')
    if (isNew && rcas.some(x => x.code === r.code.trim())) e.push('Código já cadastrado.')
    return e
  }

  function save() {
    if (!editing) return
    const errs = validate(editing)
    if (errs.length) { setFormErrors(errs); return }
    const cleaned: RcaRecord = { ...editing, code: editing.code.trim(), name: editing.name.trim() }
    persist(isNew ? [...rcas, cleaned] : rcas.map(r => r.code === cleaned.code ? cleaned : r))
    setEditing(null)
  }

  function toggleActive(code: string) {
    persist(rcas.map(r => r.code === code ? { ...r, active: !r.active } : r))
  }

  function remove(code: string) {
    if (!confirm('Excluir este vendedor permanentemente?')) return
    persist(rcas.filter(r => r.code !== code))
  }

  function setField<K extends keyof RcaRecord>(key: K, val: RcaRecord[K]) {
    setEditing(v => v ? { ...v, [key]: val } : v)
    setFormErrors([])
  }

  const q = search.toLowerCase()
  const filtered = rcas.filter(r =>
    (showInactive || r.active) &&
    (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.supervisor.toLowerCase().includes(q) || r.city.toLowerCase().includes(q))
  )

  return (
    <div className="rca-manager">
      <div className="rca-toolbar">
        <input
          className="stock-search"
          style={{ flex: 1 }}
          placeholder="Buscar por nome, código, supervisor, cidade…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="rca-show-inactive">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Mostrar inativos
        </label>
        <button className="process-button" style={{ margin: 0, flexShrink: 0 }} type="button" onClick={openNew}>
          + Novo vendedor
        </button>
      </div>

      <div className="rca-count">
        {filtered.length} vendedor{filtered.length !== 1 ? 'es' : ''} {showInactive ? '' : 'ativos'}
        <span style={{ marginLeft: 12, color: 'var(--muted)' }}>· {rcas.filter(r => !r.active).length} inativos no total</span>
      </div>

      {/* ── modal ─────────────────────────────────────── */}
      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="modal rca-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="close" type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button>
            <h2 style={{ marginBottom: 18 }}>{isNew ? 'Novo vendedor' : 'Editar vendedor'}</h2>
            {formErrors.length > 0 && (
              <ul className="rca-errors">
                {formErrors.map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
            <div className="rca-form">
              <div className="rca-field">
                <label>Código *</label>
                <input
                  disabled={!isNew}
                  value={editing.code}
                  onChange={e => setField('code', e.target.value)}
                  placeholder="Ex.: 416"
                  autoFocus={isNew}
                />
              </div>
              <div className="rca-field">
                <label>Nome *</label>
                <input
                  value={editing.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="rca-field">
                <label>Cidade</label>
                <input
                  value={editing.city}
                  onChange={e => setField('city', e.target.value)}
                  placeholder="Ex.: Rio de Janeiro"
                />
              </div>
              <div className="rca-field">
                <label>Supervisor</label>
                <input
                  value={editing.supervisor}
                  onChange={e => setField('supervisor', e.target.value)}
                  placeholder="Nome do supervisor"
                  list="rca-supervisors"
                />
                <datalist id="rca-supervisors">
                  {[...new Set(rcas.map(r => r.supervisor).filter(Boolean))].map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="rca-field">
                <label>Cód. Supervisor</label>
                <input
                  value={editing.supervisorCode}
                  onChange={e => setField('supervisorCode', e.target.value)}
                  placeholder="Ex.: 10"
                />
              </div>
              <div className="rca-field">
                <label>Tipo</label>
                <div className="rca-btn-group">
                  {(['', 'clt', 'pj'] as const).map(v => (
                    <button key={v} type="button" className={`rca-opt-btn${editing.type === v ? ' on' : ''}`} onClick={() => setField('type', v)}>
                      {v === '' ? '—' : v.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rca-field">
                <label>Classe</label>
                <div className="rca-btn-group">
                  {([['', '—'], ['varejo', 'Varejo'], ['medias_contas', 'Médias'], ['grandes_contas', 'Grandes'], ['televendas', 'Telev.']] as const).map(([v, label]) => (
                    <button key={v} type="button" className={`rca-opt-btn${editing.class === v ? ' on' : ''}`} onClick={() => setField('class', v)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rca-field rca-field-full">
                <label>Meta mensal (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={editing.goal ?? ''}
                  onChange={e => setField('goal', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Ex.: 50000"
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

      {/* ── tabela ────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table className="gr-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Cidade</th>
              <th>Supervisor</th>
              <th>Tipo</th>
              <th>Classe</th>
              <th className="n-right">Meta</th>
              <th>Status</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.code} className={`gr-row${!r.active ? ' rca-inactive-row' : ''}`}>
                <td><span className="rca-code">{r.code}</span></td>
                <td>
                  <div className="gr-seller-name">{r.name}</div>
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.city || '—'}</td>
                <td style={{ fontSize: 12 }}>{r.supervisor || '—'}</td>
                <td>
                  {r.type
                    ? <span className={`rca-badge rca-type-${r.type}`}>{r.type.toUpperCase()}</span>
                    : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.class ? (CLASS_LABEL[r.class] ?? r.class) : '—'}</td>
                <td className="n-right" style={{ fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
                  {r.goal
                    ? `R$ ${r.goal.toLocaleString('pt-BR')}`
                    : <span style={{ color: 'var(--muted)', fontWeight: 400 }}>—</span>}
                </td>
                <td>
                  <span className={`rca-badge ${r.active ? 'rca-badge-active' : 'rca-badge-inac'}`}>
                    {r.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <div className="rca-actions">
                    <button type="button" className="rca-btn" onClick={() => openEdit(r)}>Editar</button>
                    <button type="button" className="rca-btn" onClick={() => toggleActive(r.code)}>
                      {r.active ? 'Inativar' : 'Reativar'}
                    </button>
                    <button type="button" className="rca-btn rca-btn-del" onClick={() => remove(r.code)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '28px 0' }}>
                  {rcas.length ? 'Nenhum resultado para a busca.' : 'Nenhum vendedor cadastrado. Clique em "+ Novo vendedor" para começar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
