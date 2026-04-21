import { useState, useRef, useEffect } from 'react'
import { pillsNow, supplyStatus, supplyStatusLabel, refillStatusLabel, pillStatusClass, fmtDate, freqLabel } from '../../lib/medUtils'
import { saveMed, markRefilled, updateRefillStatus, delMed } from '../../lib/firestore'

const PRESETS = [
  { value: 'once-daily',      label: 'Once daily' },
  { value: 'twice-daily',     label: 'Twice daily' },
  { value: 'every-other-day', label: 'Every other day' },
  { value: 'as-needed',       label: 'As needed' },
  { value: 'custom',          label: 'Custom…' },
]

function InlineField({ field, value, type = 'text', placeholder = '', editCtx }) {
  const { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit } = editCtx
  if (editingField === field) {
    return (
      <input
        className="inline-input"
        type={type}
        value={draftValue}
        autoFocus
        onChange={e => setDraftValue(e.target.value)}
        onBlur={() => commitEdit(field, draftValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit(field, draftValue)
          if (e.key === 'Escape') cancelEdit()
        }}
        placeholder={placeholder}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <span
      className="inline-val"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); startEdit(field, value) }}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {value || <span style={{ color: 'var(--text3)' }}>—</span>}
    </span>
  )
}

function InlineTextarea({ field, value, placeholder = '', editCtx }) {
  const { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit } = editCtx
  if (editingField === field) {
    return (
      <textarea
        className="inline-input"
        rows={3}
        value={draftValue}
        autoFocus
        onChange={e => setDraftValue(e.target.value)}
        onBlur={() => commitEdit(field, draftValue)}
        onKeyDown={e => e.key === 'Escape' && cancelEdit()}
        placeholder={placeholder}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <span
      className="inline-val"
      style={{ whiteSpace: 'pre-wrap', display: 'block' }}
      tabIndex={0}
      onClick={e => { e.stopPropagation(); startEdit(field, value) }}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {value || <span style={{ color: 'var(--text3)' }}>—</span>}
    </span>
  )
}

function InlineSelect({ field, value, options, placeholder = '', editCtx }) {
  const { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit } = editCtx
  if (editingField === field) {
    return (
      <select
        className="inline-input"
        value={draftValue}
        autoFocus
        onChange={e => setDraftValue(e.target.value)}
        onBlur={() => commitEdit(field, draftValue)}
        onKeyDown={e => e.key === 'Escape' && cancelEdit()}
        onClick={e => e.stopPropagation()}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }
  const found = options.find(o => o.value === value)
  return (
    <span
      className="inline-val"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); startEdit(field, value) }}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {found ? found.label : (value || <span style={{ color: 'var(--text3)' }}>—</span>)}
    </span>
  )
}

export default function MedRow({ m, careTeam = [], isExpanded, onToggleExpand }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const menuRef = useRef()

  // Inline edit state
  const [editingField, setEditingField] = useState(null)
  const [draftValue, setDraftValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer   = useRef(null)
  const savedTimer  = useRef(null)
  const pendingData = useRef(null)

  const s = supplyStatus(m)
  const lbl = supplyStatusLabel(m)
  const rsl = refillStatusLabel(m)
  const p = pillsNow(m)
  const pct = p.tot > 0 ? Math.round((p.rem / p.tot) * 100) : 0
  const pc = pillStatusClass(p.rem, p.tot)
  const bc = pc === 'zero' || pc === 'low' ? 'var(--red)' : s === 'soon' ? 'var(--amber)' : 'var(--green)'
  const pillSt = p.rem <= 0 ? 'empty' : s
  const fl = freqLabel(m)
  const sub = [m.dose, m.rxNum ? 'Rx ' + m.rxNum : '', fl].filter(Boolean).join(' · ')
  const rd = m.refillDate ? fmtDate(m.refillDate) : (p.runOutDate ? fmtDate(p.runOutDate) + ' *' : '—')
  const rs = m.refillStatus || null

  useEffect(() => {
    if (!menuOpen) { setConfirming(false); return }
    function onOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [menuOpen])

  async function handleRefill(e) {
    e.stopPropagation()
    try { await markRefilled(m) } catch { alert('Failed to update. Check your connection.') }
    setMenuOpen(false)
  }

  async function handleRefillStatus(e, status) {
    e.stopPropagation()
    try { await updateRefillStatus(m, status) } catch { alert('Failed to update. Check your connection.') }
    setMenuOpen(false)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setMenuOpen(false)
    try { await delMed(m.id) } catch { alert('Failed to delete. Check your connection.') }
  }

  // ── Inline edit helpers ────────────────────────────────────────────────────

  function startEdit(field, currentValue) {
    setEditingField(field)
    setDraftValue(currentValue ?? '')
  }

  function cancelEdit() { setEditingField(null) }

  async function commitEdit(field, value) {
    setEditingField(null)
    const base = pendingData.current ?? m
    if (String(value) === String(base[field] ?? '')) return
    const updated = { ...base, [field]: value }
    pendingData.current = updated
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveMed(pendingData.current, m.id)
        pendingData.current = null
        setSaveStatus('saved')
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
  }

  const editCtx = { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit }

  const doctorOptions = [
    { value: '', label: 'No doctor' },
    ...careTeam.map(dr => ({ value: dr.name, label: dr.name + (dr.specialty ? ` · ${dr.specialty}` : '') }))
  ]

  return (
    <div className={`med-row${isExpanded ? ' row-open' : ''}`}>
      {/* ── Main row ── */}
      <div className="med-row-main" onClick={onToggleExpand}>

        {/* Col 1: Name + subtitle */}
        <div className="med-col-name">
          <div className="med-name">{m.name}</div>
          <div className="med-sub">
            {sub}
            {m.pharmacy && <span className="med-pharm-in-sub"> · {m.pharmacy}</span>}
          </div>
        </div>

        {/* Col 2: Pills + bar  (hidden on mobile) */}
        <div className="med-col-pills">
          <div className="pills-top">
            <span className={`pill-count ${pc}`}>{p.rem}</span>
            <span className="pill-of">/ {p.tot}</span>
          </div>
          <div className="bar-row">
            <div className="bar-bg">
              <div className="bar-fill" style={{ width: pct + '%', background: bc }} />
            </div>
            <span className="bar-pct">{pct}%</span>
          </div>
        </div>

        {/* Col 3: Status pill + optional refill badge  (on mobile also contains mini pills) */}
        <div className="med-col-status">
          <span className={`spill sp-${pillSt}`}>{lbl}</span>
          {rsl && <span className="refill-status-badge">{rsl}</span>}
          <div className="med-mobile-pills">
            <span className={`med-mobile-count ${pc}`}>
              {p.rem}<span className="med-mobile-of">/{p.tot}</span>
            </span>
            <div className="med-bar-mini">
              <div className="med-bar-mini-fill" style={{ width: pct + '%', background: bc }} />
            </div>
          </div>
        </div>

        {/* Col 4: Refill date  (hidden on tablet + mobile) */}
        <div className="med-col-date">{rd}</div>

        {/* Col 5: Pharmacy  (hidden on tablet + mobile) */}
        <div className="med-col-pharm">{m.pharmacy || '—'}</div>

        {/* Col 6: ⋯ menu  (hidden on mobile — actions live in drawer) */}
        <div className="med-col-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button
            className="med-menu-btn"
            onClick={() => { setMenuOpen(o => !o); setConfirming(false) }}
            title="Options"
          >
            ···
          </button>
          {menuOpen && (
            <div className="med-menu-pop">
              {!rs && (
                <button className="med-menu-item" onClick={e => handleRefillStatus(e, 'requested')}>Place request</button>
              )}
              {rs === 'requested' && <>
                <button className="med-menu-item" onClick={e => handleRefillStatus(e, 'ready-pickup')}>Ready for pickup</button>
                <button className="med-menu-item" onClick={e => handleRefillStatus(e, 'ready-courier')}>Ready for courier</button>
              </>}
              {rs === 'ready-pickup' && (
                <button className="med-menu-item" onClick={e => handleRefillStatus(e, 'picked-up')}>Picked up</button>
              )}
              {rs === 'ready-courier' && (
                <button className="med-menu-item" onClick={e => handleRefillStatus(e, 'delivered')}>Delivered</button>
              )}
              {(rs === 'picked-up' || rs === 'delivered') && (
                <button className="med-menu-item" onClick={handleRefill}>Mark refilled</button>
              )}
              <button
                className={`med-menu-item${confirming ? ' danger confirm' : ' danger'}`}
                onClick={handleDelete}
              >
                {confirming ? 'Confirm delete?' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline drawer — all fields, inline editable ── */}
      <div className={`med-drawer${isExpanded ? ' open' : ''}`}>
        <div className="med-drawer-inner">

          {/* Refill workflow actions */}
          <div className="med-drawer-actions">
            {saveStatus !== 'idle' && (
              <span className={`autosave-pill ${saveStatus}`} style={{ marginRight: 'auto' }}>
                <span className="autosave-pill-dot" />
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved'  && 'Saved'}
                {saveStatus === 'error'  && 'Error'}
              </span>
            )}
            {!rs && (
              <button className="btn-sv" onClick={e => handleRefillStatus(e, 'requested')}>Place request</button>
            )}
            {rs === 'requested' && <>
              <button className="btn-sv" onClick={e => handleRefillStatus(e, 'ready-pickup')}>Ready for pickup</button>
              <button className="btn-sv" onClick={e => handleRefillStatus(e, 'ready-courier')}>Ready for courier</button>
            </>}
            {rs === 'ready-pickup' && (
              <button className="btn-sv" onClick={e => handleRefillStatus(e, 'picked-up')}>Picked up</button>
            )}
            {rs === 'ready-courier' && (
              <button className="btn-sv" onClick={e => handleRefillStatus(e, 'delivered')}>Delivered</button>
            )}
            {(rs === 'picked-up' || rs === 'delivered') && (
              <button className="btn-sv" onClick={handleRefill}>Mark refilled</button>
            )}
          </div>

          {/* All fields — inline editable */}
          <div className="med-drawer-details">

            {/* Name — full width */}
            <div className="med-drawer-item" style={{ gridColumn: '1 / -1' }}>
              <span className="med-drawer-lbl">Name</span>
              <InlineField field="name" value={m.name} placeholder="e.g. Metformin" editCtx={editCtx} />
            </div>

            {/* Dose + Frequency */}
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Dose / strength</span>
              <InlineField field="dose" value={m.dose} placeholder="e.g. 500 mg" editCtx={editCtx} />
            </div>
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Frequency</span>
              <InlineSelect
                field="frequencyPreset"
                value={m.frequencyPreset || 'once-daily'}
                options={PRESETS}
                editCtx={editCtx}
              />
            </div>

            {/* Custom frequency sub-fields */}
            {(pendingData.current ?? m).frequencyPreset === 'custom' && <>
              <div className="med-drawer-item">
                <span className="med-drawer-lbl">Pills / dose</span>
                <InlineField field="frequencyCustomCount" value={m.frequencyCustomCount} type="number" placeholder="1" editCtx={editCtx} />
              </div>
              <div className="med-drawer-item">
                <span className="med-drawer-lbl">Every (days)</span>
                <InlineField field="frequencyCustomEvery" value={m.frequencyCustomEvery} type="number" placeholder="1" editCtx={editCtx} />
              </div>
            </>}

            {/* Last filled + Supply */}
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Last filled</span>
              <InlineField field="filledDate" value={m.filledDate} type="date" editCtx={editCtx} />
            </div>
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Pills in bottle</span>
              <InlineField field="supply" value={m.supply} type="number" placeholder="e.g. 30" editCtx={editCtx} />
            </div>

            {/* Refill date + Pharmacy */}
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Next refill</span>
              <InlineField field="refillDate" value={m.refillDate} type="date" editCtx={editCtx} />
            </div>
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Pharmacy</span>
              <InlineField field="pharmacy" value={m.pharmacy} placeholder="e.g. Walgreens" editCtx={editCtx} />
            </div>

            {/* Rx # + Doctor */}
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Rx #</span>
              <InlineField field="rxNum" value={m.rxNum} placeholder="optional" editCtx={editCtx} />
            </div>
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Doctor</span>
              <InlineSelect field="doctor" value={m.doctor} options={doctorOptions} editCtx={editCtx} />
            </div>

            {/* Instructions — full width */}
            <div className="med-drawer-item" style={{ gridColumn: '1 / -1' }}>
              <span className="med-drawer-lbl">Instructions</span>
              <InlineTextarea field="instructions" value={m.instructions} placeholder="e.g. Take with food" editCtx={editCtx} />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
