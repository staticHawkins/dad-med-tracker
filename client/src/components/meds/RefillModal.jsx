import { useState, useEffect } from 'react'
import { markRefilled } from '../../lib/firestore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { todayStr, freqPerDay, fmtDate } from '../../lib/medUtils'

const PRESETS = [
  { value: 'once-daily',      label: 'Once daily' },
  { value: 'twice-daily',     label: 'Twice daily' },
  { value: 'every-other-day', label: 'Every other day' },
  { value: 'as-needed',       label: 'As needed' },
  { value: 'custom',          label: 'Custom…' },
]

export default function RefillModal({ med, onClose }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    filledDate: todayStr(),
    supply: String(med.supply ?? ''),
    dose: med.dose || '',
    frequencyPreset: med.frequencyPreset || 'once-daily',
    frequencyCustomCount: med.frequencyCustomCount || '1',
    frequencyCustomEvery: med.frequencyCustomEvery || '1',
    frequencyCustomUnit: med.frequencyCustomUnit || 'days',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleConfirm() {
    if (!form.filledDate) { alert('Please enter the fill date.'); return }
    if (!form.supply)     { alert('Please enter how many pills are in the bottle.'); return }
    setSaving(true)
    try {
      await markRefilled(med, form)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setSaving(false)
  }

  const formContent = (
    <>
      <div className="fr">
        <label>Fill date <span className="req">*</span></label>
        <input type="date" value={form.filledDate} onChange={set('filledDate')} />
      </div>
      <div className="f2">
        <div className="fr">
          <label>Pills in bottle <span className="req">*</span></label>
          <input type="number" min="1" value={form.supply} onChange={set('supply')} placeholder="e.g. 30" />
        </div>
        <div className="fr">
          <label>Dose / strength</label>
          <input value={form.dose} onChange={set('dose')} placeholder="e.g. 500 mg" />
        </div>
      </div>
      <div className="fr">
        <label>Frequency <span className="req">*</span></label>
        <select value={form.frequencyPreset} onChange={set('frequencyPreset')}>
          {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {form.frequencyPreset === 'custom' && (
        <div className="f2">
          <div className="fr">
            <label>Pills per dose</label>
            <input type="number" min="0.5" step="0.5" value={form.frequencyCustomCount} onChange={set('frequencyCustomCount')} placeholder="1" />
          </div>
          <div className="fr">
            <label>Every</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="number" min="1" step="1" value={form.frequencyCustomEvery} onChange={set('frequencyCustomEvery')} placeholder="1" style={{ flex: 1 }} />
              <select value={form.frequencyCustomUnit} onChange={set('frequencyCustomUnit')} style={{ flex: 1 }}>
                <option value="days">days</option>
                <option value="weeks">weeks</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {form.filledDate && form.supply && form.frequencyPreset !== 'as-needed' && (() => {
        const freq = freqPerDay(form)
        const days = freq > 0 ? Math.ceil(parseInt(form.supply) / freq) : null
        if (!days) return null
        const d = new Date(form.filledDate + 'T00:00:00')
        d.setDate(d.getDate() + days)
        return (
          <div className="fr-hint" style={{ marginBottom: 4 }}>
            Runs out approx. {fmtDate(d)}
          </div>
        )
      })()}

      <div className="mf">
        <button className="btn-cx" onClick={onClose}>Cancel</button>
        <button className="btn-sv" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Saving…' : 'Confirm refill'}
        </button>
      </div>
    </>
  )

  const title = `Refill ${med.name}`

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sheet-title">{title}</span>
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
        <span className="fs-title">{title}</span>
        <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="fs-body">{formContent}</div>
    </div>
  )
}
