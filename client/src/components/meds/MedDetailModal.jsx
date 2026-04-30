import { useState, useRef, useEffect } from 'react'
import { fmtDate, getRefillDate } from '../../lib/medUtils'
import { saveMed, updateRefillStatus, deactivateMed, reactivateMed } from '../../lib/firestore'
import { useIsMobile } from '../../hooks/useIsMobile'
import PersonChip from '../PersonChip'
import RefillModal from './RefillModal'

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
      />
    )
  }
  const display = type === 'date' && value ? fmtDate(value) : value
  return (
    <span
      className="inline-val"
      tabIndex={0}
      onClick={() => startEdit(field, value)}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {display || <span style={{ color: 'var(--text3)' }}>—</span>}
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
      />
    )
  }
  return (
    <span
      className="inline-val"
      style={{ whiteSpace: 'pre-wrap', display: 'block' }}
      tabIndex={0}
      onClick={() => startEdit(field, value)}
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
      onClick={() => startEdit(field, value)}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {found ? found.label : (value || <span style={{ color: 'var(--text3)' }}>—</span>)}
    </span>
  )
}

export default function MedDetailModal({ med, careTeam = [], onClose }) {
  const isMobile = useIsMobile()
  const [editingField, setEditingField] = useState(null)
  const [draftValue, setDraftValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [confirming, setConfirming] = useState(false)
  const [refillOpen, setRefillOpen] = useState(false)
  const saveTimer = useRef(null)
  const savedTimer = useRef(null)
  const pendingData = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !editingField) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, editingField])

  const m = med
  const isInactive = m.active === false
  const rs = m.refillStatus || null
  const rdDate = getRefillDate(m)
  const rd = rdDate ? fmtDate(rdDate) : '—'

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

  async function handleRefillStatus(status) {
    try { await updateRefillStatus(m, status) } catch { alert('Failed to update. Check your connection.') }
  }

  async function handleDeactivate() {
    if (!confirming) { setConfirming(true); return }
    try {
      await deactivateMed(m.id)
      onClose()
    } catch { alert('Failed to deactivate. Check your connection.') }
  }

  async function handleReactivate() {
    try {
      await reactivateMed(m.id)
      onClose()
    } catch { alert('Failed to reactivate. Check your connection.') }
  }

  const editCtx = { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit }

  const doctorOptions = [
    { value: '', label: 'No doctor' },
    ...careTeam.map(dr => ({ value: dr.name, label: dr.name + (dr.specialty ? ` · ${dr.specialty}` : '') }))
  ]

  const formContent = (
    <>
      <div className="med-drawer-actions">
        {saveStatus !== 'idle' && (
          <span className={`autosave-pill ${saveStatus}`} style={{ marginRight: 'auto' }}>
            <span className="autosave-pill-dot" />
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved'  && 'Saved'}
            {saveStatus === 'error'  && 'Error'}
          </span>
        )}
        {isInactive
          ? <button className="btn-sv" onClick={handleReactivate}>Reactivate</button>
          : <>
              {!rs && (
                <button className="btn-sv" onClick={() => handleRefillStatus('requested')}>Place request</button>
              )}
              {rs === 'requested' && <>
                <button className="btn-sv" onClick={() => handleRefillStatus('ready-pickup')}>Ready for pickup</button>
                <button className="btn-sv" onClick={() => handleRefillStatus('ready-courier')}>Ready for courier</button>
              </>}
              {rs === 'ready-pickup' && (
                <button className="btn-sv" onClick={() => handleRefillStatus('picked-up')}>Picked up</button>
              )}
              {rs === 'ready-courier' && (
                <button className="btn-sv" onClick={() => handleRefillStatus('delivered')}>Delivered</button>
              )}
              {(rs === 'picked-up' || rs === 'delivered') && (
                <button className="btn-sv" onClick={() => setRefillOpen(true)}>Mark refilled</button>
              )}
              <button
                className={`btn-cx drawer-deactivate${confirming ? ' danger' : ''}`}
                onClick={handleDeactivate}
              >
                {confirming ? 'Confirm?' : 'Deactivate'}
              </button>
            </>
        }
      </div>

      <div className="med-drawer-details">
        <div className="med-drawer-item" style={{ gridColumn: '1 / -1' }}>
          <span className="med-drawer-lbl">Name</span>
          <InlineField field="name" value={m.name} placeholder="e.g. Metformin" editCtx={editCtx} />
        </div>

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

        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Last filled</span>
          <InlineField field="filledDate" value={m.filledDate} type="date" editCtx={editCtx} />
        </div>
        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Pills in bottle</span>
          <InlineField field="supply" value={m.supply} type="number" placeholder="e.g. 30" editCtx={editCtx} />
        </div>

        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Runs out</span>
          <span style={{ color: 'var(--text2)' }}>{rd}</span>
        </div>
        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Pharmacy</span>
          <InlineField field="pharmacy" value={m.pharmacy} placeholder="e.g. Walgreens" editCtx={editCtx} />
        </div>

        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Rx #</span>
          <InlineField field="rxNum" value={m.rxNum} placeholder="optional" editCtx={editCtx} />
        </div>
        <div className="med-drawer-item">
          <span className="med-drawer-lbl">Doctor</span>
          <InlineSelect field="doctor" value={m.doctor} options={doctorOptions} editCtx={editCtx} />
        </div>

        <div className="med-drawer-item" style={{ gridColumn: '1 / -1' }}>
          <span className="med-drawer-lbl">Instructions</span>
          <InlineTextarea field="instructions" value={m.instructions} placeholder="e.g. Take with food" editCtx={editCtx} />
        </div>
      </div>
    </>
  )

  const header = (
    <span className="sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PersonChip person={m.person} />
      {m.name}
    </span>
  )

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !editingField) onClose() }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            {header}
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          {formContent}
        </div>
        {refillOpen && <RefillModal med={m} onClose={() => setRefillOpen(false)} />}
      </div>
    )
  }

  return (
    <>
      <div className="fs-overlay" role="dialog" aria-modal="true">
        <div className="fs-header">
          {header}
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="fs-body">{formContent}</div>
      </div>
      {refillOpen && <RefillModal med={m} onClose={() => setRefillOpen(false)} />}
    </>
  )
}
