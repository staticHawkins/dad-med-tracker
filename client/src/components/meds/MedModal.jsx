import { useState, useEffect } from 'react'
import { saveMed } from '../../lib/firestore'

const EMPTY = {
  name: '', dose: '', frequency: '', filledDate: '', supply: '',
  refillDate: '', pharmacy: '', rxNum: '', doctor: '', instructions: '', notes: ''
}

export default function MedModal({ meds, careTeam = [], editId, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editId) { setForm(EMPTY); return }
    const m = meds.find(x => x.id === editId)
    if (m) setForm({
      name: m.name || '', dose: m.dose || '', frequency: m.frequency || '',
      filledDate: m.filledDate || '', supply: m.supply || '', refillDate: m.refillDate || '',
      pharmacy: m.pharmacy || '', rxNum: m.rxNum || '', doctor: m.doctor || '',
      instructions: m.instructions || '', notes: m.notes || ''
    })
  }, [editId, meds])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Please enter the medication name.'); return }
    if (!form.frequency)   { alert('Please enter pills per day.'); return }
    if (!form.filledDate)  { alert('Please enter the date the bottle was last filled.'); return }
    if (!form.supply)      { alert('Please enter how many pills were in the bottle.'); return }
    setSaving(true)
    try {
      await saveMed(form, editId || null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setSaving(false)
  }

  const isOpen = editId !== undefined  // editId is null (new) or a string (edit)

  return (
    <div className="modal-bg" style={{ display: isOpen ? 'flex' : 'none' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{editId ? 'Edit medication' : 'Add medication'}</h2>

        <div className="modal-section">Medication info</div>
        <div className="fr"><label>Name <span className="req">*</span></label>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Metformin" /></div>
        <div className="f2">
          <div className="fr"><label>Dose / strength</label>
            <input value={form.dose} onChange={set('dose')} placeholder="e.g. 500 mg" /></div>
          <div className="fr"><label>Pills per day <span className="req">*</span></label>
            <input type="number" min="0.5" step="0.5" value={form.frequency} onChange={set('frequency')} placeholder="e.g. 1" /></div>
        </div>

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

        <div className="mf">
          <button className="btn-cx" onClick={onClose}>Cancel</button>
          <button className="btn-sv" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save medication'}
          </button>
        </div>
      </div>
    </div>
  )
}
