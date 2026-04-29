import { useState, useEffect } from 'react'
import { saveMed } from '../../lib/firestore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { freqPerDay } from '../../lib/medUtils'

const EMPTY = {
  name: '', dose: '', frequencyPreset: 'once-daily',
  frequencyCustomCount: '1', frequencyCustomEvery: '1', frequencyCustomUnit: 'days',
  filledDate: '', supply: '', pharmacy: '', rxNum: '',
  doctor: '', instructions: '', person: 'dad'
}

const PRESETS = [
  { value: 'once-daily',      label: 'Once daily' },
  { value: 'twice-daily',     label: 'Twice daily' },
  { value: 'every-other-day', label: 'Every other day' },
  { value: 'as-needed',       label: 'As needed' },
  { value: 'custom',          label: 'Custom…' },
]

// Add-new only. Editing existing medications is handled inline in MedRow drawer.
export default function MedModal({ careTeam = [], onClose }) {
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
    if (!form.name.trim()) { alert('Please enter the medication name.'); return }
    if (!form.filledDate)  { alert('Please enter the date the bottle was last filled.'); return }
    if (!form.supply)      { alert('Please enter how many pills were in the bottle.'); return }
    setCreating(true)
    try {
      await saveMed(form, null)
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
        <label>Name <span className="req">*</span></label>
        <input value={form.name} onChange={set('name')} placeholder="e.g. Metformin" />
      </div>
      <div className="f2">
        <div className="fr">
          <label>Last filled <span className="req">*</span></label>
          <input type="date" value={form.filledDate} onChange={set('filledDate')} />
        </div>
        <div className="fr">
          <label>Pills in bottle <span className="req">*</span></label>
          <input type="number" min="1" value={form.supply} onChange={set('supply')} placeholder="e.g. 30" />
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
            Runs out approx. {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )
      })()}

      <div className="sheet-section">Optional</div>
      <div className="fr">
        <label>Dose / strength</label>
        <input value={form.dose} onChange={set('dose')} placeholder="e.g. 500 mg" />
      </div>
      <div className="f2-pharmacy">
        <div className="fr">
          <label>Pharmacy</label>
          <input value={form.pharmacy} onChange={set('pharmacy')} placeholder="e.g. Walgreens" />
        </div>
        <div className="fr">
          <label>Rx #</label>
          <input value={form.rxNum} onChange={set('rxNum')} placeholder="optional" />
        </div>
      </div>
      <div className="fr">
        <label>Doctor</label>
        <select value={form.doctor} onChange={set('doctor')}>
          <option value="">No doctor</option>
          {careTeam.map(dr => (
            <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${dr.specialty}` : ''}</option>
          ))}
        </select>
      </div>
      <div className="fr">
        <label>Instructions</label>
        <textarea value={form.instructions} onChange={set('instructions')} placeholder="e.g. Take with food" />
      </div>

      <div className="mf">
        <button className="btn-cx" onClick={onClose}>Cancel</button>
        <button className="btn-sv" onClick={handleCreate} disabled={creating}>
          {creating ? 'Adding…' : 'Add medication'}
        </button>
      </div>
    </>
  )

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sheet-title">Add medication</span>
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
        <span className="fs-title">Add medication</span>
        <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="fs-body">{formContent}</div>
    </div>
  )
}
