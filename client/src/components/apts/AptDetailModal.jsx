import { useState, useEffect } from 'react'
import { fmtAptDateBlock, fmtAptTime, coveringLabel, typeLabel } from '../../lib/aptUtils'
import { delApt } from '../../lib/firestore'

function Section({ label, value }) {
  return (
    <div className="note-key-section">
      <div className="note-key-label">{label}</div>
      {value
        ? <div className="note-key-text">{value}</div>
        : <div className="expand-empty">Not documented</div>}
    </div>
  )
}

function PhaseChip({ label }) {
  return <span className="apt-detail-chip">{label}</span>
}

export default function AptDetailModal({ apt, note, onClose, onEdit, onDelete }) {
  const [fullOpen, setFullOpen] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const tl = typeLabel(apt.type)
  const covering = coveringLabel(apt.covering)

  const dateStr = apt.dateTime
    ? new Date(apt.dateTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const ex = note?.extracted || null
  const labEntries = ex?.lab_flags ? Object.entries(ex.lab_flags) : []
  const symptoms = ex?.symptoms || []
  const medications = ex?.medications || []

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal note-modal">
        {/* Header */}
        <div className="apt-detail-header">
          <div className="apt-detail-header-left">
            <div className="apt-detail-date-block">
              <span className="apt-detail-month">{db.month}</span>
              <span className="apt-detail-day">{db.day}</span>
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{apt.title}</h2>
              <div className="note-meta">{dateStr}{time ? ` · ${time}` : ''}</div>
            </div>
          </div>
          <div className="apt-detail-header-right">
            <button className="btn-edit-detail" onClick={() => { onClose(); onEdit(apt.id) }}>Edit</button>
            <button className="btn-delete-detail" onClick={async () => {
              if (!confirm(`Remove "${apt.title}"?`)) return
              try { await delApt(apt.id); onClose() } catch { alert('Failed to delete. Check your connection.') }
            }} aria-label="Delete">🗑</button>
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Appointment meta */}
        <div className="apt-detail-meta">
          {apt.doctor && <span className="apt-detail-chip">{apt.doctor}</span>}
          {apt.location && <span className="apt-detail-chip">{apt.location}</span>}
          {tl && <span className="apt-detail-chip">{tl}</span>}
          {apt.covering && <span className={`covering-pill ${apt.covering}`}>{covering}</span>}
        </div>

        {/* Prep & Post */}
        <Section label="Prep & Questions" value={apt.prep} />
        <Section label="Post-Appointment Notes" value={apt.postNotes} />

        {/* Clinical note sections */}
        {note && ex && (
          <>
            <div className="note-key-label" style={{ marginTop: 20, marginBottom: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              Clinical Note
            </div>

            {/* Phase / regimen / cycle strip */}
            {(ex.treatment_phase || ex.regimen || ex.cycle != null) && (
              <div className="apt-detail-phase-strip">
                {ex.treatment_phase && <PhaseChip label={ex.treatment_phase} />}
                {ex.regimen && <PhaseChip label={ex.regimen} />}
                {ex.cycle != null && <PhaseChip label={`Cycle ${ex.cycle}`} />}
              </div>
            )}

            {/* Vitals */}
            {(ex.weight_lbs != null || ex.pain_score != null) && (
              <div className="apt-detail-vitals-row">
                {ex.weight_lbs != null && (
                  <div className="apt-detail-vital-box">
                    <span className="apt-detail-vital-num">{ex.weight_lbs}</span>
                    <span className="apt-detail-vital-lbl">lbs</span>
                  </div>
                )}
                {ex.pain_score != null && (
                  <div className="apt-detail-vital-box">
                    <span className="apt-detail-vital-num">{ex.pain_score}<span className="apt-detail-vital-denom">/10</span></span>
                    <span className="apt-detail-vital-lbl">Pain score</span>
                  </div>
                )}
              </div>
            )}

            <Section label="Patient Update" value={ex.patient_update} />
            <Section label="Impression" value={ex.dr_assessment} />
            <Section label="Plan / Next Steps" value={ex.next_steps} />

            {symptoms.length > 0 && (
              <div className="note-key-section">
                <div className="note-key-label">Symptoms</div>
                <div className="apt-detail-symptom-chips">
                  {symptoms.map((s, i) => <span key={i} className="apt-detail-symptom-chip">{s}</span>)}
                </div>
              </div>
            )}

            {labEntries.length > 0 && (
              <div className="note-key-section">
                <div className="note-key-label">Lab Values</div>
                <div className="apt-detail-labs-grid">
                  {labEntries.map(([k, v]) => (
                    <div key={k} className="apt-detail-lab-row">
                      <span className="apt-detail-lab-key">{k.replace(/_/g, ' ')}</span>
                      <span className="apt-detail-lab-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {medications.length > 0 && (
              <div className="note-key-section">
                <div className="note-key-label">Medications at Visit</div>
                <ul className="apt-detail-med-list">
                  {medications.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}

            {/* Full note toggle */}
            <button className="note-full-toggle" onClick={() => setFullOpen(o => !o)}>
              {fullOpen ? '▲ Hide full note' : '▶ Show full note'}
            </button>
            {fullOpen && <div className="note-full-text">{note.textContent}</div>}
          </>
        )}

      </div>
    </div>
  )
}
