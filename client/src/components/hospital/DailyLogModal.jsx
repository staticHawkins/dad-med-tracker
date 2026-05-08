import { useState, useEffect } from 'react'
import { saveDailyLog, deleteDailyLog } from '../../lib/firestore'
import { todayStr } from '../../lib/medUtils'

const EMPTY = {
  date: todayStr(),
  notes: '',
  careTeam: '',
}

export default function DailyLogModal({ stayId, log, date, onClose }) {
  const [fields, setFields] = useState({ ...EMPTY, date: date || todayStr() })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  function setField(key, val) {
    setFields(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveDailyLog(stayId, { id: log?.id, date: fields.date, notes: fields.notes, careTeam: fields.careTeam }, log)
      onClose()
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span className="sheet-title">{log ? 'Edit notes' : 'Add notes'}</span>
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="fr">
          <label>Daily notes</label>
          <textarea
            rows={6}
            placeholder="Vitals, doctor updates, procedures, anything notable today…"
            value={fields.notes}
            onChange={e => setField('notes', e.target.value)}
            autoFocus
          />
        </div>

        <div className="fr">
          <label>Care team today</label>
          <textarea
            rows={2}
            placeholder="Who was present today"
            value={fields.careTeam}
            onChange={e => setField('careTeam', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 20 }}>
          {log && (
            <button
              className="btn-ghost"
              style={{ color: 'var(--red)' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-add" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
