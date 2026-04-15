import { useState, useEffect, useRef } from 'react'
import { saveTask, addComment, deleteComment, newId } from '../../lib/firestore'

const STATUSES = ['todo', 'in-progress', 'done']
const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' }

const EMPTY = {
  title: '', description: '', doctorIds: [], assigneeUids: [],
  dueDate: '', status: 'todo', priority: 'medium'
}

export default function TaskModal({ tasks, careTeam, users, editId, onClose, user }) {
  const [form, setForm] = useState(EMPTY)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [creating, setCreating] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const doctorDropRef = useRef(null)
  const commentsEndRef = useRef(null)
  const saveTimer = useRef(null)
  const savedTimer = useRef(null)
  const isDirty = useRef(false)
  const lastForm = useRef(null)
  const dragStartY = useRef(null)

  const task = tasks.find(x => x.id === editId)
  const comments = task?.comments || []
  const isEditing = !!editId
  const isOpen = editId !== undefined

  useEffect(() => {
    isDirty.current = false
    if (!editId) { setForm(EMPTY); return }
    if (task) setForm({
      title: task.title || '',
      description: task.description || '',
      doctorIds: Array.isArray(task.doctorIds) ? task.doctorIds : (task.doctorId ? [task.doctorId] : []),
      assigneeUids: task.assigneeUids || [],
      dueDate: task.dueDate || '',
      status: task.status || (task.done ? 'done' : 'todo'),
      priority: task.priority || 'medium'
    })
  }, [editId])

  // Debounced autosave for text fields
  useEffect(() => {
    if (!isEditing || !isDirty.current || !form.title.trim()) return
    lastForm.current = form
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveTask(form, editId)
        setSaveStatus('saved')
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
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

  // Immediate save helper for toggle fields
  async function saveImmediate(nextForm) {
    if (!isEditing || !nextForm.title.trim()) return
    lastForm.current = nextForm
    clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    try {
      await saveTask(nextForm, editId)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function retryWrite() {
    if (!lastForm.current) return
    setSaveStatus('saving')
    try {
      await saveTask(lastForm.current, editId)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
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

  function setStatus(s) {
    isDirty.current = true
    const next = { ...form, status: s }
    setForm(next)
    saveImmediate(next)
  }

  function setAssignee(uid) {
    isDirty.current = true
    const next = {
      ...form,
      assigneeUids: form.assigneeUids[0] === uid ? [] : [uid]
    }
    setForm(next)
    saveImmediate(next)
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

  const sheetRef = useRef(null)

  function onTouchStart(e) {
    dragStartY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (dragStartY.current === null || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function onTouchEnd(e) {
    if (dragStartY.current === null) return
    const delta = e.changedTouches[0].clientY - dragStartY.current
    dragStartY.current = null
    if (sheetRef.current) sheetRef.current.style.transform = ''
    if (delta > 80) onClose()
  }

  const priorityColor = { low: 'var(--text2)', medium: '#BA7517', high: '#D85A30' }

  return (
    <>
      {isOpen && (
        <div className="sheet-backdrop" onClick={onClose} />
      )}
      <div
        ref={sheetRef}
        className={`edit-sheet${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="sheet-handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        <div
          className="sheet-header"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="sheet-title">{isEditing ? 'Edit task' : 'Add task'}</span>
          <div className="sheet-header-right">
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

        <div className="sheet-body">
          <div className="fr">
            <label>Title <span className="req">*</span></label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Call cardiology to schedule follow-up" />
          </div>
          <div className="fr">
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Additional details…" />
          </div>

          <div className="sheet-section">Status</div>
          <div className="status-selector">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                className={`status-sel-btn status-sel-${s.replace('-', '')}${form.status === s ? ' active' : ''}`}
                onClick={() => setStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="sheet-section">Assignment</div>
          <div className="fr">
            <label>Doctors</label>
            <div className="doctor-dropdown-wrap" ref={doctorDropRef}>
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
              <button type="button" className="doctor-dropdown-trigger" onClick={() => setDropdownOpen(o => !o)}>
                {form.doctorIds.length === 0 ? 'Add doctor' : 'Add another'}
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

          <div className="f2">
            <div className="fr">
              <label>Due date <span className="req">*</span></label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')} />
            </div>
            <div className="fr">
              <label>Priority</label>
              <select
                value={form.priority}
                onChange={set('priority')}
                style={{ color: priorityColor[form.priority] || 'inherit' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {isEditing && (
            <div className="task-comments">
              <div className="sheet-section" style={{ marginTop: 20 }}>Comments</div>
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
    </>
  )
}
