import { useState, useEffect, useRef } from 'react'
import { saveMed, delMed, updateRefillStatus, markRefilled } from '../../lib/firestore'
import { refillStatusLabel } from '../../lib/medUtils'

const EMPTY = {
  name: '', dose: '', frequencyPreset: 'once-daily',
  frequencyCustomCount: '1', frequencyCustomEvery: '1', frequencyCustomUnit: 'days',
  filledDate: '', supply: '', refillDate: '', pharmacy: '', rxNum: '',
  doctor: '', instructions: ''
}

const PRESETS = [
  { value: 'once-daily',      label: 'Once daily' },
  { value: 'twice-daily',     label: 'Twice daily' },
  { value: 'every-other-day', label: 'Every other day' },
  { value: 'as-needed',       label: 'As needed' },
  { value: 'custom',          label: 'Custom…' },
]

export default function MedModal({ meds, careTeam = [], editId, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [creating, setCreating] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const saveTimer = useRef(null)
  const savedTimer = useRef(null)
  const isDirty = useRef(false)
  const lastForm = useRef(null)
  const sheetRef = useRef(null)
  const dragStartY = useRef(null)

  const isEditing = !!editId
  const isOpen = editId !== undefined

  useEffect(() => {
    isDirty.current = false
    setConfirmRemove(false)
    if (!editId) { setForm(EMPTY); return }
    const m = meds.find(x => x.id === editId)
    if (m) {
      let preset = m.frequencyPreset
      if (!preset) {
        const f = parseFloat(m.frequency)
        if (f === 2)        preset = 'twice-daily'
        else if (f === 0.5) preset = 'every-other-day'
        else                preset = 'once-daily'
      }
      setForm({
        name: m.name || '', dose: m.dose || '',
        frequencyPreset: preset,
        frequencyCustomCount: m.frequencyCustomCount || '1',
        frequencyCustomEvery: m.frequencyCustomEvery || '1',
        frequencyCustomUnit:  m.frequencyCustomUnit  || 'days',
        filledDate: m.filledDate || '', supply: m.supply || '',
        refillDate: m.refillDate || '', pharmacy: m.pharmacy || '',
        rxNum: m.rxNum || '', doctor: m.doctor || '',
        instructions: m.instructions || ''
      })
    }
  }, [editId])

  useEffect(() => {
    if (!isEditing || !isDirty.current) return
    if (!form.name.trim() || !form.filledDate || !form.supply) return
    lastForm.current = form
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveMed(form, editId)
        setSaveStatus('saved')
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [form])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => {
      isDirty.current = true
      setForm(f => ({ ...f, [field]: e.target.value }))
    }
  }

  async function retryWrite() {
    if (!lastForm.current) return
    setSaveStatus('saving')
    try {
      await saveMed(lastForm.current, editId)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) { alert('Please enter the medication name.'); return }
    if (!form.filledDate)  { alert('Please enter the date the bottle was last filled.'); return }
    if (!form.supply)      { alert('Please enter how many pills were in the bottle.'); return }
    setCreating(true)
    try {
      await saveMed(form, null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setCreating(false)
  }

  async function handleRemove() {
    try {
      await delMed(editId)
      onClose()
    } catch { alert('Failed to remove. Check your connection.') }
  }

  async function handleRefillStatus(status) {
    const med = meds.find(x => x.id === editId)
    if (!med) return
    try { await updateRefillStatus(med, status) } catch { alert('Failed to update. Check your connection.') }
  }

  async function handleMarkRefilled() {
    const med = meds.find(x => x.id === editId)
    if (!med) return
    try { await markRefilled(med) } catch { alert('Failed to update. Check your connection.') }
  }

  // Swipe-to-dismiss touch handlers
  function onTouchStart(e) {
    dragStartY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (dragStartY.current === null || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function onTouchEnd(e) {
    if (dragStartY.current === null) return
    const delta = e.changedTouches[0].clientY - dragStartY.current
    dragStartY.current = null
    if (sheetRef.current) sheetRef.current.style.transform = ''
    if (delta > 80) onClose()
  }

  return (
    <>
      {isOpen && (
        <div className="sheet-backdrop" onClick={onClose} />
      )}
      <div
        ref={sheetRef}
        className={`edit-sheet${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="sheet-handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        <div
          className="sheet-header"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="sheet-title">{isEditing ? 'Edit medication' : 'Add medication'}</span>
          <div className="sheet-header-right">
            {saveStatus !== 'idle' && (
              <span
                className={`autosave-pill ${saveStatus}`}
                onClick={saveStatus === 'error' ? retryWrite : undefined}
              >
                <span className="autosave-pill-dot" />
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved'  && 'Saved'}
                {saveStatus === 'error'  && 'Not saved · Retry'}
              </span>
            )}
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="sheet-body">
          {isEditing && (() => {
            const med = meds.find(x => x.id === editId)
            const rs = med?.refillStatus || null
            const rsl = med ? refillStatusLabel(med) : null
            return (
              <div className="refill-status-panel">
                <div className="refill-status-panel-header">
                  <span className="sheet-section" style={{ margin: 0 }}>Refill status</span>
                  {rsl && <span className="refill-status-badge">{rsl}</span>}
                </div>
                <div className="refill-status-panel-actions">
                  {!rs && (
                    <button className="btn-ghost" onClick={() => handleRefillStatus('requested')}>Place request</button>
                  )}
                  {rs === 'requested' && <>
                    <button className="btn-ghost" onClick={() => handleRefillStatus('ready-pickup')}>Ready for pickup</button>
                    <button className="btn-ghost" onClick={() => handleRefillStatus('ready-courier')}>Ready for courier</button>
                  </>}
                  {rs === 'ready-pickup' && (
                    <button className="btn-ghost" onClick={() => handleRefillStatus('picked-up')}>Picked up</button>
                  )}
                  {rs === 'ready-courier' && (
                    <button className="btn-ghost" onClick={() => handleRefillStatus('delivered')}>Delivered</button>
                  )}
                  {(rs === 'picked-up' || rs === 'delivered') && (
                    <button className="btn-ghost" onClick={handleMarkRefilled}>Mark refilled</button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="sheet-section">Medication info</div>
          <div className="fr">
            <label>Name <span className="req">*</span></label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Metformin" />
          </div>
          <div className="f2">
            <div className="fr">
              <label>Dose / strength</label>
              <input value={form.dose} onChange={set('dose')} placeholder="e.g. 500 mg" />
            </div>
            <div className="fr">
              <label>Frequency <span className="req">*</span></label>
              <select value={form.frequencyPreset} onChange={set('frequencyPreset')}>
                {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {form.frequencyPreset === 'custom' && (
            <div className="f2">
              <div className="fr">
                <label>Pills per dose</label>
                <input type="number" min="0.5" step="0.5" value={form.frequencyCustomCount} onChange={set('frequencyCustomCount')} placeholder="1" />
              </div>
              <div className="fr">
                <label>Every</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" min="1" step="1" value={form.frequencyCustomEvery} onChange={set('frequencyCustomEvery')} placeholder="1" style={{ flex: 1 }} />
                  <select value={form.frequencyCustomUnit} onChange={set('frequencyCustomUnit')} style={{ flex: 1 }}>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="sheet-section">Supply tracking</div>
          <div className="f2">
            <div className="fr">
              <label>Last filled <span className="req">*</span></label>
              <input type="date" value={form.filledDate} onChange={set('filledDate')} />
            </div>
            <div className="fr">
              <label>Pills in bottle <span className="req">*</span></label>
              <input type="number" min="1" value={form.supply} onChange={set('supply')} placeholder="e.g. 30" />
            </div>
          </div>
          <div className="fr">
            <label>Next refill <span className="fr-hint" style={{ textTransform: 'none', letterSpacing: 0 }}>optional · overrides calculated date</span></label>
            <input type="date" value={form.refillDate} onChange={set('refillDate')} />
          </div>

          <div className="sheet-section">Pharmacy</div>
          <div className="f2-pharmacy">
            <div className="fr">
              <label>Pharmacy</label>
              <input value={form.pharmacy} onChange={set('pharmacy')} placeholder="e.g. Walgreens" />
            </div>
            <div className="fr">
              <label>Rx #</label>
              <input value={form.rxNum} onChange={set('rxNum')} placeholder="optional" />
            </div>
          </div>

          <div className="sheet-section">Doctor &amp; notes</div>
          <div className="fr">
            <label>Doctor</label>
            <select value={form.doctor} onChange={set('doctor')}>
              <option value="">No doctor</option>
              {careTeam.map(dr => (
                <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${dr.specialty}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="fr">
            <label>Instructions</label>
            <textarea value={form.instructions} onChange={set('instructions')} placeholder="e.g. Take with food" />
          </div>

          {isEditing && (
            <>
              <button className="btn-remove-med" onClick={() => setConfirmRemove(true)}>
                Remove medication
              </button>
              {confirmRemove && (
                <div className="remove-confirm-row">
                  <span>Are you sure?</span>
                  <button className="btn-confirm-cancel" onClick={() => setConfirmRemove(false)}>Cancel</button>
                  <button className="btn-confirm-remove" onClick={handleRemove}>Remove</button>
                </div>
              )}
            </>
          )}

          {!isEditing && (
            <div className="mf">
              <button className="btn-cx" onClick={onClose}>Cancel</button>
              <button className="btn-sv" onClick={handleCreate} disabled={creating}>
                {creating ? 'Adding…' : 'Add medication'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
