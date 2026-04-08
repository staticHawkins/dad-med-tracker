import { useState, useEffect, useRef } from 'react'
import { saveTask } from '../../lib/firestore'

const EMPTY = {
  title: '', description: '', doctorIds: [], assigneeUids: [], dueDate: '', done: false
}

export default function TaskModal({ tasks, careTeam, users, editId, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const doctorDropRef = useRef(null)

  useEffect(() => {
    if (!editId) { setForm(EMPTY); return }
    const t = tasks.find(x => x.id === editId)
    if (t) setForm({
      title: t.title || '',
      description: t.description || '',
      doctorIds: Array.isArray(t.doctorIds) ? t.doctorIds : (t.doctorId ? [t.doctorId] : []),
      assigneeUids: t.assigneeUids || [],
      dueDate: t.dueDate || '',
      done: t.done || false
    })
  }, [editId, tasks])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e) {
      if (doctorDropRef.current && !doctorDropRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function toggleDoctor(id) {
    setForm(f => ({
      ...f,
      doctorIds: f.doctorIds.includes(id)
        ? f.doctorIds.filter(d => d !== id)
        : [...f.doctorIds, id]
    }))
  }

  function toggleAssignee(uid) {
    setForm(f => ({
      ...f,
      assigneeUids: f.assigneeUids.includes(uid)
        ? f.assigneeUids.filter(u => u !== uid)
        : [...f.assigneeUids, uid]
    }))
  }

  async function handleSave() {
    if (!form.title.trim()) { alert('Please enter a task title.'); return }
    setSaving(true)
    try {
      await saveTask(form, editId || null)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1200)
    } catch { alert('Failed to save. Check your connection.') }
    setSaving(false)
  }

  const isOpen = editId !== undefined

  return (
    <div className="modal-bg" style={{ display: isOpen ? 'flex' : 'none' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{editId ? 'Edit task' : 'Add task'}</h2>

        <div className="fr">
          <label>Title <span className="req">*</span></label>
          <input autoFocus value={form.title} onChange={set('title')} placeholder="e.g. Call cardiology to schedule follow-up" />
        </div>
        <div className="fr">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} placeholder="Additional details…" />
        </div>

        <div className="modal-section">Assignment</div>
        <div className="fr">
          <label>Doctor</label>
          <div className="doctor-dropdown-wrap" ref={doctorDropRef}>
            <button type="button" className="doctor-dropdown-trigger" onClick={() => setDropdownOpen(o => !o)}>
              {form.doctorIds.length === 0 ? 'No doctor' : `${form.doctorIds.length} selected`}
              <span className="doctor-dropdown-caret">{dropdownOpen ? '▴' : '▾'}</span>
            </button>

            {dropdownOpen && (
              <div className="doctor-dropdown-menu">
                {careTeam.map(dr => (
                  <label key={dr.id} className="doctor-dropdown-item">
                    <input
                      type="checkbox"
                      checked={form.doctorIds.includes(dr.id)}
                      onChange={() => toggleDoctor(dr.id)}
                    />
                    <span>{dr.name}{dr.specialty && <span className="doctor-dropdown-specialty"> · {dr.specialty}</span>}</span>
                  </label>
                ))}
                {careTeam.length === 0 && <div className="doctor-dropdown-empty">No care team members</div>}
              </div>
            )}

            {form.doctorIds.length > 0 && (
              <div className="doctor-chips">
                {form.doctorIds.map(id => {
                  const dr = careTeam.find(d => d.id === id)
                  if (!dr) return null
                  return (
                    <span key={id} className="doctor-chip">
                      👨‍⚕️ {dr.name}
                      <button type="button" className="doctor-chip-remove" onClick={() => toggleDoctor(id)}>×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {users.length > 0 && (
          <div className="fr">
            <label>Assign to</label>
            <div className="assignee-checks">
              {users.map(u => (
                <label key={u.uid} className="assignee-check-label">
                  <input
                    type="checkbox"
                    checked={form.assigneeUids.includes(u.uid)}
                    onChange={() => toggleAssignee(u.uid)}
                  />
                  {u.displayName || u.email}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="fr">
          <label>Due date</label>
          <input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </div>

        <div className="mf">
          <button className="btn-cx" onClick={onClose}>Cancel</button>
          <button className="btn-sv" onClick={handleSave} disabled={saving}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </div>
    </div>
  )
}
