import { useState } from 'react'
import { fmtAptDateBlock, fmtAptTime, coveringLabel, typeLabel } from '../../lib/aptUtils'
import { SPECIALTIES } from '../../lib/noteUtils'
import { delApt } from '../../lib/firestore'
import ClinicalNoteModal from './ClinicalNoteModal'

export default function AptCard({ apt, status, onEdit, note }) {
  const [open, setOpen] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const tl = typeLabel(apt.type)

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirm(`Remove "${apt.title}"?`)) return
    try { await delApt(apt.id) } catch { alert('Failed to delete. Check your connection.') }
  }

  return (
    <div className={`apt-card ${status}`} data-apt-id={apt.id}>
      <div className="apt-card-top" onClick={() => setOpen(o => !o)}>
        <div className="apt-date">
          <div className="apt-date-month">{db.month}</div>
          <div className="apt-date-day">{db.day}</div>
        </div>
        <div className="apt-divider" />
        <div className="apt-body">
          <div className="apt-title">{apt.title}</div>
          {time && <div className="apt-time">{time}</div>}
          <div className="apt-meta">
            {apt.doctor && <span className="apt-doctor">{apt.doctor}</span>}
            {apt.location && <span className={`apt-location${apt.doctor ? ' has-doctor' : ''}`}>{apt.location}</span>}
            {tl && <span className="type-chip">{tl}</span>}
            {apt.specialty && (
              <span className={`specialty-chip ${apt.specialty}`}>
                {SPECIALTIES[apt.specialty] || apt.specialty}
              </span>
            )}
          </div>
        </div>
        {apt.covering && (
          <span className={`covering-pill ${apt.covering}`}>{coveringLabel(apt.covering)}</span>
        )}
        <div className="apt-actions" onClick={e => e.stopPropagation()}>
          <button className="act-icon" title="Edit" onClick={() => onEdit(apt.id)}>✏️</button>
          <button className="act-icon del" title="Delete" onClick={handleDelete}>🗑</button>
        </div>
        <span className={`apt-chevron${open ? ' open' : ''}`}>▼</span>
      </div>
      <div className={`apt-expand${open ? ' open' : ''}`}>
        <div className="apt-expand-grid">
          <div>
            <div className="expand-section-label">Prep &amp; questions</div>
            {apt.prep
              ? <div className="expand-text">{apt.prep}</div>
              : <div className="expand-empty">None added</div>}
          </div>
          <div>
            <div className="expand-section-label">Post appointment notes</div>
            {apt.postNotes
              ? <div className="expand-text">{apt.postNotes}</div>
              : <div className="expand-empty">None added</div>}
          </div>
        </div>
        {note && (
          <div style={{ marginTop: 10 }}>
            <button className="note-btn" onClick={e => { e.stopPropagation(); setShowNote(true) }}>
              📋 Clinical Note
            </button>
          </div>
        )}
      </div>

      {showNote && note && (
        <ClinicalNoteModal note={note} onClose={() => setShowNote(false)} />
      )}
    </div>
  )
}
