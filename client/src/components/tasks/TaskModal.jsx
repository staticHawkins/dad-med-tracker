import { useState, useEffect, useRef } from 'react'
import { saveTask, updateTaskFields, addComment, deleteComment, newId } from '../../lib/firestore'
import { useIsMobile } from '../../hooks/useIsMobile'

const STATUSES = ['todo', 'in-progress', 'done']
const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' }

const CATEGORIES = ['house', 'medical', 'finances']
const CATEGORY_LABELS = { house: 'House', medical: 'Medical', finances: 'Finances' }

const EMPTY = {
  title: '', description: '', doctorIds: [], assigneeUids: [],
  dueDate: '', status: 'todo', priority: 'medium', category: 'medical'
}

function InlineField({ field, value, type = 'text', placeholder = '', editCtx }) {
  const { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit } = editCtx
  if (editingField === field) {
    return (
      <input
        className="inline-input"
        type={type}
        value={draftValue}
        autoFocus
        onChange={e => setDraftValue(e.target.value)}
        onBlur={() => commitEdit(field, draftValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit(field, draftValue)
          if (e.key === 'Escape') cancelEdit()
        }}
        placeholder={placeholder}
      />
    )
  }
  return (
    <span
      className="inline-val"
      tabIndex={0}
      onClick={() => startEdit(field, value)}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {value || <span style={{ color: 'var(--text3)' }}>{placeholder || '—'}</span>}
    </span>
  )
}

function InlineTextarea({ field, value, placeholder = '', editCtx }) {
  const { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit } = editCtx
  const taRef = useRef(null)

  useEffect(() => {
    if (editingField === field && taRef.current) {
      const el = taRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [editingField, field])

  if (editingField === field) {
    return (
      <textarea
        ref={taRef}
        className="inline-input"
        style={{ resize: 'vertical', minHeight: '4lh', overflow: 'hidden' }}
        value={draftValue}
        autoFocus
        onChange={e => {
          setDraftValue(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onBlur={() => commitEdit(field, draftValue)}
        onKeyDown={e => e.key === 'Escape' && cancelEdit()}
        placeholder={placeholder}
      />
    )
  }
  return (
    <span
      className="inline-val"
      style={{ whiteSpace: 'pre-wrap', display: 'block' }}
      tabIndex={0}
      onClick={() => startEdit(field, value)}
      onKeyDown={e => e.key === 'Enter' && startEdit(field, value)}
    >
      {value || <span style={{ color: 'var(--text3)' }}>Not documented</span>}
    </span>
  )
}

export default function TaskModal({ tasks, careTeam, users, editId, onClose, user }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(EMPTY)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [creating, setCreating] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Inline edit state (edit mode only)
  const [editingField, setEditingField] = useState(null)
  const [draftValue, setDraftValue] = useState('')

  const doctorDropRef = useRef(null)
  const commentsEndRef = useRef(null)
  const saveTimer  = useRef(null)
  const savedTimer = useRef(null)
  const isDirty    = useRef(false)
  const lastPatch  = useRef(null)

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
      status: task.status || (task.done ? 'done' : 'todo'),
      priority: task.priority || 'medium',
      category: task.category || 'medical'
    })
  }, [editId])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (editingField) { cancelEdit(); return }
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, editingField])

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

  async function saveFields(patch) {
    if (!isEditing) return
    lastPatch.current = patch
    setSaveStatus('saving')
    try {
      await updateTaskFields(editId, patch)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function retryWrite() {
    if (!lastPatch.current) return
    setSaveStatus('saving')
    try {
      await updateTaskFields(editId, lastPatch.current)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  function toggleDoctor(id) {
    isDirty.current = true
    const nextDoctorIds = form.doctorIds.includes(id)
      ? form.doctorIds.filter(d => d !== id)
      : [...form.doctorIds, id]
    setForm(f => ({ ...f, doctorIds: nextDoctorIds }))
    saveFields({ doctorIds: nextDoctorIds })
  }

  function setStatus(s) {
    setForm(f => ({ ...f, status: s }))
    saveFields({ status: s, done: s === 'done' })
  }

  function setCategory(c) {
    setForm(f => ({ ...f, category: c }))
    saveFields({ category: c })
  }

  function setAssignee(uid) {
    const nextAssigneeUids = form.assigneeUids[0] === uid ? [] : [uid]
    setForm(f => ({ ...f, assigneeUids: nextAssigneeUids }))
    saveFields({ assigneeUids: nextAssigneeUids })
  }

  async function handleCreate() {
    if (!form.title.trim()) { alert('Please enter a task title.'); return }
    if (!form.dueDate)      { alert('Please enter a due date.'); return }
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

  // ── Inline edit helpers (edit mode only) ───────────────────────────────────

  function startEdit(field, currentValue) {
    setEditingField(field)
    setDraftValue(currentValue ?? '')
  }

  function cancelEdit() { setEditingField(null) }

  async function commitEdit(field, value) {
    setEditingField(null)
    if (value === (form[field] ?? '')) return
    setForm(f => ({ ...f, [field]: value }))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveFields({ [field]: value }), 600)
  }

  const editCtx = { editingField, draftValue, setDraftValue, commitEdit, cancelEdit, startEdit }

  const priorityColor = { low: 'var(--text2)', medium: '#BA7517', high: '#D85A30' }

  // ── Shared sections ────────────────────────────────────────────────────────

  const doctorsSection = (
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
  )

  const assigneeSection = users.length > 0 && (
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
  )

  const commentsSection = (
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
                    onClick={() => task && deleteComment(task, c.id)}
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
  )

  // ── Edit mode: centered popup with inline-editable view ────────────────────

  if (isEditing) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal modal-task" role="dialog" aria-modal="true">

          {/* Header */}
          <div className="modal-task-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                <InlineField field="title" value={form.title} placeholder="Task title" editCtx={editCtx} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                <InlineField field="dueDate" value={form.dueDate} type="date" editCtx={editCtx} />
              </div>
            </div>
            <div className="modal-header-right">
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

          {/* Status */}
          <div className="fr" style={{ marginTop: 12 }}>
            <label>Status</label>
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
          </div>

          {/* Priority — inline select */}
          <div className="fr">
            <label>Priority</label>
            {editingField === 'priority'
              ? (
                <select
                  className="inline-input"
                  value={draftValue}
                  autoFocus
                  onChange={e => setDraftValue(e.target.value)}
                  onBlur={() => commitEdit('priority', draftValue)}
                  onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                  style={{ color: priorityColor[draftValue] || 'inherit' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              )
              : (
                <span
                  className="inline-val"
                  tabIndex={0}
                  onClick={() => startEdit('priority', form.priority)}
                  onKeyDown={e => e.key === 'Enter' && startEdit('priority', form.priority)}
                  style={{ color: priorityColor[form.priority] || 'inherit', fontWeight: 600 }}
                >
                  {form.priority ? form.priority.charAt(0).toUpperCase() + form.priority.slice(1) : 'Medium'}
                </span>
              )
            }
          </div>

          {/* Category */}
          <div className="fr">
            <label>Category</label>
            <div className="status-selector">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`cat-sel-btn task-cat-btn-${c}${form.category === c ? ' active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="fr">
            <label>Description</label>
            <InlineTextarea field="description" value={form.description} placeholder="Additional details…" editCtx={editCtx} />
          </div>

          {/* Doctors & Assignee */}
          {doctorsSection}
          {assigneeSection}

          {/* Comments */}
          {commentsSection}

        </div>
      </div>
    )
  }

  // ── Add mode: responsive bottom sheet (mobile) / centered popup (desktop) ──

  const addFormContent = (
    <>
      <div className="sheet-section">Required</div>
      <div className="fr">
        <label>Title <span className="req">*</span></label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. Call cardiology to schedule follow-up" />
      </div>
      <div className="fr">
        <label>Due date <span className="req">*</span></label>
        <input type="date" value={form.dueDate} onChange={set('dueDate')} />
      </div>
      <div className="fr">
        <label>Category</label>
        <div className="status-selector">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`cat-sel-btn task-cat-btn-${c}${form.category === c ? ' active' : ''}`}
              onClick={() => setForm(f => ({ ...f, category: c }))}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="sheet-section">Optional</div>
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
              onClick={() => setForm(f => ({ ...f, status: s }))}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
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

      <div className="sheet-section">Assignment</div>
      {doctorsSection}
      {assigneeSection}

      <div className="mf" style={{ marginTop: 20 }}>
        <button className="btn-cx" onClick={onClose}>Cancel</button>
        <button className="btn-sv" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </>
  )

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal modal-task" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sheet-title">Add task</span>
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          {addFormContent}
        </div>
      </div>
    )
  }

  return (
    <div className="fs-overlay" role="dialog" aria-modal="true">
      <div className="fs-header">
        <span className="fs-title">Add task</span>
        <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="fs-body">{addFormContent}</div>
    </div>
  )
}
