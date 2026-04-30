import { useState, useEffect, useRef } from 'react'
import { updateTaskAssignees, delTask } from '../../lib/firestore'
import { fmtShortDate } from '../../lib/medUtils'
import TaskModal from './TaskModal'
import { filterByPerson } from '../MainApp'
import PersonChip from '../PersonChip'

function PersonFilter({ value, onChange }) {
  return (
    <div className="person-filter">
      {['all', 'dad', 'mom'].map(p => (
        <button key={p} className={`pfill pfill-${p}${value === p ? ' on' : ''}`} onClick={() => onChange(p)}>
          {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}

const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }

const CATEGORIES = [
  { key: 'medical',  label: 'Medical',  icon: '💊', colorClass: 'medical' },
  { key: 'house',    label: 'House',    icon: '🏠', colorClass: 'house' },
  { key: 'finances', label: 'Finances', icon: '💰', colorClass: 'finances' },
]

function getStatus(task) {
  return task.status || (task.done ? 'done' : 'todo')
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d) < today
}

export default function TasksView({ tasks, careTeam, users, user, personFilter, onPersonFilter }) {
  const [editId, setEditId] = useState(undefined)
  const [defaultParentId, setDefaultParentId] = useState(null)
  const [assignPopupId, setAssignPopupId] = useState(null)
  const [showDone, setShowDone] = useState({})
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set())
  const assignPopupRef = useRef(null)

  useEffect(() => {
    if (!assignPopupId) return
    function handleClick(e) {
      if (assignPopupRef.current && !assignPopupRef.current.contains(e.target))
        setAssignPopupId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assignPopupId])

  const doctorMap = Object.fromEntries(careTeam.map(dr => [dr.id, dr]))
  const userMap = Object.fromEntries(users.map(u => [u.uid, u]))

  const filteredTasks = filterByPerson(tasks, personFilter)

  const sorted = [...filteredTasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.updatedAt?.localeCompare(a.updatedAt || '') || 0
  })

  // Build children map and filter to root tasks only
  const childrenByParentId = {}
  sorted.forEach(t => {
    if (t.parentId) {
      if (!childrenByParentId[t.parentId]) childrenByParentId[t.parentId] = []
      childrenByParentId[t.parentId].push(t)
    }
  })
  const rootTasks = sorted.filter(t => !t.parentId)

  // Build category sections from root tasks only
  const catSections = CATEGORIES.map(cat => {
    const catTasks = rootTasks.filter(t => (t.category || '') === cat.key)
    const byStatus = {
      todo:         catTasks.filter(t => getStatus(t) === 'todo'),
      'in-progress':catTasks.filter(t => getStatus(t) === 'in-progress'),
      done:         catTasks.filter(t => getStatus(t) === 'done'),
    }
    const activeCount = byStatus['todo'].length + byStatus['in-progress'].length
    return { ...cat, catTasks, byStatus, activeCount }
  })

  const uncategorized = rootTasks.filter(t => !t.category)

  async function handleSetAssignee(e, task, uid) {
    e.stopPropagation()
    setAssignPopupId(null)
    const next = uid ? [uid] : []
    try { await updateTaskAssignees(task, next) } catch { alert('Failed to update.') }
  }

  async function handleDelete(id) {
    const children = childrenByParentId[id] || []
    const msg = children.length > 0
      ? `Delete this task and its ${children.length} subtask${children.length > 1 ? 's' : ''}?`
      : 'Delete this task?'
    if (!confirm(msg)) return
    try { await delTask(id, tasks) } catch { alert('Failed to delete.') }
  }

  function handleNavigate(taskId) {
    setEditId(taskId)
  }

  function handleAddSubtask(parentId) {
    setDefaultParentId(parentId)
    setEditId(null)
  }

  function toggleExpanded(taskId, e) {
    e.stopPropagation()
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function renderSubtaskRow(child, isLast) {
    const status = getStatus(child)
    const overdue = status !== 'done' && isOverdue(child.dueDate)

    return (
      <li
        key={child.id}
        className={`subtask-row${status === 'done' ? ' subtask-done' : ''}${isLast ? ' subtask-last' : ''}`}
        onClick={() => setEditId(child.id)}
      >
        <span className="subtask-title">{child.title}</span>
        {child.dueDate && (
          <span className={`subtask-due${overdue ? ' overdue' : ''}`}>
            {overdue ? '⚠ ' : ''}{fmtShortDate(child.dueDate)}
          </span>
        )}
      </li>
    )
  }

  function renderTask(task) {
    const taskDoctorIds = Array.isArray(task.doctorIds)
      ? task.doctorIds
      : (task.doctorId ? [task.doctorId] : [])
    const doctors = taskDoctorIds.map(id => doctorMap[id]).filter(Boolean)
    const overdue = getStatus(task) !== 'done' && isOverdue(task.dueDate)
    const status = getStatus(task)
    const children = childrenByParentId[task.id] || []
    const isExpanded = expandedTaskIds.has(task.id)

    return (
      <li key={task.id} className={`task-row${status === 'done' ? ' task-done' : ''}`} style={{ display: 'block', padding: 0, border: 'none', borderLeft: `3px solid var(--${task.person || 'dad'})` }}>
        <div className="task-row-inner" onClick={() => setEditId(task.id)} style={{ cursor: 'pointer' }}>
          <div className="task-body">
            <div className="task-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PersonChip person={task.person} />
              {task.title}
            </div>
            <div className="task-meta">
              {doctors.map(dr => (
                <span key={dr.id} className="task-doctor">👨‍⚕️ {dr.name}</span>
              ))}
              {task.dueDate && (
                <span className={`task-due${overdue ? ' overdue' : ''}`}>
                  {overdue ? '⚠ ' : ''}{fmtShortDate(task.dueDate)}
                </span>
              )}
              {(task.comments?.length > 0) && (
                <span className="task-comment-count">💬 {task.comments.length}</span>
              )}
              {children.length > 0 && (
                <button
                  className="subtask-toggle-btn"
                  onClick={e => toggleExpanded(task.id, e)}
                >
                  {isExpanded ? '▼' : '▶'} {children.length} subtask{children.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
          <div className="task-actions">
            {users.length > 0 && (
              <div
                className="task-quick-assign"
                ref={assignPopupId === task.id ? assignPopupRef : null}
              >
                {(() => {
                  const assigneeUid = task.assigneeUids?.[0]
                  const assignee = assigneeUid ? userMap[assigneeUid] : null
                  const initial = assignee ? (assignee.displayName || assignee.email)[0].toUpperCase() : null
                  return (
                    <>
                      <button
                        className={`quick-assign-btn${assignee ? ' assigned' : ''}`}
                        onClick={e => { e.stopPropagation(); setAssignPopupId(assignPopupId === task.id ? null : task.id) }}
                      >
                        <span className="quick-assign-avatar">{initial ?? '+'}</span>
                        {assignee ? (assignee.displayName || assignee.email).split(' ')[0] : 'Assign'}
                      </button>
                      {assignPopupId === task.id && (
                        <div className="assign-popup">
                          {users.map(u => (
                            <div
                              key={u.uid}
                              className={`assign-popup-item${task.assigneeUids?.[0] === u.uid ? ' active' : ''}`}
                              onClick={e => handleSetAssignee(e, task, u.uid)}
                            >
                              <span className="assign-popup-avatar">{(u.displayName || u.email)[0].toUpperCase()}</span>
                              {(u.displayName || u.email).split(' ')[0]}
                              {task.assigneeUids?.[0] === u.uid && <span className="assign-popup-check">✓</span>}
                            </div>
                          ))}
                          <div
                            className={`assign-popup-item assign-popup-none${!task.assigneeUids?.[0] ? ' active' : ''}`}
                            onClick={e => handleSetAssignee(e, task, null)}
                          >
                            No one
                            {!task.assigneeUids?.[0] && <span className="assign-popup-check">✓</span>}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
        {isExpanded && children.length > 0 && (
          <ul className="subtask-rows">
            {children.map((child, i) => renderSubtaskRow(child, i === children.length - 1))}
          </ul>
        )}
      </li>
    )
  }

  function renderStatusGroup(statusKey, statusTasks, catKey) {
    if (statusTasks.length === 0) return null
    if (statusKey === 'done') {
      const visible = showDone[catKey]
      return (
        <div key={statusKey} className="task-cat-status-group">
          <button
            className="task-done-toggle"
            onClick={() => setShowDone(s => ({ ...s, [catKey]: !s[catKey] }))}
          >
            <span className={`task-cat-status-dot dot-done`} />
            {visible ? `Hide done (${statusTasks.length})` : `Show done (${statusTasks.length})`}
            <span className="task-done-caret">{visible ? '▴' : '▾'}</span>
          </button>
          {visible && (
            <ul className="task-list" style={{ marginTop: 6 }}>
              {statusTasks.map(renderTask)}
            </ul>
          )}
        </div>
      )
    }
    return (
      <div key={statusKey} className="task-cat-status-group">
        <div className="task-cat-status-label">
          <span className={`task-cat-status-dot dot-${statusKey.replace('-', '')}`} />
          {STATUS_LABELS[statusKey]}
        </div>
        <ul className="task-list">
          {statusTasks.map(renderTask)}
        </ul>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="mobile-person-filter">
        <PersonFilter value={personFilter} onChange={onPersonFilter} />
      </div>
      <div className="tbl-tools" style={{ marginBottom: 16 }}>
        <div />
        <button className="btn-add" onClick={() => { setDefaultParentId(null); setEditId(null) }}>+ Add Task</button>
      </div>

      {rootTasks.length === 0 && filteredTasks.length === 0 ? (
        <div className="task-empty">No tasks yet. Click "+ Add Task" to get started.</div>
      ) : (
        <div className="task-cat-sections">
          {catSections.map(({ key, label, icon, colorClass, catTasks, byStatus, activeCount }) => (
            catTasks.length === 0 ? null : (
              <div key={key} className="task-cat-section">
                <div className={`task-cat-header task-cat-header-${colorClass}`}>
                  <span className="task-cat-header-icon">{icon}</span>
                  <span className={`task-cat-header-label label-${colorClass}`}>{label}</span>
                  {activeCount > 0 && <span className={`task-cat-header-count count-${colorClass}`}>{activeCount}</span>}
                  {(() => {
                    const momCt = catTasks.filter(t => getStatus(t) !== 'done' && (t.person||'dad') === 'mom').length
                    const dadCt = catTasks.filter(t => getStatus(t) !== 'done' && (t.person||'dad') === 'dad').length
                    return momCt > 0 && (
                      <span className="dash-week-breakdown" style={{ marginLeft: 6 }}>
                        <span style={{ color: 'var(--dad)' }}>D:{dadCt}</span>
                        {' · '}
                        <span style={{ color: 'var(--mom)' }}>M:{momCt}</span>
                      </span>
                    )
                  })()}
                </div>
                <div className="task-cat-body">
                  {renderStatusGroup('todo', byStatus['todo'], key)}
                  {renderStatusGroup('in-progress', byStatus['in-progress'], key)}
                  {renderStatusGroup('done', byStatus['done'], key)}
                </div>
              </div>
            )
          ))}
          {uncategorized.length > 0 && (
            <div className="task-cat-section">
              <div className="task-cat-header task-cat-header-none">
                <span className="task-cat-header-label label-none">Uncategorized</span>
                {(() => { const n = uncategorized.filter(t => getStatus(t) !== 'done').length; return n > 0 && <span className="task-cat-header-count count-none">{n}</span> })()}
              </div>
              <div className="task-cat-body">
                {['todo', 'in-progress', 'done'].map(s =>
                  renderStatusGroup(s, uncategorized.filter(t => getStatus(t) === s), 'uncategorized')
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {editId !== undefined && (
        <TaskModal
          tasks={tasks}
          careTeam={careTeam}
          users={users}
          user={user}
          editId={editId}
          defaultParentId={defaultParentId}
          onClose={() => { setEditId(undefined); setDefaultParentId(null) }}
          onNavigate={handleNavigate}
          onAddSubtask={handleAddSubtask}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
