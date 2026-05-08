import { useState, useEffect, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { saveDailyLog, deleteDailyLog } from '../../lib/firestore'
import { todayStr } from '../../lib/medUtils'

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

export default function DailyLogModal({ stayId, log, date, onClose }) {
  const [fields, setFields] = useState({ ...EMPTY, date: date || todayStr() })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [deleting, setDeleting] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiOpen, setAiOpen] = useState(true)

  const notesRef = useAutoResize(fields.notes)
  const careTeamRef = useAutoResize(fields.careTeam)
  const debounceTimer = useRef(null)
  const savedTimer = useRef(null)
  const lastFields = useRef(null)

  useEffect(() => {
    if (log) {
      setFields({
        date: log.date || date || todayStr(),
        notes: log.notes || log.drNotes || '',
        careTeam: log.careTeam || '',
      })
      setAiSummary(log.aiSummary || null)
    } else if (date) {
      setFields(f => ({ ...f, date }))
    }
  }, [log, date])

  async function persistFields(next) {
    lastFields.current = next
    setSaveStatus('saving')
    try {
      await saveDailyLog(stayId, { id: log?.id, ...next }, log)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function retryWrite() {
    if (!lastFields.current) return
    setSaveStatus('saving')
    try {
      await saveDailyLog(stayId, { id: log?.id, ...lastFields.current }, log)
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
      const systemContext = `You are a medical summary assistant helping a family track a hospital stay. Write a concise, plain-language summary of the day based on the notes provided. Focus on key events, medical updates, and care team involvement. Keep it to 2–4 sentences. Do NOT use markdown — no **, ##, *, or bullet dashes. Write in plain prose only.`
      const userMessage = [
        fields.notes.trim() && `Daily notes:\n${fields.notes.trim()}`,
        fields.careTeam.trim() && `Care team today:\n${fields.careTeam.trim()}`,
      ].filter(Boolean).join('\n\n')
      const { data } = await fn({
        messages: [{ role: 'user', content: `Please summarize this hospital day:\n\n${userMessage}` }],
        systemContext,
      })
      setAiSummary(data.content)
      await saveDailyLog(stayId, { id: log?.id, ...fields, aiSummary: data.content }, log)
    } catch {
      setAiError('Could not generate summary. Check your connection.')
    } finally {
      setAiLoading(false)
    }
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
          {/* AI Summary — top, collapsible */}
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
