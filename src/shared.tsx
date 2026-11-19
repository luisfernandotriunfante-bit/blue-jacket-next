import React, { useState } from 'react'

export function KpiCard({ label, value, accent, sub, percent, pctLabel }: {
  label: string; value: string; accent?: 'blue' | 'red' | 'white'; sub?: string;
  percent?: number; pctLabel?: string
}) {
  const r = 10, cx = 14, cy = 14, size = 28
  const circ = 2 * Math.PI * r
  const filled = percent !== undefined ? (Math.min(100, Math.max(0, percent)) / 100) * circ : 0
  const ringColor = accent === 'blue' ? 'var(--blue)' : accent === 'red' ? 'var(--red)' : accent === 'white' ? 'var(--white)' : 'var(--muted)'
  const showRing = percent !== undefined
  const showSub = !!(pctLabel ?? sub)
  return (
    <div className={`kpi-card${accent ? ` kpi-${accent}` : ''}`}>
      <div className="kpi-card-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {(showRing || showSub) && (
          <div className="kpi-ring-row">
            {showRing && (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="kpi-ring-svg" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringColor} strokeWidth={2.5}
                  strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
              </svg>
            )}
            {showSub && <span className="kpi-pct">{pctLabel ?? sub}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function FilterDrop({ label, options, selected, onSelect, single, open, onToggle }: {
  label: string
  options: string[]
  selected: string[]
  onSelect: (vals: string[]) => void
  single?: boolean
  open: boolean
  onToggle: () => void
}) {
  const [q, setQ] = useState('')
  const fq = q.toLowerCase()
  const vis = fq ? options.filter(o => o.toLowerCase().includes(fq)) : options
  return (
    <div className="pf-filter-drop" onClick={e => e.stopPropagation()}>
      <button type="button" className={`pf-filter-btn${selected.length > 0 ? ' has-value' : ''}${open ? ' open' : ''}`} onClick={onToggle}>
        {label}
        {selected.length > 0 && <span className="pf-filter-count">{selected.length}</span>}
        <span className="pf-arrow">&#9660;</span>
      </button>
      {open && (
        <div className="pf-filter-panel" onClick={e => e.stopPropagation()}>
          {options.length > 8 && (
            <input className="pf-panel-search" placeholder="Filtrar..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
          )}
          {single ? (
            <>
              <label><input type="radio" name={`fd-${label}`} checked={selected.length === 0} onChange={() => { onSelect([]); onToggle() }} /> Todos</label>
              {vis.map(o => (
                <label key={o}><input type="radio" name={`fd-${label}`} checked={selected.includes(o)} onChange={() => { onSelect([o]); onToggle() }} /> {o}</label>
              ))}
            </>
          ) : (
            <>
              {selected.length > 0 && (
                <label style={{ color: 'var(--red)', fontWeight: 600 }}><input type="checkbox" checked={false} onChange={() => onSelect([])} /> Limpar seleção</label>
              )}
              {vis.map(o => (
                <label key={o}><input type="checkbox" checked={selected.includes(o)} onChange={() => {
                  const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]
                  onSelect(next)
                }} /> {o}</label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function MiniDonut({ percent, color, size = 20 }: { percent: number; color: string; size?: number }) {
  const r = (size - 4) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = (clamped / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" className="kpi-ring-svg-anim" />
    </svg>
  )
}
