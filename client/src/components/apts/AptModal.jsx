import { useState, useEffect } from 'react'
import { saveApt } from '../../lib/firestore'
import { useSpecialties, specialtyLabel } from '../../hooks/useSpecialties'
import { useIsMobile } from '../../hooks/useIsMobile'

const EMPTY = {
  title: '', dateTime: '', doctor: '', location: '', covering: '',
  prep: '', postNotes: '', person: 'dad'
}

// Add-new only. Editing existing appointments is handled inline in AptDetailModal.
export default function AptModal({ careTeam = [], onClose }) {
  const specialties = useSpecialties()
  const isMobile = useIsMobile()
  const [form, setForm] = useState(EMPTY)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleCreate() {
    if (!form.title.trim()) { alert('Please enter the appointment title.'); return }
    if (!form.dateTime)     { alert('Please enter the date and time.'); return }
    if (!form.doctor)       { alert('Please select a doctor or provider.'); return }
    setCreating(true)
    try {
      await saveApt(form, null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setCreating(false)
  }

  const formContent = (
    <>
      <div className="sheet-section">Required</div>
      <div className="fr">
        <label>Person</label>
        <div className="person-radio-group">
          {['dad', 'mom'].map(p => (
            <button key={p} type="button"
              className={`person-radio-opt${form.person === p ? ` selected-${p}` : ''}`}
              onClick={() => setForm(f => ({ ...f, person: p }))}
            >
              {p === 'dad' ? 'Dad' : 'Mom'}
            </button>
          ))}
        </div>
      </div>
      <div className="fr">
        <label>Title <span className="req">*</span></label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. Cardiology follow-up" />
      </div>
      <div className="fr">
        <label>Date &amp; time <span className="req">*</span></label>
        <input type="datetime-local" value={form.dateTime} onChange={set('dateTime')} />
      </div>
      <div className="fr">
        <label>Doctor / provider <span className="req">*</span></label>
        <select value={form.doctor} onChange={set('doctor')}>
          <option value="">Select doctor…</option>
          {careTeam.map(dr => (
            <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${specialtyLabel(specialties, dr.specialty)}` : ''}</option>
          ))}
        </select>
      </div>

      <div className="sheet-section">Optional</div>
      <div className="fr">
        <label>Location</label>
        <input value={form.location} onChange={set('location')} placeholder="Clinic or hospital" />
      </div>
      <div className="fr">
        <label>Covering</label>
        <div className="assignee-pills covering-pills">
          {[{v:'fanuel',l:'Fanuel'},{v:'saron',l:'Saron'}].map(({v,l}) => {
            const selected = form.covering === v
            return (
              <button key={v} type="button"
                className={`assignee-pill${selected ? ' selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, covering: f.covering === v ? '' : v }))}
              >
                {selected && <span className="assignee-pill-dot" />}
                {l}
              </button>
            )
          })}
        </div>
      </div>
      <div className="fr">
        <label>Prep instructions &amp; questions</label>
        <textarea value={form.prep} onChange={set('prep')} placeholder="Pre-visit instructions, questions to ask…" style={{ minHeight: 80 }} />
      </div>
      <div className="fr">
        <label>Appointment notes</label>
        <textarea value={form.postNotes} onChange={set('postNotes')} placeholder="Follow-up notes from the visit…" style={{ minHeight: 80 }} />
      </div>

      <div className="mf">
        <button className="btn-cx" onClick={onClose}>Cancel</button>
        <button className="btn-sv" onClick={handleCreate} disabled={creating}>
          {creating ? 'Adding…' : 'Add appointment'}
        </button>
      </div>
    </>
  )

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sheet-title">Add appointment</span>
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          {formContent}
        </div>
      </div>
    )
  }

  return (
    <div className="fs-overlay" role="dialog" aria-modal="true">
      <div className="fs-header">
        <span className="fs-title">Add appointment</span>
        <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="fs-body">{formContent}</div>
    </div>
  )
}
