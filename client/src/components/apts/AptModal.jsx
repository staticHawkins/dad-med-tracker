import { useState, useEffect } from 'react'
import { saveApt } from '../../lib/firestore'

const EMPTY = {
  title: '', dateTime: '', type: '', doctor: '', location: '', covering: '',
  prep: '', postNotes: ''
}

export default function AptModal({ apts, careTeam = [], editId, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!editId) { setForm(EMPTY); return }
    const a = apts.find(x => x.id === editId)
    if (a) setForm({
      title: a.title || '', dateTime: a.dateTime || '', type: a.type || '',
      doctor: a.doctor || '', location: a.location || '', covering: a.covering || '',
      prep: a.prep || '', postNotes: a.postNotes || ''
    })
  }, [editId, apts])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { alert('Please enter the appointment title.'); return }
    if (!form.dateTime)     { alert('Please enter the date and time.'); return }
    setSaving(true)
    try {
      await saveApt(form, editId || null)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1200)
    } catch { alert('Failed to save. Check your connection.') }
    setSaving(false)
  }

  const isOpen = editId !== undefined

  return (
    <div className="modal-bg" style={{ display: isOpen ? 'flex' : 'none' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{editId ? 'Edit appointment' : 'Add appointment'}</h2>

        <div className="modal-section">Appointment details</div>
        <div className="fr"><label>Title <span className="req">*</span></label>
          <input autoFocus value={form.title} onChange={set('title')} placeholder="e.g. Cardiology follow-up" /></div>
        <div className="f2">
          <div className="fr"><label>Date &amp; time <span className="req">*</span></label>
            <input type="datetime-local" value={form.dateTime} onChange={set('dateTime')} /></div>
          <div className="fr"><label>Type</label>
            <select value={form.type} onChange={set('type')}>
              <option value="">Select type…</option>
              <option value="checkup">Checkup</option>
              <option value="specialist">Specialist</option>
              <option value="lab">Lab / blood work</option>
              <option value="imaging">Imaging</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="modal-section">Provider &amp; location</div>
        <div className="fr"><label>Doctor / provider</label>
          <select value={form.doctor} onChange={set('doctor')}>
            <option value="">No doctor</option>
            {careTeam.map(dr => (
              <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${dr.specialty}` : ''}</option>
            ))}
          </select></div>
        <div className="f2">
          <div className="fr"><label>Location</label>
            <input value={form.location} onChange={set('location')} placeholder="Clinic or hospital" /></div>
          <div className="fr"><label>Covering</label>
            <select value={form.covering} onChange={set('covering')}>
              <option value="">Select…</option>
              <option value="fanuel">Fanuel</option>
              <option value="saron">Saron</option>
              <option value="both">Both</option>
              <option value="tbd">TBD</option>
            </select>
          </div>
        </div>

        <div className="modal-section">Prep instructions &amp; questions</div>
        <div className="fr">
          <textarea value={form.prep} onChange={set('prep')} placeholder="Pre-visit instructions, questions to ask…" style={{ minHeight: 80 }} />
        </div>

        <div className="modal-section">Post appointment notes</div>
        <div className="fr">
          <textarea value={form.postNotes} onChange={set('postNotes')} placeholder="Follow-up notes from the visit…" style={{ minHeight: 80 }} />
        </div>

        <div className="mf">
          <button className="btn-cx" onClick={onClose}>Cancel</button>
          <button className="btn-sv" onClick={handleSave} disabled={saving}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
