import { useState, useEffect, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { saveDailyLog, deleteDailyLog, addHospitalMedLog, deleteHospitalMedLog, addStayMed } from '../../lib/firestore'
import { todayStr } from '../../lib/medUtils'
import { fetchDrugSuggestions } from '../../lib/fdaUtils'

const UNITS = ['mg', 'mcg', 'g', 'mL', 'L', 'units', 'IU', 'mEq', 'tablet(s)', 'capsule(s)', 'patch(es)', 'drop(s)', 'puff(s)']

const EMPTY = { date: todayStr(), notes: '', careTeam: '' }

function useAutoResize(value) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return ref
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

function defaultTimestamp(date) {
  const now = new Date()
  const h = now.getHours().toString().padStart(2, '0')
  const m = now.getMinutes().toString().padStart(2, '0')
  return `${date}T${h}:${m}`
}

export default function DailyLogModal({ stayId, log, date, onClose, medLogs = [], stayMeds = [] }) {
  const [fields, setFields] = useState({ ...EMPTY, date: date || todayStr() })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [deleting, setDeleting] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiOpen, setAiOpen] = useState(true)

  const [addingMed, setAddingMed] = useState(false)
  const [medPickerStep, setMedPickerStep] = useState(false)
  const [isNewMed, setIsNewMed] = useState(false)
  const [selectedStayMed, setSelectedStayMed] = useState(null)
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medUnit, setMedUnit] = useState('mg')
  const [medPurpose, setMedPurpose] = useState('')
  const [medTime, setMedTime] = useState('')
  const [savingMed, setSavingMed] = useState(false)
  const [medSearch, setMedSearch] = useState('')
  const medNameRef = useRef(null)
  const medSearchRef = useRef(null)

  const [fdaSuggestions, setFdaSuggestions] = useState([])
  const [fdaLoading, setFdaLoading]         = useState(false)
  const [fdaOpen, setFdaOpen]               = useState(false)
  const [fdaHighlight, setFdaHighlight]     = useState(-1)
  const fdaMedDebounce = useRef(null)
  const fdaMedAbort    = useRef(null)
  const fdaMedWrapRef  = useRef(null)

  const notesRef = useAutoResize(fields.notes)
  const careTeamRef = useAutoResize(fields.careTeam)
  const debounceTimer = useRef(null)
  const savedTimer = useRef(null)
  const lastFields = useRef(null)
  const currentSavedRef = useRef(log || null)

  const currentDate = fields.date || date || todayStr()
  const dayMedLogs = medLogs
    .filter(m => m.date === currentDate)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  useEffect(() => {
    if (log) {
      setFields({
        date: log.date || date || todayStr(),
        notes: log.notes || log.drNotes || '',
        careTeam: log.careTeam || '',
      })
      setAiSummary(log.aiSummary || null)
      currentSavedRef.current = log
    } else if (date) {
      setFields(f => ({ ...f, date }))
    }
  }, [log, date])

  useEffect(() => {
    if (addingMed && !medPickerStep && isNewMed && medNameRef.current) medNameRef.current.focus()
  }, [addingMed, medPickerStep, isNewMed])

  useEffect(() => {
    if (!fdaOpen) return
    function handler(e) {
      if (fdaMedWrapRef.current && !fdaMedWrapRef.current.contains(e.target)) {
        setFdaOpen(false); setFdaHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fdaOpen])

  useEffect(() => {
    return () => {
      clearTimeout(fdaMedDebounce.current)
      if (fdaMedAbort.current) fdaMedAbort.current.abort()
    }
  }, [])

  async function persistFields(next) {
    const prev = currentSavedRef.current
    const toSave = { id: prev?.id, ...(prev?.aiSummary ? { aiSummary: prev.aiSummary } : {}), ...next }
    lastFields.current = next
    setSaveStatus('saving')
    try {
      const saved = await saveDailyLog(stayId, toSave, prev)
      currentSavedRef.current = saved
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function retryWrite() {
    if (!lastFields.current) return
    const prev = currentSavedRef.current
    const toSave = { id: prev?.id, ...(prev?.aiSummary ? { aiSummary: prev.aiSummary } : {}), ...lastFields.current }
    setSaveStatus('saving')
    try {
      const saved = await saveDailyLog(stayId, toSave, prev)
      currentSavedRef.current = saved
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  function setField(key, val) {
    const next = { ...fields, [key]: val }
    setFields(next)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => persistFields(next), 600)
  }

  async function handleDelete() {
    if (!log || !confirm('Delete this day\'s log?')) return
    setDeleting(true)
    try {
      await deleteDailyLog(stayId, log)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  async function generateSummary() {
    if (!fields.notes.trim() && !fields.careTeam.trim()) return
    setAiLoading(true)
    setAiError(null)
    setAiSummary(null)
    setAiOpen(true)
    try {
      const fn = httpsCallable(functions, 'askClaude')
      const systemContext = `You are a medical summary assistant. Write a 1–2 sentence plain-prose summary of the hospital day. Focus only on the most important update (key medical event, test result, or care change). No markdown, no bullet points, no filler phrases.`
      const userMessage = [
        fields.notes.trim() && `Notes:\n${fields.notes.trim()}`,
        fields.careTeam.trim() && `Care team:\n${fields.careTeam.trim()}`,
      ].filter(Boolean).join('\n\n')
      const { data } = await fn({
        messages: [{ role: 'user', content: userMessage }],
        systemContext,
      })
      setAiSummary(data.content)
      const prev = currentSavedRef.current
      const toSave = { id: prev?.id, ...fields, aiSummary: data.content }
      const saved = await saveDailyLog(stayId, toSave, prev)
      currentSavedRef.current = saved
    } catch {
      setAiError('Could not generate summary. Check your connection.')
    } finally {
      setAiLoading(false)
    }
  }

  function handleMedNameChange(e) {
    const val = e.target.value
    setMedName(val)
    if (val.trim().length < 2) {
      setFdaOpen(false); setFdaSuggestions([]); return
    }
    if (fdaMedAbort.current) fdaMedAbort.current.abort()
    clearTimeout(fdaMedDebounce.current)
    setFdaLoading(true); setFdaOpen(true)
    fdaMedDebounce.current = setTimeout(async () => {
      const ctrl = new AbortController()
      fdaMedAbort.current = ctrl
      const results = await fetchDrugSuggestions(val, ctrl.signal)
      if (ctrl.signal.aborted) return
      setFdaSuggestions(results)
      setFdaLoading(false)
      if (results.length === 0) setFdaOpen(false)
      setFdaHighlight(-1)
    }, 350)
  }

  function handleMedNameKeyDown(e) {
    if (!fdaOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFdaHighlight(h => Math.min(h + 1, fdaSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFdaHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && fdaHighlight >= 0) {
      e.preventDefault()
      handleMedSuggestionSelect(fdaSuggestions[fdaHighlight])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setFdaOpen(false); setFdaHighlight(-1)
    }
  }

  function handleMedSuggestionSelect(s) {
    setMedName(s.genericName)
    clearTimeout(fdaMedDebounce.current)
    if (fdaMedAbort.current) fdaMedAbort.current.abort()
    setFdaOpen(false); setFdaSuggestions([]); setFdaHighlight(-1)
  }

  function openAddMed() {
    const hasMeds = stayMeds.length > 0
    setMedPickerStep(hasMeds)
    setIsNewMed(!hasMeds)
    setSelectedStayMed(null)
    setMedName('')
    setMedDosage('')
    setMedUnit('mg')
    setMedPurpose('')
    setMedTime(defaultTimestamp(currentDate))
    setMedSearch('')
    setAddingMed(true)
  }

  function selectStayMed(sm) {
    setSelectedStayMed(sm)
    setMedName(sm.name)
    setMedDosage(String(sm.dosage ?? ''))
    setMedUnit(sm.unit || 'mg')
    setMedPurpose('')
    setIsNewMed(false)
    setMedPickerStep(false)
  }

  function selectNewMed() {
    setSelectedStayMed(null)
    setMedName('')
    setMedDosage('')
    setMedUnit('mg')
    setMedPurpose('')
    setIsNewMed(true)
    setMedPickerStep(false)
  }

  async function handleSaveMed() {
    if (!medName.trim()) return
    setSavingMed(true)
    try {
      let stayMedId = selectedStayMed?.id || null
      if (isNewMed) {
        const newMed = await addStayMed(stayId, {
          name: medName.trim(),
          dosage: parseFloat(medDosage) || 0,
          unit: medUnit,
          purpose: medPurpose.trim(),
        })
        stayMedId = newMed.id
      }
      await addHospitalMedLog(stayId, {
        stayMedId,
        name: medName.trim(),
        dosage: parseFloat(medDosage) || 0,
        unit: medUnit,
        timestamp: medTime,
        date: currentDate,
      })
      setAddingMed(false)
      setIsNewMed(false)
      setSelectedStayMed(null)
      setMedPickerStep(false)
    } finally {
      setSavingMed(false)
    }
  }

  async function handleDeleteMed(entry) {
    await deleteHospitalMedLog(stayId, entry)
  }

  const canSummarize = fields.notes.trim().length > 0 || fields.careTeam.trim().length > 0
  const hasContent = aiSummary || aiLoading || aiError

  return (
    <div className="right-panel-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="right-panel" role="dialog" aria-modal="true">
        <div className="right-panel-header">
          <span className="sheet-title">{log ? 'Edit notes' : 'Add notes'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

        <div className="right-panel-body">
          <div className="daily-log-ai-section" style={{ marginTop: 0, marginBottom: 20 }}>
            <button
              className="daily-log-ai-header daily-log-ai-toggle"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
            >
              <span className="daily-log-ai-label">⊙ AI summary</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  className="daily-log-ai-btn"
                  onClick={e => { e.stopPropagation(); generateSummary() }}
                  style={{ pointerEvents: aiLoading || !canSummarize ? 'none' : 'auto', opacity: aiLoading || !canSummarize ? 0.4 : 1 }}
                >
                  {aiLoading ? 'Generating…' : aiSummary ? 'Regenerate' : 'Generate'}
                </span>
                <span className="daily-log-ai-divider" />
                <span className={`daily-log-ai-chevron${aiOpen ? ' open' : ''}`}>›</span>
              </div>
            </button>
            {aiOpen && (
              <>
                {aiLoading && <div className="daily-log-ai-loading">Summarizing the day…</div>}
                {aiError && <div className="daily-log-ai-error">{aiError}</div>}
                {aiSummary && !aiLoading && <div className="daily-log-ai-result">{aiSummary}</div>}
                {!hasContent && (
                  <div className="daily-log-ai-empty">No summary yet. Add notes below and tap Generate.</div>
                )}
              </>
            )}
          </div>

          <div className="fr">
            <label>Daily notes</label>
            <textarea
              ref={notesRef}
              rows={8}
              placeholder="Vitals, doctor updates, procedures, anything notable today…"
              value={fields.notes}
              onChange={e => setField('notes', e.target.value)}
              style={{ resize: 'none', overflow: 'hidden' }}
            />
          </div>

          <div className="fr">
            <label>Care team today</label>
            <textarea
              ref={careTeamRef}
              rows={3}
              placeholder="Who was present today"
              value={fields.careTeam}
              onChange={e => setField('careTeam', e.target.value)}
              style={{ resize: 'none', overflow: 'hidden' }}
            />
          </div>

          <div className="daily-log-meds-section">
            <div className="daily-log-meds-header">
              <span className="daily-log-meds-label">Medications</span>
            </div>

            {dayMedLogs.length > 0 && (
              <div className="daily-log-meds-list">
                {dayMedLogs.map(m => (
                  <div key={m.id} className="daily-log-med-row">
                    <span className="daily-log-med-time">{fmtTime(m.timestamp)}</span>
                    <span className="daily-log-med-name">
                      {m.name}{m.dosage ? ` · ${m.dosage} ${m.unit}` : ''}
                    </span>
                    <button
                      className="daily-log-med-delete"
                      onClick={() => handleDeleteMed(m)}
                      aria-label="Remove"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {addingMed && medPickerStep && (() => {
              const q = medSearch.trim().toLowerCase()
              const filtered = stayMeds
                .filter(sm => !q || sm.name.toLowerCase().includes(q) || sm.purpose?.toLowerCase().includes(q))
                .sort((a, b) => a.name.localeCompare(b.name))
              return (
                <div className="med-picker">
                  <div className="med-picker-label">SELECT MEDICATION</div>
                  <div style={{ padding: '6px 12px 4px' }}>
                    <input
                      ref={medSearchRef}
                      autoFocus
                      className="daily-log-med-input"
                      placeholder="Search medications…"
                      value={medSearch}
                      onChange={e => setMedSearch(e.target.value)}
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 280, width: '100%' }}>
                    {filtered.map(sm => (
                      <button key={sm.id} className="med-picker-row" onClick={() => selectStayMed(sm)}>
                        <span className="med-picker-name">{sm.name}</span>
                        <span className="med-picker-dose">
                          {sm.dosage} {sm.unit}{sm.purpose ? ` · ${sm.purpose}` : ''}
                        </span>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>No match</div>
                    )}
                  </div>
                  <button className="med-picker-row med-picker-row--new" onClick={selectNewMed}>
                    <span className="med-picker-name">+ Add new medication</span>
                  </button>
                  <div style={{ padding: '8px 12px' }}>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAddingMed(false)}>Cancel</button>
                  </div>
                </div>
              )
            })()}

            {addingMed && !medPickerStep && (
              <div className="daily-log-med-form">
                {isNewMed ? (
                  <>
                    <div ref={fdaMedWrapRef} style={{ position: 'relative' }}>
                      <input
                        ref={medNameRef}
                        className="daily-log-med-input"
                        placeholder="Medication name"
                        value={medName}
                        onChange={handleMedNameChange}
                        onKeyDown={handleMedNameKeyDown}
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
                              onMouseDown={e => { e.preventDefault(); handleMedSuggestionSelect(s) }}
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
                        value={medDosage}
                        onChange={e => setMedDosage(e.target.value)}
                        style={{ width: 90, flex: 'none' }}
                      />
                      <select
                        className="med-unit-select"
                        value={medUnit}
                        onChange={e => setMedUnit(e.target.value)}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <input
                      className="daily-log-med-input"
                      placeholder="For (optional)"
                      value={medPurpose}
                      onChange={e => setMedPurpose(e.target.value)}
                    />
                  </>
                ) : (
                  <div className="med-selected-summary">
                    <span>{medName}{medDosage ? ` · ${medDosage} ${medUnit}` : ''}</span>
                    <button className="med-selected-change" onClick={() => { setMedPickerStep(true); setMedSearch('') }}>Change</button>
                  </div>
                )}
                <input
                  type="datetime-local"
                  className="daily-log-med-input"
                  value={medTime}
                  onChange={e => setMedTime(e.target.value)}
                />
                <div className="daily-log-med-form-actions">
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '6px 14px' }}
                    onClick={handleSaveMed}
                    disabled={!medName.trim() || savingMed}
                  >
                    {savingMed ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => setAddingMed(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!addingMed && (
              <button className="daily-log-add-med-btn" onClick={openAddMed}>
                + Log medication
              </button>
            )}
          </div>

          {log && (
            <div style={{ marginTop: 24 }}>
              <button
                className="btn-ghost"
                style={{ color: 'var(--red)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
