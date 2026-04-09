import { useState, useEffect, useRef } from 'react'
import { saveDoctor, delDoctor, newId, saveSpecialty } from '../lib/firestore'
import { uploadDoctorPhoto } from '../lib/storageUtils'
import { useSpecialties, specialtyLabel, specialtyColor } from '../hooks/useSpecialties'

const EMPTY_FORM = { name: '', specialty: '', affiliation: '', notes: '', imageUrl: '' }

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function CareTeamPanel({ careTeam }) {
  const specialties = useSpecialties()
  const [addingSpecialty, setAddingSpecialty] = useState(false)
  const [newSpecialtyLabel, setNewSpecialtyLabel] = useState('')
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
                  <li key={dr.id} className="dr-card" onClick={() => openEdit(dr)} style={{ cursor: 'pointer' }}>
                    <div className="dr-avatar">
                      {dr.imageUrl
                        ? <img src={dr.imageUrl} alt={dr.name} />
                        : <span>{initials(dr.name)}</span>}
                    </div>
                    <div className="dr-info">
                      <div className="dr-name">{dr.name}</div>
                      {dr.specialty && (
                        <span className="specialty-chip" style={specialtyColor(specialties, dr.specialty)}>{specialtyLabel(specialties, dr.specialty)}</span>
                      )}
                      {dr.affiliation && <div className="dr-affil">{dr.affiliation}</div>}
                      {dr.notes && <div className="dr-notes">{dr.notes}</div>}
                    </div>
                    <div className="dr-actions">
                      <button className="btn-ghost" title="Remove" onClick={e => { e.stopPropagation(); handleDelete(dr.id) }}>✕</button>
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
                {addingSpecialty ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus
                      value={newSpecialtyLabel}
                      onChange={e => setNewSpecialtyLabel(e.target.value)}
                      placeholder="e.g. Cardiology"
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newSpecialtyLabel.trim()) {
                          const id = newSpecialtyLabel.trim().toLowerCase().replace(/\s+/g, '-')
                          await saveSpecialty({ id, label: newSpecialtyLabel.trim() })
                          setForm(f => ({ ...f, specialty: id }))
                          setNewSpecialtyLabel('')
                          setAddingSpecialty(false)
                        } else if (e.key === 'Escape') {
                          setNewSpecialtyLabel('')
                          setAddingSpecialty(false)
                        }
                      }}
                    />
                    <button className="btn-ghost" onClick={async () => {
                      if (newSpecialtyLabel.trim()) {
                        const id = newSpecialtyLabel.trim().toLowerCase().replace(/\s+/g, '-')
                        await saveSpecialty({ id, label: newSpecialtyLabel.trim() })
                        setForm(f => ({ ...f, specialty: id }))
                      }
                      setNewSpecialtyLabel('')
                      setAddingSpecialty(false)
                    }}>Add</button>
                    <button className="btn-ghost" onClick={() => { setNewSpecialtyLabel(''); setAddingSpecialty(false) }}>✕</button>
                  </div>
                ) : (
                  <select value={form.specialty} onChange={e => {
                    if (e.target.value === '__add__') { setAddingSpecialty(true) } else { set('specialty')(e) }
                  }}>
                    <option value="">Select specialty…</option>
                    {specialties.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                    <option value="__add__">+ Add specialty…</option>
                  </select>
                )}
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
