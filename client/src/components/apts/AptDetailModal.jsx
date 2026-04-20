import { useState, useEffect, useRef } from 'react'
import { fmtAptDateBlock, fmtAptTime, coveringLabel, exportToICS } from '../../lib/aptUtils'
import { saveApt, delApt } from '../../lib/firestore'
import { useSpecialties, specialtyLabel } from '../../hooks/useSpecialties'

function PhaseChip({ label }) {
  return <span className="apt-detail-chip">{label}</span>
}

export default function AptDetailModal({ apt, note, careTeam = [], onClose }) {
  const specialties = useSpecialties()
  const [fullOpen, setFullOpen] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [draftValue, setDraftValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer  = useRef(null)
  const savedTimer = useRef(null)
  const pendingData = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (editingField) { cancelEdit(); return }
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, editingField])

  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const covering = coveringLabel(apt.covering)

  const dateStr = apt.dateTime
    ? new Date(apt.dateTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const ex = note?.extracted || null
  const labEntries = ex?.lab_flags ? Object.entries(ex.lab_flags) : []
  const symptoms = ex?.symptoms || []
  const medications = ex?.medications || []

  // ── Inline edit helpers ──────────────────────────────────────────────────────

  function startEdit(field, currentValue) {
    setEditingField(field)
    setDraftValue(currentValue ?? '')
  }

  function cancelEdit() {
    setEditingField(null)
    setDraftValue('')
  }

  async function commitEdit(field, value) {
    setEditingField(null)
    const base = pendingData.current ?? apt
    if (value === (base[field] ?? '')) return
    const updated = { ...base, [field]: value }
    pendingData.current = updated
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveApt(pendingData.current, apt.id)
        pendingData.current = null
        setSaveStatus('saved')
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
  }

  function InlineField({ field, value, type = 'text', placeholder = '' }) {
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
    return (
      <span
        className="inline-val"
        tabIndex={0}
        onClick={() => startEdit(field, value)}
        onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
      >
        {value || ''}
      </span>
    )
  }

  function InlineTextarea({ field, value, placeholder = '' }) {
    if (editingField === field) {
      return (
        <textarea
          className="inline-input"
          rows={4}
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
        {value || <span style={{ color: 'var(--text3)' }}>Not documented</span>}
      </span>
    )
  }

  function InlineDoctorSelect({ field, value }) {
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
          <option value="">Select doctor…</option>
          {careTeam.map(dr => (
            <option key={dr.id} value={dr.name}>
              {dr.name}{dr.specialty ? ` · ${specialtyLabel(specialties, dr.specialty)}` : ''}
            </option>
          ))}
        </select>
      )
    }
    return (
      <span
        className="apt-detail-chip"
        style={{ cursor: 'pointer' }}
        tabIndex={0}
        onClick={() => startEdit(field, value)}
        onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
        title="Click to edit"
      >
        {value || <span style={{ color: 'var(--text3)' }}>No doctor</span>}
      </span>
    )
  }

  function CoveringPills() {
    const options = [{ v: 'fanuel', l: 'Fanuel' }, { v: 'saron', l: 'Saron' }]
    const current = (pendingData.current ?? apt).covering
    return (
      <>
        {options.map(({ v, l }) => {
          const selected = current === v
          return (
            <span
              key={v}
              className={`covering-pill${selected ? ` ${v}` : ''}`}
              style={{ cursor: 'pointer', opacity: selected ? 1 : 0.4 }}
              tabIndex={0}
              onClick={() => commitEdit('covering', current === v ? '' : v)}
              onKeyDown={e => e.key === 'Enter' && commitEdit('covering', current === v ? '' : v)}
              title={selected ? `Remove ${l}` : `Set ${l}`}
            >
              {l}
            </span>
          )
        })}
      </>
    )
  }

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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                <InlineField field="title" value={apt.title} placeholder="Appointment title" />
              </div>
              <div className="note-meta">
                <InlineField field="dateTime" value={apt.dateTime} type="datetime-local" />
              </div>
            </div>
          </div>
          <div className="apt-detail-header-right">
            {saveStatus !== 'idle' && (
              <span className={`autosave-pill ${saveStatus}`}>
                <span className="autosave-pill-dot" />
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved'  && 'Saved'}
                {saveStatus === 'error'  && 'Error'}
              </span>
            )}
            <button className="btn-export-ics" onClick={() => exportToICS(apt)} aria-label="Export to calendar" title="Export to calendar (.ics)">
              📅
            </button>
            <button className="btn-delete-detail" onClick={async () => {
              if (!confirm(`Remove "${apt.title}"?`)) return
              try { await delApt(apt.id); onClose() } catch { alert('Failed to delete. Check your connection.') }
            }} aria-label="Delete">🗑</button>
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Appointment meta — inline editable */}
        <div className="apt-detail-meta">
          <InlineDoctorSelect field="doctor" value={apt.doctor} />
          {editingField === 'location'
            ? <input
                className="inline-input"
                value={draftValue}
                autoFocus
                onChange={e => setDraftValue(e.target.value)}
                onBlur={() => commitEdit('location', draftValue)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit('location', draftValue)
                  if (e.key === 'Escape') cancelEdit()
                }}
                placeholder="Location"
                style={{ minWidth: 120 }}
              />
            : <span
                className="apt-detail-chip"
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                onClick={() => startEdit('location', apt.location)}
                onKeyDown={e => e.key === 'Enter' && startEdit('location', apt.location)}
                title="Click to edit location"
              >
                {apt.location || <span style={{ color: 'var(--text3)' }}>Add location</span>}
              </span>
          }
          <CoveringPills />
        </div>

        {/* Prep & Post — inline editable */}
        <div className="note-key-section">
          <div className="note-key-label">Prep &amp; Questions</div>
          <InlineTextarea field="prep" value={apt.prep} placeholder="Pre-visit instructions, questions to ask…" />
        </div>
        <div className="note-key-section">
          <div className="note-key-label">Appointment Notes</div>
          <InlineTextarea field="postNotes" value={apt.postNotes} placeholder="Follow-up notes from the visit…" />
        </div>

        {/* Clinical note sections — read-only */}
        {note && ex && (
          <>
            <div className="note-key-label" style={{ marginTop: 20, marginBottom: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              Clinical Note
            </div>

            {(ex.treatment_phase || ex.regimen || ex.cycle != null) && (
              <div className="apt-detail-phase-strip">
                {ex.treatment_phase && <PhaseChip label={ex.treatment_phase} />}
                {ex.regimen && <PhaseChip label={ex.regimen} />}
                {ex.cycle != null && <PhaseChip label={`Cycle ${ex.cycle}`} />}
              </div>
            )}

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

            {ex.patient_update && (
              <div className="note-key-section">
                <div className="note-key-label">Patient Update</div>
                <div className="note-key-text">{ex.patient_update}</div>
              </div>
            )}
            {ex.dr_assessment && (
              <div className="note-key-section">
                <div className="note-key-label">Impression</div>
                <div className="note-key-text">{ex.dr_assessment}</div>
              </div>
            )}
            {ex.next_steps && (
              <div className="note-key-section">
                <div className="note-key-label">Plan / Next Steps</div>
                <div className="note-key-text">{ex.next_steps}</div>
              </div>
            )}

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
