import { useState, useEffect, useRef } from 'react'
import { saveDoctor, delDoctor, newId } from '../lib/firestore'
import { uploadDoctorPhoto } from '../lib/storageUtils'
import { SPECIALTIES } from '../lib/noteUtils'

const EMPTY_FORM = { name: '', specialty: '', affiliation: '', notes: '', imageUrl: '' }

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function CareTeamPanel({ careTeam }) {
  const [view, setView] = useState('list')
  const [editDr, setEditDr] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPhotoFile, setNewPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && view === 'form') closeForm() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view])

  function openAdd() {
    setEditDr(null)
    setForm(EMPTY_FORM)
    setNewPhotoFile(null)
    setPhotoPreview(null)
    setView('form')
  }

  function openEdit(dr) {
    setEditDr(dr)
    setForm({ name: dr.name || '', specialty: dr.specialty || '', affiliation: dr.affiliation || '', notes: dr.notes || '', imageUrl: dr.imageUrl || '' })
    setNewPhotoFile(null)
    setPhotoPreview(null)
    setView('form')
  }

  function closeForm() {
    setView('list')
    setEditDr(null)
    setNewPhotoFile(null)
    setPhotoPreview(null)
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setNewPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Please enter the doctor name.'); return }
    setSaving(true)
    try {
      const id = editDr?.id || newId()
      let imageUrl = form.imageUrl || ''
      if (newPhotoFile) {
        imageUrl = await uploadDoctorPhoto(newPhotoFile, id)
      }
      await saveDoctor({ ...form, imageUrl }, id)
      setSaved(true)
      setTimeout(() => { setSaved(false); closeForm() }, 1200)
    } catch { alert('Failed to save. Check your connection.') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Remove this doctor from your care team?')) return
    try { await delDoctor(id) } catch { alert('Failed to delete.') }
  }

  const avatarSrc = photoPreview || form.imageUrl

  return (
    <div className="view-wrap">
      <div className="care-team-panel">
        {view === 'list' ? (
          <>
            <div className="ct-header">
              <h2 style={{ margin: 0 }}>Care Team</h2>
              <button className="btn-add" onClick={openAdd}>+ Add Doctor</button>
            </div>

            {careTeam.length === 0 ? (
              <p className="ct-empty">No doctors added yet. Click &ldquo;+ Add Doctor&rdquo; to get started.</p>
            ) : (
              <ul className="dr-list">
                {careTeam.map(dr => (
                  <li key={dr.id} className="dr-card">
                    <div className="dr-avatar">
                      {dr.imageUrl
                        ? <img src={dr.imageUrl} alt={dr.name} />
                        : <span>{initials(dr.name)}</span>}
                    </div>
                    <div className="dr-info">
                      <div className="dr-name">{dr.name}</div>
                      {dr.specialty && (
                        <span className={`specialty-chip ${dr.specialty}`}>{SPECIALTIES[dr.specialty] || dr.specialty}</span>
                      )}
                      {dr.affiliation && <div className="dr-affil">{dr.affiliation}</div>}
                      {dr.notes && <div className="dr-notes">{dr.notes}</div>}
                    </div>
                    <div className="dr-actions">
                      <button className="btn-ghost" title="Edit" onClick={() => openEdit(dr)}>✏</button>
                      <button className="btn-ghost" title="Remove" onClick={() => handleDelete(dr.id)}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

          </>
        ) : (
          <>
            <div className="ct-header">
              <h2 style={{ margin: 0 }}>{editDr ? 'Edit Doctor' : 'Add Doctor'}</h2>
            </div>

            <div className="dr-photo-row">
              <div className="dr-avatar dr-avatar-lg" onClick={() => fileInputRef.current?.click()} title="Click to change photo" style={{ cursor: 'pointer' }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="Doctor photo" />
                  : <span>{form.name ? initials(form.name) : '?'}</span>}
                <div className="dr-avatar-edit">📷</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              <span className="dr-photo-hint">Click to upload a photo</span>
            </div>

            <div className="fr">
              <label>Name <span className="req">*</span></label>
              <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Dr. Patel" />
            </div>
            <div className="f2">
              <div className="fr">
                <label>Specialty</label>
                <select value={form.specialty} onChange={set('specialty')}>
                  <option value="">Select specialty…</option>
                  {Object.entries(SPECIALTIES).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="fr">
                <label>Affiliation</label>
                <input value={form.affiliation} onChange={set('affiliation')} placeholder="Practice / hospital network" />
              </div>
            </div>
            <div className="fr">
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} placeholder="Any notes about this doctor…" />
            </div>

            <div className="mf">
              <button className="btn-cx" onClick={closeForm}>Back</button>
              <button className="btn-sv" onClick={handleSave} disabled={saving}>
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save doctor'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
