import { useState, useEffect, useRef } from 'react'
import { saveTask, addComment, deleteComment, newId } from '../../lib/firestore'

const STATUSES = ['todo', 'in-progress', 'done']
const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }

const EMPTY = {
  title: '', description: '', doctorIds: [], assigneeUids: [], dueDate: '', status: 'todo'
}

export default function TaskModal({ tasks, careTeam, users, editId, onClose, user }) {
  const [form, setForm] = useState(EMPTY)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved
  const [creating, setCreating] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const doctorDropRef = useRef(null)
  const commentsEndRef = useRef(null)
  const saveTimer = useRef(null)
  const isDirty = useRef(false)

  const task = tasks.find(x => x.id === editId)
  const comments = task?.comments || []
  const isEditing = !!editId

  useEffect(() => {
    isDirty.current = false
    if (!editId) { setForm(EMPTY); return }
    if (task) setForm({
      title: task.title || '',
      description: task.description || '',
      doctorIds: Array.isArray(task.doctorIds) ? task.doctorIds : (task.doctorId ? [task.doctorId] : []),
      assigneeUids: task.assigneeUids || [],
      dueDate: task.dueDate || '',
      status: task.status || (task.done ? 'done' : 'todo')
    })
  }, [editId])

  // Auto-save when editing
  useEffect(() => {
    if (!isEditing || !isDirty.current || !form.title.trim()) return
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveTask(form, editId)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 700)
    return () => clearTimeout(saveTimer.current)
  }, [form])

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

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  function set(field) {
    return e => {
      isDirty.current = true
      setForm(f => ({ ...f, [field]: e.target.value }))
    }
  }

  function toggleDoctor(id) {
    isDirty.current = true
    setForm(f => ({
      ...f,
      doctorIds: f.doctorIds.includes(id)
        ? f.doctorIds.filter(d => d !== id)
        : [...f.doctorIds, id]
    }))
  }

  function setAssignee(uid) {
    isDirty.current = true
    setForm(f => ({
      ...f,
      assigneeUids: f.assigneeUids[0] === uid ? [] : [uid]
    }))
  }

  async function handleCreate() {
    if (!form.title.trim()) { alert('Please enter a task title.'); return }
    setCreating(true)
    try {
      await saveTask(form, null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setCreating(false)
  }

  async function handlePostComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    try {
      const comment = {
        id: newId(),
        text: newComment.trim(),
        uid: user?.uid || '',
        name: user?.displayName || user?.email || 'Unknown',
        at: new Date().toISOString()
      }
      await addComment(editId, comment)
      setNewComment('')
    } catch { alert('Failed to post comment.') }
    setPostingComment(false)
  }

  function formatCommentTime(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const isOpen = editId !== undefined

  return (
    <div className="modal-bg" style={{ display: isOpen ? 'flex' : 'none' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-task">
        <div className="modal-task-header">
          <h2>{isEditing ? 'Edit task' : 'Add task'}</h2>
          <div className="modal-header-right">
            {isEditing && (
              <span className="autosave-status">
                {saveStatus === 'saving' && <span className="autosave-saving">Saving…</span>}
                {saveStatus === 'saved' && <span className="autosave-saved">Saved ✓</span>}
              </span>
            )}
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="fr">
          <label>Title <span className="req">*</span></label>
          <input autoFocus value={form.title} onChange={set('title')} placeholder="e.g. Call cardiology to schedule follow-up" />
        </div>
        <div className="fr">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} placeholder="Additional details…" />
        </div>

        <div className="fr">
          <label>Status</label>
          <div className="status-selector">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                className={`status-sel-btn status-sel-${s.replace('-', '')}${form.status === s ? ' active' : ''}`}
                onClick={() => { isDirty.current = true; setForm(f => ({ ...f, status: s })) }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
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
                  <div
                    key={dr.id}
                    className={`doctor-dropdown-item${form.doctorIds.includes(dr.id) ? ' selected' : ''}`}
                    onClick={() => toggleDoctor(dr.id)}
                  >
                    {dr.name}{dr.specialty && <span className="doctor-dropdown-specialty"> · {dr.specialty}</span>}
                  </div>
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
            <div className="assignee-pills">
              {users.map(u => {
                const selected = form.assigneeUids[0] === u.uid
                return (
                  <button
                    key={u.uid}
                    type="button"
                    className={`assignee-pill${selected ? ' selected' : ''}`}
                    onClick={() => setAssignee(u.uid)}
                  >
                    {selected && <span className="assignee-pill-dot" />}
                    {(u.displayName || u.email).split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="fr">
          <label>Due date</label>
          <input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </div>

        {isEditing && (
          <div className="task-comments">
            <div className="modal-section" style={{ marginTop: 20 }}>Comments</div>
            {comments.length === 0 ? (
              <div className="comments-empty">No comments yet.</div>
            ) : (
              <ul className="comments-list">
                {[...comments].sort((a, b) => a.at?.localeCompare(b.at || '') || 0).map(c => (
                  <li key={c.id} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">{c.name}</span>
                      <span className="comment-time">{formatCommentTime(c.at)}</span>
                      {c.uid === user?.uid && (
                        <button
                          className="comment-delete"
                          title="Delete comment"
                          onClick={() => deleteComment(task, c.id)}
                        >✕</button>
                      )}
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </li>
                ))}
                <div ref={commentsEndRef} />
              </ul>
            )}
            <div className="comment-input-row">
              <textarea
                className="comment-input"
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }}
                rows={2}
              />
              <button
                className="btn-post-comment"
                onClick={handlePostComment}
                disabled={postingComment || !newComment.trim()}
              >
                {postingComment ? '…' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="mf" style={{ marginTop: 20 }}>
            <button className="btn-cx" onClick={onClose}>Cancel</button>
            <button className="btn-sv" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create task'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
