import { useState, useEffect, useRef } from 'react'
import { saveTask, updateTaskFields, addComment, deleteComment, newId } from '../../lib/firestore'
import { fmtShortDate } from '../../lib/medUtils'
import { useIsMobile } from '../../hooks/useIsMobile'

const STATUSES = ['todo', 'in-progress', 'done']
const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' }

const CATEGORIES = ['house', 'medical', 'finances']
const CATEGORY_LABELS = { house: 'House', medical: 'Medical', finances: 'Finances' }

const EMPTY = {
  title: '', description: '', doctorIds: [], assigneeUids: [],
  dueDate: '', status: 'todo', priority: 'medium', category: '', person: 'dad'
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

export default function TaskModal({ tasks, careTeam, users, editId, defaultParentId, onClose, onNavigate, onAddSubtask, onDelete, user }) {
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

  // Add mode: parent task picker
  const [taskType, setTaskType] = useState('root')
  const [selectedParentId, setSelectedParentId] = useState(null)
  const [parentSearch, setParentSearch] = useState('')
  const [parentPickerOpen, setParentPickerOpen] = useState(false)

  // Edit mode: link existing task picker
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')

  // Edit mode: change parent picker (only for subtasks)
  const [showParentPicker, setShowParentPicker] = useState(false)
  const [parentPickerEditSearch, setParentPickerEditSearch] = useState('')

  const doctorDropRef = useRef(null)
  const commentsEndRef = useRef(null)
  const parentPickerRef = useRef(null)
  const linkPickerRef = useRef(null)
  const parentPickerEditRef = useRef(null)
  const saveTimer  = useRef(null)
  const savedTimer = useRef(null)
  const isDirty    = useRef(false)
  const lastPatch  = useRef(null)

  const task = tasks.find(x => x.id === editId)
  const comments = task?.comments || []
  const isEditing = !!editId

  const parentTask = task?.parentId ? tasks.find(x => x.id === task.parentId) : null
  const subtasks = isEditing ? tasks.filter(t => t.parentId === editId) : []

  // Root tasks available for parent picker (add mode)
  const availableParents = tasks.filter(t => !t.parentId)
  const filteredParents = parentSearch
    ? availableParents.filter(t => t.title.toLowerCase().includes(parentSearch.toLowerCase()))
    : availableParents
  const selectedParent = selectedParentId ? tasks.find(t => t.id === selectedParentId) : null

  // Root tasks available to link as subtasks (edit mode) — exclude tasks that already have subtasks
  const tasksWithChildren = new Set(tasks.filter(t => t.parentId).map(t => t.parentId))
  const linkableTasks = tasks.filter(t =>
    !t.parentId &&
    t.id !== editId &&
    !tasksWithChildren.has(t.id)
  )
  const filteredLinkable = linkSearch
    ? linkableTasks.filter(t => t.title.toLowerCase().includes(linkSearch.toLowerCase()))
    : linkableTasks

  // Root tasks available to be chosen as a new parent (edit mode, for subtasks)
  const changeableParents = tasks.filter(t => !t.parentId && t.id !== editId)
  const filteredChangeableParents = parentPickerEditSearch
    ? changeableParents.filter(t => t.title.toLowerCase().includes(parentPickerEditSearch.toLowerCase()))
    : changeableParents

  useEffect(() => {
    isDirty.current = false
    if (!editId) {
      const parent = defaultParentId ? tasks.find(x => x.id === defaultParentId) : null
      setForm({ ...EMPTY, category: parent?.category || '', person: parent?.person || EMPTY.person })
      setTaskType(defaultParentId ? 'subtask' : 'root')
      setSelectedParentId(defaultParentId || null)
      setParentSearch('')
      setParentPickerOpen(false)
      return
    }
    setShowLinkPicker(false)
    setLinkSearch('')
    setShowParentPicker(false)
    setParentPickerEditSearch('')
    if (task) setForm({
      title: task.title || '',
      description: task.description || '',
      doctorIds: Array.isArray(task.doctorIds) ? task.doctorIds : (task.doctorId ? [task.doctorId] : []),
      assigneeUids: task.assigneeUids || [],
      dueDate: task.dueDate || '',
      status: task.status || (task.done ? 'done' : 'todo'),
      priority: task.priority || 'medium',
      category: task.category || '',
      person: task.person || 'dad'
    })
  }, [editId, defaultParentId])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (editingField) { cancelEdit(); return }
        if (parentPickerOpen) { setParentPickerOpen(false); return }
        if (showLinkPicker) { setShowLinkPicker(false); return }
        if (showParentPicker) { setShowParentPicker(false); return }
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, editingField, parentPickerOpen, showLinkPicker, showParentPicker])

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
    if (!parentPickerOpen) return
    function handleClick(e) {
      if (parentPickerRef.current && !parentPickerRef.current.contains(e.target))
        setParentPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [parentPickerOpen])

  useEffect(() => {
    if (!showLinkPicker) return
    function handleClick(e) {
      if (linkPickerRef.current && !linkPickerRef.current.contains(e.target))
        setShowLinkPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showLinkPicker])

  useEffect(() => {
    if (!showParentPicker) return
    function handleClick(e) {
      if (parentPickerEditRef.current && !parentPickerEditRef.current.contains(e.target))
        setShowParentPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showParentPicker])

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
    if (!form.category)     { alert('Please select a category.'); return }
    if (taskType === 'subtask' && !selectedParentId) { alert('Please select a parent task.'); return }
    setCreating(true)
    try {
      const parentId = taskType === 'subtask' ? selectedParentId : null
      await saveTask({ ...form, ...(parentId ? { parentId } : {}) }, null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setCreating(false)
  }

  async function handleLinkTask(linkedTask) {
    const parentPerson = task?.person || 'dad'
    const childPerson = linkedTask.person || 'dad'
    if (childPerson !== parentPerson) {
      alert(`Cannot link: "${linkedTask.title}" is assigned to ${childPerson === 'mom' ? 'Mom' : 'Dad'} but this task belongs to ${parentPerson === 'mom' ? 'Mom' : 'Dad'}.`)
      return
    }
    setShowLinkPicker(false)
    setLinkSearch('')
    try {
      await updateTaskFields(linkedTask.id, { parentId: editId })
    } catch { alert('Failed to link task.') }
  }

  async function handleChangeParent(newParentId) {
    setShowParentPicker(false)
    setParentPickerEditSearch('')
    try {
      const newParent = tasks.find(t => t.id === newParentId)
      await updateTaskFields(editId, { parentId: newParentId, person: newParent?.person || 'dad' })
    } catch { alert('Failed to update parent task.') }
  }

  async function handleRemoveParent() {
    setShowParentPicker(false)
    setParentPickerEditSearch('')
    try {
      await updateTaskFields(editId, { parentId: null })
    } catch { alert('Failed to remove parent task.') }
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

  const doctorsSection = form.category === 'medical' && (
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

  const subtasksSection = isEditing && !task?.parentId && (
    <div className="task-subtasks-section">
      <div className="sheet-section" style={{ marginTop: 20 }}>
        Subtasks
        {subtasks.length > 0 && <span className="subtasks-count-badge">{subtasks.length}</span>}
      </div>
      {subtasks.length > 0 && (
        <ul className="task-subtask-list">
          {subtasks.map(child => {
            const childStatus = child.status || (child.done ? 'done' : 'todo')
            return (
              <li
                key={child.id}
                className={`task-subtask-item${childStatus === 'done' ? ' subtask-item-done' : ''}`}
                onClick={() => onNavigate?.(child.id)}
              >
                <span className={`subtask-modal-dot subtask-modal-dot-${childStatus.replace('-', '')}`} />
                <span className="task-subtask-title">{child.title}</span>
                {child.dueDate && (
                  <span className="task-subtask-due">{fmtShortDate(child.dueDate)}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="subtask-add-row">
        <button type="button" className="subtask-add-btn" onClick={() => onAddSubtask?.(editId)}>
          + New subtask
        </button>
        <button
          type="button"
          className={`subtask-link-btn${showLinkPicker ? ' active' : ''}`}
          onClick={() => { setShowLinkPicker(o => !o); setLinkSearch('') }}
        >
          Link existing
        </button>
      </div>
      {showLinkPicker && (
        <div className="link-picker-wrap" ref={linkPickerRef}>
          <input
            className="link-picker-search"
            placeholder="Search tasks to link…"
            value={linkSearch}
            onChange={e => setLinkSearch(e.target.value)}
            autoFocus
          />
          <div className="link-picker-list">
            {filteredLinkable.length === 0
              ? <div className="link-picker-empty">No tasks available to link</div>
              : filteredLinkable.map(t => (
                <div key={t.id} className="link-picker-item" onClick={() => handleLinkTask(t)}>
                  <span className="link-picker-title">{t.title}</span>
                  {t.category && (
                    <span className={`task-cat-badge task-cat-${t.category}`}>{CATEGORY_LABELS[t.category]}</span>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )

  const allComments = [
    ...comments.map(c => ({ ...c, _source: task })),
    ...subtasks.flatMap(st => (st.comments || []).map(c => ({ ...c, _source: st })))
  ].sort((a, b) => (a.at || '').localeCompare(b.at || ''))

  const commentsSection = (
    <div className="task-comments">
      <div className="sheet-section" style={{ marginTop: 20 }}>Comments</div>
      {allComments.length === 0 ? (
        <div className="comments-empty">No comments yet.</div>
      ) : (
        <ul className="comments-list">
          {allComments.map(c => (
            <li key={`${c._source.id}-${c.id}`} className="comment-item">
              {c._source.id !== editId && (
                <button
                  type="button"
                  className="comment-subtask-ref"
                  onClick={() => onNavigate?.(c._source.id)}
                >
                  ↳ {c._source.title}
                </button>
              )}
              <div className="comment-header">
                <span className="comment-author">{c.name}</span>
                <span className="comment-time">{formatCommentTime(c.at)}</span>
                {c.uid === user?.uid && (
                  <button
                    className="comment-delete"
                    title="Delete comment"
                    onClick={() => deleteComment(c._source, c.id)}
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
    const editContent = (
      <>
          {/* Parent breadcrumb + change parent picker */}
          {parentTask && (
            <>
              <div className="task-parent-row">
                <button type="button" className="task-parent-crumb" onClick={() => onNavigate?.(parentTask.id)}>
                  ← Part of: {parentTask.title}
                </button>
                <button
                  type="button"
                  className={`task-parent-change-btn${showParentPicker ? ' active' : ''}`}
                  onClick={() => { setShowParentPicker(o => !o); setParentPickerEditSearch('') }}
                >
                  Change parent
                </button>
              </div>
              {showParentPicker && (
                <div className="link-picker-wrap" ref={parentPickerEditRef} style={{ marginBottom: 8 }}>
                  <input
                    className="link-picker-search"
                    placeholder="Search tasks…"
                    value={parentPickerEditSearch}
                    onChange={e => setParentPickerEditSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="link-picker-list">
                    {filteredChangeableParents.map(t => (
                      <div
                        key={t.id}
                        className={`link-picker-item${task?.parentId === t.id ? ' link-picker-item-selected' : ''}`}
                        onClick={() => handleChangeParent(t.id)}
                      >
                        <span className="link-picker-title">{t.title}</span>
                        {t.category && (
                          <span className={`task-cat-badge task-cat-${t.category}`}>{CATEGORY_LABELS[t.category]}</span>
                        )}
                      </div>
                    ))}
                    {filteredChangeableParents.length === 0 && (
                      <div className="link-picker-empty">No tasks found</div>
                    )}
                    <div className="link-picker-item link-picker-remove" onClick={handleRemoveParent}>
                      Remove parent (make root task)
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Title + date — mobile shows inline rows; desktop shows full header */}
          {isMobile && (
            <>
              <div className="fr">
                <label>Title</label>
                <InlineField field="title" value={form.title} placeholder="Task title" editCtx={editCtx} />
              </div>
              <div className="fr">
                <label>Due date</label>
                <InlineField field="dueDate" value={form.dueDate} type="date" editCtx={editCtx} />
              </div>
            </>
          )}
          {!isMobile && <div className="modal-task-header">
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
          </div>}

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

          {/* Subtasks */}
          {subtasksSection}

          {/* Comments */}
          {commentsSection}
      </>
    )

    if (!isMobile) {
      return (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <div className="modal modal-task task-edit-modal" role="dialog" aria-modal="true">
            {editContent}
          </div>
        </div>
      )
    }

    return (
      <div className="fs-overlay task-edit-modal" role="dialog" aria-modal="true">
        <div className="fs-header">
          <span className="fs-title">{form.title || 'Task'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <div className="fs-body">{editContent}</div>
      </div>
    )
  }

  // ── Add mode: responsive bottom sheet (mobile) / centered popup (desktop) ──

  const addTitle = taskType === 'subtask' ? 'Add subtask' : 'Add task'

  const parentPickerSection = (
    <div className="fr">
      <label>Parent task <span className="req">*</span></label>
      <div className="parent-picker-wrap" ref={parentPickerRef}>
        <button
          type="button"
          className={`parent-picker-trigger${selectedParent ? ' has-value' : ''}`}
          onClick={() => setParentPickerOpen(o => !o)}
        >
          <span className="parent-picker-value">
            {selectedParent ? selectedParent.title : 'Select parent task…'}
          </span>
          <span className="parent-picker-caret">{parentPickerOpen ? '▴' : '▾'}</span>
        </button>
        {parentPickerOpen && (
          <div className="parent-picker-dropdown">
            <input
              className="parent-picker-search"
              placeholder="Search tasks…"
              value={parentSearch}
              onChange={e => setParentSearch(e.target.value)}
              autoFocus
            />
            <div className="parent-picker-list">
              {filteredParents.length === 0
                ? <div className="parent-picker-empty">No tasks found</div>
                : filteredParents.map(t => (
                  <div
                    key={t.id}
                    className={`parent-picker-item${selectedParentId === t.id ? ' selected' : ''}`}
                    onClick={() => {
                      setSelectedParentId(t.id)
                      setForm(f => ({ ...f, category: t.category || f.category, person: t.person || 'dad' }))
                      setParentPickerOpen(false)
                      setParentSearch('')
                    }}
                  >
                    <span className="parent-picker-title">{t.title}</span>
                    {t.category && (
                      <span className={`task-cat-badge task-cat-${t.category}`}>{CATEGORY_LABELS[t.category]}</span>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const addFormContent = (
    <>
      <div className="sheet-section">Required</div>
      {taskType === 'root' && (
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
      )}
      <div className="fr">
        <label>Title <span className="req">*</span></label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. Call cardiology to schedule follow-up" />
      </div>
      <div className="fr">
        <label>Due date <span className="req">*</span></label>
        <input type="date" value={form.dueDate} onChange={set('dueDate')} />
      </div>

      {/* Task type selector */}
      <div className="fr">
        <label>Type</label>
        <div className="status-selector">
          <button
            type="button"
            className={`status-sel-btn status-sel-todo${taskType === 'root' ? ' active' : ''}`}
            onClick={() => { setTaskType('root'); setSelectedParentId(null) }}
          >
            Root task
          </button>
          <button
            type="button"
            className={`status-sel-btn status-sel-inprog${taskType === 'subtask' ? ' active' : ''}`}
            onClick={() => setTaskType('subtask')}
          >
            Subtask
          </button>
        </div>
      </div>

      {/* Parent picker (only when subtask is selected) */}
      {taskType === 'subtask' && parentPickerSection}

      <div className="fr">
        <label>Category {taskType === 'root' && <span className="req">*</span>}</label>
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
          {creating ? 'Creating…' : `Create ${taskType === 'subtask' ? 'subtask' : 'task'}`}
        </button>
      </div>
    </>
  )

  if (!isMobile) {
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal modal-task" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sheet-title">{addTitle}</span>
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
        <span className="fs-title">{addTitle}</span>
        <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="fs-body">{addFormContent}</div>
    </div>
  )
}
