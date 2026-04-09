import { useState, useEffect, useRef } from 'react'
import { saveMed } from '../../lib/firestore'

const EMPTY = {
  name: '', dose: '', frequencyPreset: 'once-daily',
  frequencyCustomCount: '1', frequencyCustomEvery: '1', frequencyCustomUnit: 'days',
  filledDate: '', supply: '', refillDate: '', pharmacy: '', rxNum: '',
  doctor: '', instructions: '', notes: ''
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
  const [saveStatus, setSaveStatus] = useState('idle')
  const [creating, setCreating] = useState(false)
  const saveTimer = useRef(null)
  const isDirty = useRef(false)

  const isEditing = !!editId

  useEffect(() => {
    isDirty.current = false
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
        instructions: m.instructions || '', notes: m.notes || ''
      })
    }
  }, [editId])

  useEffect(() => {
    if (!isEditing || !isDirty.current) return
    if (!form.name.trim() || !form.filledDate || !form.supply) return
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveMed(form, editId)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 700)
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

  const isOpen = editId !== undefined

  return (
    <div className="modal-bg" style={{ display: isOpen ? 'flex' : 'none' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-task-header">
          <h2>{isEditing ? 'Edit medication' : 'Add medication'}</h2>
          <div className="modal-header-right">
            {isEditing && (
              <span className="autosave-status">
                {saveStatus === 'saving' && <span className="autosave-saving">Saving…</span>}
                {saveStatus === 'saved' && <span className="autosave-saved">Saved ✓</span>}
              </span>
            )}
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-section">Medication info</div>
        <div className="fr"><label>Name <span className="req">*</span></label>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Metformin" /></div>
        <div className="f2">
          <div className="fr"><label>Dose / strength</label>
            <input value={form.dose} onChange={set('dose')} placeholder="e.g. 500 mg" /></div>
          <div className="fr"><label>Frequency <span className="req">*</span></label>
            <select value={form.frequencyPreset} onChange={set('frequencyPreset')}>
              {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        {form.frequencyPreset === 'custom' && (
          <div className="f2">
            <div className="fr"><label>Pills per dose</label>
              <input type="number" min="0.5" step="0.5" value={form.frequencyCustomCount} onChange={set('frequencyCustomCount')} placeholder="1" /></div>
            <div className="fr"><label>Every</label>
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

        <div className="modal-section">Supply tracking</div>
        <div className="f2">
          <div className="fr"><label>Date last filled <span className="req">*</span></label>
            <input type="date" value={form.filledDate} onChange={set('filledDate')} /></div>
          <div className="fr"><label>Pills in bottle <span className="req">*</span></label>
            <input type="number" min="1" value={form.supply} onChange={set('supply')} placeholder="e.g. 30" /></div>
        </div>
        <div className="fr"><label>Next refill date <span className="fr-hint" style={{textTransform:'none',letterSpacing:0}}>optional — overrides calculated date</span></label>
          <input type="date" value={form.refillDate} onChange={set('refillDate')} /></div>

        <div className="modal-section">Pharmacy</div>
        <div className="fr"><label>Pharmacy</label>
          <input value={form.pharmacy} onChange={set('pharmacy')} placeholder="e.g. CVS, Walgreens" /></div>
        <div className="f2">
          <div className="fr"><label>Rx number</label>
            <input value={form.rxNum} onChange={set('rxNum')} placeholder="optional" /></div>
          <div className="fr"><label>Doctor</label>
            <select value={form.doctor} onChange={set('doctor')}>
              <option value="">No doctor</option>
              {careTeam.map(dr => (
                <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${dr.specialty}` : ''}</option>
              ))}
            </select></div>
        </div>

        <div className="modal-section">Notes</div>
        <div className="fr"><label>Instructions</label>
          <textarea value={form.instructions} onChange={set('instructions')} placeholder="e.g. Take with food" /></div>
        <div className="fr"><label>Notes</label>
          <textarea value={form.notes} onChange={set('notes')} placeholder="Side effects, reminders, etc." /></div>

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
  )
}
