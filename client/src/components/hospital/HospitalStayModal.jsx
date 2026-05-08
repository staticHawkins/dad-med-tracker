import { useState, useEffect } from 'react'
import { saveHospitalStay, dischargeHospitalStay } from '../../lib/firestore'
import { todayStr } from '../../lib/medUtils'

const EMPTY = {
  hospital: '',
  department: '',
  reason: '',
  admissionDate: todayStr(),
  person: 'dad',
}

export default function HospitalStayModal({ stay, onClose }) {
  const [fields, setFields] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [discharging, setDischarging] = useState(false)

  useEffect(() => {
    if (stay) {
      setFields({
        hospital: stay.hospital || '',
        department: stay.department || '',
        reason: stay.reason || '',
        admissionDate: stay.admissionDate || todayStr(),
        person: stay.person || 'dad',
      })
    }
  }, [stay])

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!fields.hospital.trim()) return
    setSaving(true)
    try {
      await saveHospitalStay(fields, stay?.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDischarge() {
    if (!stay?.id) return
    if (!confirm('Mark this stay as discharged today?')) return
    setDischarging(true)
    try {
      await dischargeHospitalStay(stay.id)
      onClose()
    } finally {
      setDischarging(false)
    }
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span className="sheet-title">{stay ? 'Edit Stay' : 'Admit to Hospital'}</span>
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="fr">
          <label>Hospital name *</label>
          <input
            placeholder="e.g. St. Mary's Medical Center"
            value={fields.hospital}
            onChange={e => set('hospital', e.target.value)}
          />
        </div>

        <div className="fr">
          <label>Department / Unit</label>
          <input
            placeholder="e.g. Oncology, ICU"
            value={fields.department}
            onChange={e => set('department', e.target.value)}
          />
        </div>

        <div className="fr">
          <label>Reason for admission</label>
          <textarea
            rows={2}
            placeholder="e.g. Post-op monitoring, pneumonia treatment"
            value={fields.reason}
            onChange={e => set('reason', e.target.value)}
          />
        </div>

        <div className="fr">
          <label>Admission date</label>
          <input
            type="date"
            value={fields.admissionDate}
            onChange={e => set('admissionDate', e.target.value)}
          />
        </div>

        <div className="fr">
          <label>Patient</label>
          <div className="person-filter" style={{ marginTop: 4 }}>
            {['dad', 'mom'].map(p => (
              <button
                key={p}
                className={`pfill pfill-${p}${fields.person === p ? ' on' : ''}`}
                onClick={() => set('person', p)}
                type="button"
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 20 }}>
          {stay && !stay.dischargeDate && (
            <button
              className="btn-ghost"
              style={{ color: 'var(--red)' }}
              onClick={handleDischarge}
              disabled={discharging}
            >
              {discharging ? 'Discharging…' : 'Discharge today'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn-add"
              onClick={handleSave}
              disabled={saving || !fields.hospital.trim()}
            >
              {saving ? 'Saving…' : stay ? 'Save' : 'Admit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
