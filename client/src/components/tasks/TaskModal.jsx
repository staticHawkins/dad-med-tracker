import { useState, useEffect } from 'react'
import { saveTask } from '../../lib/firestore'

const EMPTY = {
  title: '', description: '', doctorId: '', assigneeUids: [], dueDate: '', done: false
}

export default function TaskModal({ tasks, careTeam, users, editId, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!editId) { setForm(EMPTY); return }
    const t = tasks.find(x => x.id === editId)
    if (t) setForm({
      title: t.title || '',
      description: t.description || '',
      doctorId: t.doctorId || '',
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

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
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
          <select value={form.doctorId} onChange={set('doctorId')}>
            <option value="">No doctor</option>
            {careTeam.map(dr => (
              <option key={dr.id} value={dr.id}>
                {dr.name}{dr.specialty ? ` · ${dr.specialty}` : ''}
              </option>
            ))}
          </select>
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
