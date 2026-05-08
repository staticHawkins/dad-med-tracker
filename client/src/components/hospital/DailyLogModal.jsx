import { useState, useEffect, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { saveDailyLog, deleteDailyLog } from '../../lib/firestore'
import { todayStr } from '../../lib/medUtils'

const EMPTY = { date: todayStr(), notes: '', careTeam: '' }

export default function DailyLogModal({ stayId, log, date, onClose }) {
  const [fields, setFields] = useState({ ...EMPTY, date: date || todayStr() })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [deleting, setDeleting] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

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
    } catch {
      setAiError('Could not generate summary. Check your connection.')
    } finally {
      setAiLoading(false)
    }
  }

  const canSummarize = fields.notes.trim().length > 0 || fields.careTeam.trim().length > 0

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
          <div className="fr">
            <label>Daily notes</label>
            <textarea
              rows={8}
              placeholder="Vitals, doctor updates, procedures, anything notable today…"
              value={fields.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>

          <div className="fr">
            <label>Care team today</label>
            <textarea
              rows={3}
              placeholder="Who was present today"
              value={fields.careTeam}
              onChange={e => setField('careTeam', e.target.value)}
            />
          </div>

          {/* AI Summary */}
          <div className="daily-log-ai-section">
            <div className="daily-log-ai-header">
              <span className="daily-log-ai-label">⊙ AI summary</span>
              <button
                className="daily-log-ai-btn"
                onClick={generateSummary}
                disabled={aiLoading || !canSummarize}
              >
                {aiLoading ? 'Generating…' : aiSummary ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {aiLoading && (
              <div className="daily-log-ai-loading">Summarizing the day…</div>
            )}
            {aiError && (
              <div className="daily-log-ai-error">{aiError}</div>
            )}
            {aiSummary && !aiLoading && (
              <div className="daily-log-ai-result">{aiSummary}</div>
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
