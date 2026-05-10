import { useState, useEffect, useRef } from 'react'
import { todayStr } from '../../lib/medUtils'
import { addStayMed, removeStayMed, deleteHospitalMedLog, bulkAddStayMeds, deleteDoctorNote, deleteTestResult, clearTreatmentSummary, addStayTeamMember, deleteStayTeamMember } from '../../lib/firestore'
import { generateTreatmentSummary } from '../../lib/treatmentPlan'
import { deleteStayDocument } from '../../lib/storageUtils'
import { fetchDrugSuggestions } from '../../lib/fdaUtils'
import HospitalStayModal from './HospitalStayModal'
import DailyLogModal from './DailyLogModal'
import AddDocumentModal from './AddDocumentModal'
import BulkUploadModal from './BulkUploadModal'
import PersonChip from '../PersonChip'

const UNITS = ['mg', 'mcg', 'g', 'mL', 'L', 'units', 'IU', 'mEq', 'tablet(s)', 'capsule(s)', 'patch(es)', 'drop(s)', 'puff(s)']

const BSW_MEDS = [
  { name: 'docusate sodium',              dosage: 50,   unit: 'mg',       purpose: 'bowel regularity · oral daily' },
  { name: 'entecavir',                    dosage: 0.5,  unit: 'mg',       purpose: 'hepatitis B · oral every other day' },
  { name: 'furosemide',                   dosage: 20,   unit: 'mg',       purpose: 'diuretic · oral daily' },
  { name: 'heparin (porcine)',            dosage: 5000, unit: 'units',    purpose: 'DVT prevention · subq q12h' },
  { name: 'methylphenidate HCl',          dosage: 10,   unit: 'mg',       purpose: 'oral 2x daily' },
  { name: 'morphine',                     dosage: 15,   unit: 'mg',       purpose: 'pain · oral 2x daily' },
  { name: 'multivitamin',                 dosage: 1,    unit: 'tablet(s)', purpose: 'vitamins · oral daily at noon' },
  { name: 'OLANZapine',                   dosage: 5,    unit: 'mg',       purpose: 'oral nightly' },
  { name: 'oxyCODONE',                    dosage: 10,   unit: 'mg',       purpose: 'pain · oral 2x daily' },
  { name: 'pantoprazole',                 dosage: 40,   unit: 'mg',       purpose: 'acid reflux · oral daily before meal' },
  { name: 'spironolactone',               dosage: 25,   unit: 'mg',       purpose: 'fluid/heart · oral every other day' },
  { name: 'tamsulosin',                   dosage: 0.4,  unit: 'mg',       purpose: 'urinary · oral nightly' },
  { name: 'Al-MgOH-simethicone',          dosage: 30,   unit: 'mL',       purpose: 'indigestion · PRN q6h' },
  { name: 'benzocaine-menthol',           dosage: 1,    unit: 'lozenge',  purpose: 'sore throat/dry mouth · PRN q2h' },
  { name: 'magnesium hydroxide',          dosage: 30,   unit: 'mL',       purpose: 'constipation · PRN q12h' },
  { name: 'oxyCODONE (PRN)',              dosage: 10,   unit: 'mg',       purpose: 'severe pain 7-10 · PRN q8h' },
  { name: '0.9% sodium chloride (NaCl)', dosage: 250,  unit: 'mL',       purpose: 'NS · IV continuous pm' },
  { name: '0.9% sodium chloride (NaCl)', dosage: 15,   unit: 'mL',       purpose: 'NS · IV as needed' },
]

function dayCount(admissionDate) {
  const start = new Date(admissionDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((now - start) / 86400000) + 1)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(ts) {
  if (!ts || !ts.includes('T')) return ts || ''
  const [, time] = ts.split('T')
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${mStr} ${ampm}`
}

function getDaySlots(admissionDate) {
  const slots = []
  const start = new Date(admissionDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let d = new Date(today); d >= start; d.setDate(d.getDate() - 1)) {
    slots.push(d.toISOString().slice(0, 10))
  }
  return slots
}

function DocCard({ doc, isNote, stayId, onAfterDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete this ${isNote ? 'note' : 'result'}?`)) return
    setDeleting(true)
    try {
      if (doc.storagePath) {
        try { await deleteStayDocument(doc.storagePath) } catch {}
      }
      if (isNote) {
        await deleteDoctorNote(stayId, doc)
      } else {
        await deleteTestResult(stayId, doc)
      }
      onAfterDelete?.(doc, isNote)
    } finally {
      setDeleting(false)
    }
  }

  const title = isNote
    ? [doc.noteType, doc.author].filter(Boolean).join(' · ')
    : doc.testName || 'Test Result'

  return (
    <div className="doc-card">
      <div className="doc-card-header">
        <div className="doc-card-meta">
          <span className="doc-card-date">{fmtDate(doc.date)}</span>
          {title && <span className="doc-card-title">{title}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {doc.pdfUrl && (
            <a
              href={doc.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="doc-card-pdf-link"
              onClick={e => e.stopPropagation()}
            >
              PDF
            </a>
          )}
          <button
            className="stay-med-delete-btn"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete"
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>

      {doc.interpretation && (
        <div className="doc-card-body">
          <div
            className={`doc-card-interpretation${expanded ? ' doc-card-interpretation--expanded' : ''}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {doc.interpretation}
          </div>
          <div className="doc-card-actions">
            {doc.interpretation.length > 200 && (
              <button className="doc-card-toggle" onClick={() => setExpanded(v => !v)}>
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
            {doc.extractedText && (
              <button className="doc-card-toggle" onClick={() => setShowRaw(v => !v)}>
                {showRaw ? 'Hide raw text' : 'View raw text'}
              </button>
            )}
          </div>
          {showRaw && doc.extractedText && (
            <div className="doc-raw-text">{doc.extractedText}</div>
          )}
        </div>
      )}

      {!doc.interpretation && doc.extractedText && (
        <div className="doc-card-body">
          <div className="doc-card-no-interpretation">No interpretation — raw text only</div>
          <button className="doc-card-toggle" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? 'Hide raw text' : 'View raw text'}
          </button>
          {showRaw && <div className="doc-raw-text">{doc.extractedText}</div>}
        </div>
      )}
    </div>
  )
}

function StayTeamSection({ stay }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const team = stay.stayTeam || []

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await addStayTeamMember(stay.id, { name: name.trim(), role: role.trim() })
      setName('')
      setRole('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stay-team-section">
      <div className="stay-team-header">
        <span className="stay-team-title">Care Team</span>
        {!adding && (
          <button className="daily-log-add-med-btn" onClick={() => setAdding(true)}>+ Add</button>
        )}
      </div>
      {team.length === 0 && !adding && (
        <div className="stay-team-empty">No team members added yet.</div>
      )}
      {team.map(member => (
        <div key={member.id} className="stay-team-member">
          <div className="stay-team-member-info">
            <span className="stay-team-member-name">{member.name}</span>
            {member.role && <span className="stay-team-member-role">{member.role}</span>}
          </div>
          <button
            className="stay-team-delete"
            onClick={() => deleteStayTeamMember(stay.id, member)}
            aria-label={`Remove ${member.name}`}
          >
            ✕
          </button>
        </div>
      ))}
      {adding && (
        <div className="stay-team-add-form">
          <input
            type="text"
            placeholder="Name (e.g., Dr. Huynh)"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            placeholder="Role (e.g., Attending Nephrologist)"
            value={role}
            onChange={e => setRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="stay-team-add-actions">
            <button className="btn-primary" onClick={handleAdd} disabled={!name.trim() || saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button className="btn-ghost" onClick={() => { setAdding(false); setName(''); setRole('') }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function legacyParseTreatmentSummary(content) {
  const keys = ['CURRENT REGIMEN', 'RECENT DECISIONS', 'ACTIVE CONCERNS', 'NEXT STEPS']
  const labels = { 'CURRENT REGIMEN': 'Current regimen', 'RECENT DECISIONS': 'Recent decisions', 'ACTIVE CONCERNS': 'Active concerns', 'NEXT STEPS': 'Next steps' }
  return keys.flatMap((key, i) => {
    const start = content.indexOf(key)
    if (start === -1) return []
    const textStart = start + key.length
    const nextKey = keys.slice(i + 1).map(k => content.indexOf(k, textStart)).filter(p => p !== -1)
    const end = nextKey.length > 0 ? Math.min(...nextKey) : content.length
    const text = content.slice(textStart, end).replace(/^\n+/, '').trim()
    return text ? [{ problem: labels[key], summary: text }] : []
  })
}

function TreatmentSummaryCard({ stay, onRegenerate, regenerating }) {
  const [open, setOpen] = useState(true)
  const hasDocuments = (stay.doctorNotes?.length || 0) + (stay.testResults?.length || 0) > 0
  const summary = stay.treatmentSummary

  if (!hasDocuments) return null

  const problems = summary?.problems
    ?? (summary?.content ? legacyParseTreatmentSummary(summary.content) : null)

  const lastUpdated = summary?.updatedAt
    ? new Date(summary.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="treatment-plan-card">
      <button className="treatment-plan-header" onClick={() => setOpen(o => !o)}>
        <div className="treatment-plan-header-left">
          <span className="treatment-plan-icon">⊙</span>
          <span className="treatment-plan-title">Treatment Plan</span>
          {lastUpdated && !regenerating && (
            <span className="treatment-plan-updated">Updated {lastUpdated}</span>
          )}
          {regenerating && (
            <span className="treatment-plan-updated treatment-plan-updating">Updating…</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="treatment-plan-regen"
            onClick={e => { e.stopPropagation(); onRegenerate() }}
            style={{ pointerEvents: regenerating ? 'none' : 'auto', opacity: regenerating ? 0.4 : 1 }}
          >
            {regenerating ? 'Updating…' : summary ? 'Regenerate' : 'Generate'}
          </span>
          <span className={`daily-log-ai-chevron${open ? ' open' : ''}`}>›</span>
        </div>
      </button>

      {open && (
        <div className="treatment-plan-body">
          {!summary && !regenerating && (
            <div className="treatment-plan-empty">
              No treatment plan yet. Click Generate to create one from the uploaded notes and results.
            </div>
          )}
          {regenerating && (
            <div className="treatment-plan-loading">Synthesizing treatment plan from uploaded documents…</div>
          )}
          {!regenerating && problems && (
            <div className="treatment-plan-sections">
              {problems.map(({ problem, summary: text }) => (
                <div key={problem} className="treatment-plan-section">
                  <div className="treatment-plan-section-label">{problem}</div>
                  <div className="treatment-plan-section-text">{text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DaySlot({ dateStr, log, onClick, admissionDate }) {
  const isToday = dateStr === todayStr()
  const hasLog = !!log
  const dayNum = admissionDate
    ? Math.round((new Date(dateStr + 'T00:00:00') - new Date(admissionDate + 'T00:00:00')) / 86400000) + 1
    : null

  return (
    <button
      className={`day-slot${hasLog ? ' day-slot-filled' : ' day-slot-empty'}`}
      onClick={() => onClick(dateStr, log)}
    >
      <div className="day-slot-header">
        <span className="day-slot-label">
          {isToday ? 'Today' : fmtDate(dateStr)}
          {dayNum !== null && <span className="day-slot-day-num"> · Day {dayNum}</span>}
        </span>
        <span className="day-slot-action">
          {hasLog ? 'Edit ›' : '+ Add notes'}
        </span>
      </div>
      {hasLog && (
        <div className="day-slot-content">
          {log.notes && <div className="day-slot-notes">{log.notes}</div>}
          {log.careTeam && (
            <div className="day-slot-careteam">
              <span className="day-slot-careteam-label">Care team</span> {log.careTeam}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function ActiveStaySection({ stay, onEdit, onDayClick }) {
  const day = dayCount(stay.admissionDate)
  const slots = getDaySlots(stay.admissionDate)
  const logsByDate = Object.fromEntries((stay.dailyLogs || []).map(l => [l.date, l]))

  return (
    <div className="hospital-active-stay">
      <div className="hospital-stay-header">
        <div className="hospital-stay-header-left">
          <PersonChip person={stay.person} />
          <div>
            <div className="hospital-stay-title">
              Day {day} · {stay.hospital || 'Hospital'}
            </div>
            <div className="hospital-stay-meta">
              Admitted {fmtDate(stay.admissionDate)}
              {stay.department ? ` · ${stay.department}` : ''}
            </div>
            {stay.reason && <div className="hospital-stay-reason">{stay.reason}</div>}
          </div>
        </div>
        <button className="btn-ghost hospital-stay-edit-btn" onClick={onEdit}>Edit stay</button>
      </div>

      <div className="daily-logs-list">
        {slots.map(dateStr => (
          <DaySlot
            key={dateStr}
            dateStr={dateStr}
            log={logsByDate[dateStr] || null}
            onClick={onDayClick}
            admissionDate={stay.admissionDate}
          />
        ))}
      </div>
    </div>
  )
}

function StayMedsContent({ stayMeds = [], medLogs = [], stayId }) {
  const [expandedId, setExpandedId] = useState(null)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDosage, setAddDosage] = useState('')
  const [addUnit, setAddUnit] = useState('mg')
  const [addPurpose, setAddPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [bswConfirm, setBswConfirm] = useState(false)
  const [importing, setImporting] = useState(false)
  const nameInputRef = useRef(null)

  const existingNames = new Set(stayMeds.map(m => m.name.toLowerCase()))
  const bswToAdd = BSW_MEDS.filter(m => !existingNames.has(m.name.toLowerCase()))

  async function handleBswImport() {
    setImporting(true)
    try {
      await bulkAddStayMeds(stayId, bswToAdd)
      setBswConfirm(false)
    } finally {
      setImporting(false)
    }
  }

  const [fdaSuggestions, setFdaSuggestions] = useState([])
  const [fdaLoading, setFdaLoading]         = useState(false)
  const [fdaOpen, setFdaOpen]               = useState(false)
  const [fdaHighlight, setFdaHighlight]     = useState(-1)
  const fdaDebounce = useRef(null)
  const fdaAbort    = useRef(null)
  const fdaWrapRef  = useRef(null)

  useEffect(() => {
    if (addFormOpen && nameInputRef.current) nameInputRef.current.focus()
  }, [addFormOpen])

  useEffect(() => {
    if (!fdaOpen) return
    function handler(e) {
      if (fdaWrapRef.current && !fdaWrapRef.current.contains(e.target)) {
        setFdaOpen(false); setFdaHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fdaOpen])

  useEffect(() => {
    return () => {
      clearTimeout(fdaDebounce.current)
      if (fdaAbort.current) fdaAbort.current.abort()
    }
  }, [])

  function handleAddNameChange(e) {
    const val = e.target.value
    setAddName(val)
    if (val.trim().length < 2) {
      setFdaOpen(false); setFdaSuggestions([]); return
    }
    if (fdaAbort.current) fdaAbort.current.abort()
    clearTimeout(fdaDebounce.current)
    setFdaLoading(true); setFdaOpen(true)
    fdaDebounce.current = setTimeout(async () => {
      const ctrl = new AbortController()
      fdaAbort.current = ctrl
      const results = await fetchDrugSuggestions(val, ctrl.signal)
      if (ctrl.signal.aborted) return
      setFdaSuggestions(results)
      setFdaLoading(false)
      if (results.length === 0) setFdaOpen(false)
      setFdaHighlight(-1)
    }, 350)
  }

  function handleAddNameKeyDown(e) {
    if (!fdaOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFdaHighlight(h => Math.min(h + 1, fdaSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFdaHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && fdaHighlight >= 0) {
      e.preventDefault()
      handleAddSuggestionSelect(fdaSuggestions[fdaHighlight])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setFdaOpen(false); setFdaHighlight(-1)
    }
  }

  function handleAddSuggestionSelect(s) {
    setAddName(s.genericName)
    clearTimeout(fdaDebounce.current)
    if (fdaAbort.current) fdaAbort.current.abort()
    setFdaOpen(false); setFdaSuggestions([]); setFdaHighlight(-1)
  }

  async function handleAddMed(e) {
    e.preventDefault()
    if (!addName.trim()) return
    setSaving(true)
    try {
      await addStayMed(stayId, {
        name: addName.trim(),
        dosage: parseFloat(addDosage) || 0,
        unit: addUnit,
        purpose: addPurpose.trim(),
      })
      setAddFormOpen(false)
      setAddName('')
      setAddDosage('')
      setAddUnit('mg')
      setAddPurpose('')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMed(med) {
    await removeStayMed(stayId, med)
    if (expandedId === med.id) setExpandedId(null)
  }

  async function handleDeleteLog(log) {
    await deleteHospitalMedLog(stayId, log)
  }

  const adHocLogs = medLogs.filter(l => !l.stayMedId)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="hospital-overview-heading" style={{ marginBottom: 0 }}>Medications this stay</div>
        {!addFormOpen && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {bswToAdd.length > 0 && !bswConfirm && (
              <button className="daily-log-add-med-btn" style={{ padding: 0, fontSize: 12 }} onClick={() => setBswConfirm(true)}>
                Import BSW meds
              </button>
            )}
            <button className="daily-log-add-med-btn" style={{ padding: 0, fontSize: 12 }} onClick={() => setAddFormOpen(true)}>
              + Add
            </button>
          </div>
        )}
      </div>

      {bswConfirm && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 10px', background: 'var(--surface-raised)', borderRadius: 8, fontSize: 13 }}>
          <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Add {bswToAdd.length} medications from BSW?</span>
          <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleBswImport} disabled={importing}>
            {importing ? 'Adding…' : 'Add all'}
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setBswConfirm(false)} disabled={importing}>
            Cancel
          </button>
        </div>
      )}

      {addFormOpen && (
        <form className="stay-med-add-form" onSubmit={handleAddMed}>
          <div ref={fdaWrapRef} style={{ position: 'relative' }}>
            <input
              ref={nameInputRef}
              className="daily-log-med-input"
              placeholder="Medication name"
              value={addName}
              onChange={handleAddNameChange}
              onKeyDown={handleAddNameKeyDown}
              autoComplete="off"
            />
            {fdaOpen && (
              <ul className="fda-suggestions" role="listbox">
                {fdaLoading && (
                  <li className="fda-suggestion-loading">Searching…</li>
                )}
                {!fdaLoading && fdaSuggestions.map((s, i) => (
                  <li
                    key={s.genericName}
                    className={`fda-suggestion-item${i === fdaHighlight ? ' highlighted' : ''}`}
                    onMouseDown={e => { e.preventDefault(); handleAddSuggestionSelect(s) }}
                  >
                    <span className="fda-suggestion-generic">{s.genericName}</span>
                    {s.brandName && <span className="fda-suggestion-brand">{s.brandName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="med-form-dose-row">
            <input
              type="number"
              className="daily-log-med-input"
              placeholder="Dosage"
              min="0"
              step="any"
              value={addDosage}
              onChange={e => setAddDosage(e.target.value)}
              style={{ width: 80, flex: 'none' }}
            />
            <select
              className="med-unit-select"
              value={addUnit}
              onChange={e => setAddUnit(e.target.value)}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <input
            className="daily-log-med-input"
            placeholder="For (optional)"
            value={addPurpose}
            onChange={e => setAddPurpose(e.target.value)}
          />
          <div className="daily-log-med-form-actions">
            <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} disabled={!addName.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAddFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {stayMeds.length === 0 && !addFormOpen && (
        <div className="hospital-medlog-empty">No medications added yet.</div>
      )}

      <div className="stay-meds-list">
        {stayMeds.map(med => {
          const logs = medLogs
            .filter(l => l.stayMedId === med.id)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          const isExpanded = expandedId === med.id

          return (
            <div key={med.id} className="stay-med-item">
              <div className="stay-med-header">
                <button
                  className="stay-med-expand"
                  onClick={() => setExpandedId(isExpanded ? null : med.id)}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div className="stay-med-name">{med.name}</div>
                    <div className="stay-med-meta">
                      {med.dosage} {med.unit}{med.purpose ? ` · ${med.purpose}` : ''}
                    </div>
                  </div>
                  <span className="stay-med-count">{logs.length} dose{logs.length !== 1 ? 's' : ''}</span>
                  <span className={`past-stay-chevron${isExpanded ? ' open' : ''}`} style={{ fontSize: 14, marginLeft: 6 }}>›</span>
                </button>
                <button className="stay-med-delete-btn" onClick={() => handleDeleteMed(med)} aria-label="Remove medication">✕</button>
              </div>
              {isExpanded && (
                <div className="stay-med-logs">
                  {logs.length === 0 ? (
                    <div className="stay-med-empty">No doses logged yet.</div>
                  ) : (
                    logs.map(l => (
                      <div key={l.id} className="stay-med-log-entry">
                        <span>{fmtDate(l.date)} · {fmtTime(l.timestamp)}</span>
                        <button className="stay-med-log-delete" onClick={() => handleDeleteLog(l)} aria-label="Remove dose">✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {adHocLogs.length > 0 && (
          <div className="stay-med-item">
            <button
              className="stay-med-header"
              onClick={() => setExpandedId(expandedId === '__adhoc__' ? null : '__adhoc__')}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="stay-med-name">Other</div>
                <div className="stay-med-meta">Unlisted medications</div>
              </div>
              <span className="stay-med-count">{adHocLogs.length} dose{adHocLogs.length !== 1 ? 's' : ''}</span>
              <span className={`past-stay-chevron${expandedId === '__adhoc__' ? ' open' : ''}`} style={{ fontSize: 14, marginLeft: 6 }}>›</span>
            </button>
            {expandedId === '__adhoc__' && (
              <div className="stay-med-logs">
                {adHocLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(l => (
                  <div key={l.id} className="stay-med-log-entry">
                    <span>{fmtDate(l.date)} · {fmtTime(l.timestamp)} · {l.name}</span>
                    <button className="stay-med-log-delete" onClick={() => handleDeleteLog(l)} aria-label="Remove dose">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function StayMedsSidebar({ stayMeds = [], medLogs = [], stayId }) {
  return (
    <div className="hospital-medlog-card">
      <StayMedsContent stayMeds={stayMeds} medLogs={medLogs} stayId={stayId} />
    </div>
  )
}

function MobileMedSection({ stayMeds = [], medLogs = [], stayId }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="hospital-mobile-meds">
      <button className="hospital-mobile-meds-toggle" onClick={() => setOpen(o => !o)}>
        <span>Medications this stay</span>
        <span className="hospital-mobile-meds-count">{stayMeds.length} med{stayMeds.length !== 1 ? 's' : ''}</span>
        <span className={`past-stay-chevron${open ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>›</span>
      </button>
      {open && (
        <div className="hospital-mobile-meds-body">
          <StayMedsContent stayMeds={stayMeds} medLogs={medLogs} stayId={stayId} />
        </div>
      )}
    </div>
  )
}

function PastStayCard({ stay }) {
  const [open, setOpen] = useState(false)
  const logs = [...(stay.dailyLogs || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="past-stay-card">
      <button className="past-stay-header" onClick={() => setOpen(o => !o)}>
        <div className="past-stay-header-left">
          <PersonChip person={stay.person} />
          <div>
            <div className="past-stay-title">{stay.hospital || 'Hospital'}</div>
            <div className="past-stay-meta">
              {fmtDate(stay.admissionDate)} – {fmtDate(stay.dischargeDate)}
              {stay.department ? ` · ${stay.department}` : ''}
            </div>
          </div>
        </div>
        <span className={`past-stay-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      {open && (
        <div className="past-stay-body">
          {stay.reason && <div className="past-stay-reason">{stay.reason}</div>}
          {logs.length === 0 ? (
            <div className="hospital-empty">No logs recorded for this stay.</div>
          ) : (
            <div className="daily-logs-list">
              {logs.map(log => (
                <div key={log.id} className="day-slot day-slot-filled day-slot-readonly">
                  <div className="day-slot-header">
                    <span className="day-slot-label">{fmtDate(log.date)}</span>
                  </div>
                  <div className="day-slot-content">
                    {log.notes && <div className="day-slot-notes">{log.notes}</div>}
                    {log.careTeam && (
                      <div className="day-slot-careteam">
                        <span className="day-slot-careteam-label">Care team</span> {log.careTeam}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HospitalView({ stays, activeStay }) {
  const [stayModalOpen, setStayModalOpen] = useState(false)
  const [editingStay, setEditingStay] = useState(null)
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [editingDate, setEditingDate] = useState(null)
  const [docModalType, setDocModalType] = useState(null)
  const [bulkModalType, setBulkModalType] = useState(null)
  const [regenerating, setRegenerating] = useState(false)

  // Clear loading state once Firestore delivers the new or cleared treatment summary
  useEffect(() => {
    setRegenerating(false)
  }, [activeStay?.treatmentSummary?.updatedAt])

  const pastStays = stays.filter(s => !!s.dischargeDate)
  const medLogs = activeStay?.medLogs || []
  const stayMeds = activeStay?.stayMeds || []
  const doctorNotes = [...(activeStay?.doctorNotes || [])].sort((a, b) => b.date.localeCompare(a.date))
  const testResults = [...(activeStay?.testResults || [])].sort((a, b) => b.date.localeCompare(a.date))

  async function runPlanGeneration(stayId, allNotes, allResults) {
    if (allNotes.length === 0 && allResults.length === 0) {
      await clearTreatmentSummary(stayId)
      return
    }
    await generateTreatmentSummary(stayId, allNotes, allResults)
  }

  async function handleRegeneratePlan() {
    if (!activeStay || regenerating) return
    setRegenerating(true)
    try {
      await runPlanGeneration(activeStay.id, activeStay.doctorNotes || [], activeStay.testResults || [])
    } catch {
      // Silent fail — user can retry
    } finally {
      setRegenerating(false)
    }
  }

  function handleAfterDelete(deletedDoc, isNote) {
    if (!activeStay) return
    const remainingNotes = isNote
      ? (activeStay.doctorNotes || []).filter(n => n.id !== deletedDoc.id)
      : (activeStay.doctorNotes || [])
    const remainingResults = !isNote
      ? (activeStay.testResults || []).filter(r => r.id !== deletedDoc.id)
      : (activeStay.testResults || [])
    setRegenerating(true)
    runPlanGeneration(activeStay.id, remainingNotes, remainingResults).catch(() => {}).finally(() => setRegenerating(false))
  }

  function openEditStay() {
    setEditingStay(activeStay)
    setStayModalOpen(true)
  }

  function openNewStay() {
    setEditingStay(null)
    setStayModalOpen(true)
  }

  function handleDayClick(dateStr, log) {
    setEditingLog(log || null)
    setEditingDate(dateStr)
    setLogModalOpen(true)
  }

  function closeLogModal() {
    setLogModalOpen(false)
    setEditingLog(null)
    setEditingDate(null)
  }

  return (
    <div className="page hospital-page">
      <div className={`hospital-body${activeStay ? ' hospital-body--sidebar' : ''}`}>
        <div>
          {activeStay ? (
            <ActiveStaySection
              stay={activeStay}
              onEdit={openEditStay}
              onDayClick={handleDayClick}
            />
          ) : (
            <div className="hospital-no-active">
              <div className="hospital-no-active-icon">🏥</div>
              <div className="hospital-no-active-text">No active hospital stay</div>
              <button className="btn-add" onClick={openNewStay}>+ Admit</button>
            </div>
          )}

          {activeStay && (
            <TreatmentSummaryCard
              stay={activeStay}
              onRegenerate={handleRegeneratePlan}
              regenerating={regenerating}
            />
          )}

          {activeStay && (
            <MobileMedSection stayMeds={stayMeds} medLogs={medLogs} stayId={activeStay.id} />
          )}

          {activeStay && (
            <div className="doc-section">
              <div className="doc-section-header">
                <span className="doc-section-title">Doctor Notes</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="daily-log-add-med-btn" onClick={() => setBulkModalType('note')}>+ Bulk</button>
                  <button className="daily-log-add-med-btn" onClick={() => setDocModalType('note')}>+ Add</button>
                </div>
              </div>
              {doctorNotes.length === 0 ? (
                <div className="doc-section-empty">No notes uploaded yet.</div>
              ) : (
                doctorNotes.map(n => (
                  <DocCard key={n.id} doc={n} isNote stayId={activeStay.id} onAfterDelete={handleAfterDelete} />
                ))
              )}
            </div>
          )}

          {activeStay && (
            <div className="doc-section">
              <div className="doc-section-header">
                <span className="doc-section-title">Test Results</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="daily-log-add-med-btn" onClick={() => setBulkModalType('result')}>+ Bulk</button>
                  <button className="daily-log-add-med-btn" onClick={() => setDocModalType('result')}>+ Add</button>
                </div>
              </div>
              {testResults.length === 0 ? (
                <div className="doc-section-empty">No results uploaded yet.</div>
              ) : (
                testResults.map(r => (
                  <DocCard key={r.id} doc={r} isNote={false} stayId={activeStay.id} onAfterDelete={handleAfterDelete} />
                ))
              )}
            </div>
          )}
        </div>

        <aside className="hospital-aside">
          {activeStay && (
            <div className="hospital-overview-card">
              <div className="hospital-overview-heading">Stay overview</div>
              <div className="hospital-overview-stats">
                <div className="hospital-overview-stat" style={{ flex: 'none', width: '100%' }}>
                  <span className="hospital-overview-val">{dayCount(activeStay.admissionDate)}</span>
                  <span className="hospital-overview-label">days admitted</span>
                </div>
              </div>
              {activeStay.department && (
                <div className="hospital-overview-row">
                  <span className="hospital-overview-key">Department</span>
                  <span className="hospital-overview-rowval">{activeStay.department}</span>
                </div>
              )}
              {activeStay.hospital && (
                <div className="hospital-overview-row">
                  <span className="hospital-overview-key">Hospital</span>
                  <span className="hospital-overview-rowval">{activeStay.hospital}</span>
                </div>
              )}
              <div className="hospital-overview-row">
                <span className="hospital-overview-key">Admitted</span>
                <span className="hospital-overview-rowval">{fmtDate(activeStay.admissionDate)}</span>
              </div>
            </div>
          )}

          {activeStay && (
            <StayTeamSection stay={activeStay} />
          )}

          {activeStay && (
            <StayMedsSidebar stayMeds={stayMeds} medLogs={medLogs} stayId={activeStay.id} />
          )}

          {pastStays.length > 0 && (
            <div className="past-stays-section">
              <div className="past-stays-heading">Past stays</div>
              {pastStays.map(s => (
                <PastStayCard key={s.id} stay={s} />
              ))}
            </div>
          )}
        </aside>
      </div>

      {stayModalOpen && (
        <HospitalStayModal
          stay={editingStay}
          onClose={() => { setStayModalOpen(false); setEditingStay(null) }}
        />
      )}

      {logModalOpen && activeStay && (
        <DailyLogModal
          stayId={activeStay.id}
          log={editingLog}
          date={editingDate}
          onClose={closeLogModal}
          medLogs={medLogs}
          stayMeds={stayMeds}
        />
      )}

      {docModalType && activeStay && (
        <AddDocumentModal
          stayId={activeStay.id}
          stay={activeStay}
          type={docModalType}
          onClose={() => setDocModalType(null)}
          onSaved={() => setRegenerating(true)}
        />
      )}

      {bulkModalType && activeStay && (
        <BulkUploadModal
          stayId={activeStay.id}
          stay={activeStay}
          type={bulkModalType}
          onClose={() => setBulkModalType(null)}
          onSaved={() => setRegenerating(true)}
        />
      )}
    </div>
  )
}
