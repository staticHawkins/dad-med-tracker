import { useState, useEffect, useRef } from 'react'
import { updateTaskAssignees, delTask } from '../../lib/firestore'
import TaskModal from './TaskModal'

const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }

const CATEGORIES = [
  { key: 'medical',  label: 'Medical',  icon: '💊', colorClass: 'medical' },
  { key: 'house',    label: 'House',    icon: '🏠', colorClass: 'house' },
  { key: 'finances', label: 'Finances', icon: '💰', colorClass: 'finances' },
]

function getStatus(task) {
  return task.status || (task.done ? 'done' : 'todo')
}

function formatDue(dueDate) {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d) < today
}

export default function TasksView({ tasks, careTeam, users, user }) {
  const [editId, setEditId] = useState(undefined)
  const [assignPopupId, setAssignPopupId] = useState(null)
  const [showDone, setShowDone] = useState({})
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

  const sorted = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.updatedAt?.localeCompare(a.updatedAt || '') || 0
  })

  // Build category sections — each has status sub-groups
  const catSections = CATEGORIES.map(cat => {
    const catTasks = sorted.filter(t => (t.category || '') === cat.key)
    const byStatus = {
      todo:         catTasks.filter(t => getStatus(t) === 'todo'),
      'in-progress':catTasks.filter(t => getStatus(t) === 'in-progress'),
      done:         catTasks.filter(t => getStatus(t) === 'done'),
    }
    return { ...cat, catTasks, byStatus }
  })

  // Tasks with no category
  const uncategorized = sorted.filter(t => !t.category)

  async function handleSetAssignee(e, task, uid) {
    e.stopPropagation()
    setAssignPopupId(null)
    const next = uid ? [uid] : []
    try { await updateTaskAssignees(task, next) } catch { alert('Failed to update.') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return
    try { await delTask(id) } catch { alert('Failed to delete.') }
  }

  function renderTask(task) {
    const taskDoctorIds = Array.isArray(task.doctorIds)
      ? task.doctorIds
      : (task.doctorId ? [task.doctorId] : [])
    const doctors = taskDoctorIds.map(id => doctorMap[id]).filter(Boolean)
    const overdue = getStatus(task) !== 'done' && isOverdue(task.dueDate)
    const status = getStatus(task)

    return (
      <li key={task.id} className={`task-row${status === 'done' ? ' task-done' : ''}`} onClick={() => setEditId(task.id)} style={{ cursor: 'pointer' }}>
        <div className="task-body">
          <div className="task-title">{task.title}</div>
          <div className="task-meta">
            {doctors.map(dr => (
              <span key={dr.id} className="task-doctor">👨‍⚕️ {dr.name}</span>
            ))}
            {task.dueDate && (
              <span className={`task-due${overdue ? ' overdue' : ''}`}>
                {overdue ? '⚠ ' : ''}{formatDue(task.dueDate)}
              </span>
            )}
            {(task.comments?.length > 0) && (
              <span className="task-comment-count">💬 {task.comments.length}</span>
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
                            className={`assign-popup-item${assigneeUid === u.uid ? ' active' : ''}`}
                            onClick={e => handleSetAssignee(e, task, u.uid)}
                          >
                            <span className="assign-popup-avatar">{(u.displayName || u.email)[0].toUpperCase()}</span>
                            {(u.displayName || u.email).split(' ')[0]}
                            {assigneeUid === u.uid && <span className="assign-popup-check">✓</span>}
                          </div>
                        ))}
                        <div
                          className={`assign-popup-item assign-popup-none${!assigneeUid ? ' active' : ''}`}
                          onClick={e => handleSetAssignee(e, task, null)}
                        >
                          No one
                          {!assigneeUid && <span className="assign-popup-check">✓</span>}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
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
      <div className="tbl-tools" style={{ marginBottom: 16 }}>
        <div />
        <button className="btn-add" onClick={() => setEditId(null)}>+ Add Task</button>
      </div>

      {tasks.length === 0 ? (
        <div className="task-empty">No tasks yet. Click "+ Add Task" to get started.</div>
      ) : (
        <div className="task-cat-sections">
          {catSections.map(({ key, label, icon, colorClass, catTasks, byStatus }) => (
            catTasks.length === 0 ? null : (
              <div key={key} className="task-cat-section">
                <div className={`task-cat-header task-cat-header-${colorClass}`}>
                  <span className="task-cat-header-icon">{icon}</span>
                  <span className={`task-cat-header-label label-${colorClass}`}>{label}</span>
                  <span className={`task-cat-header-count count-${colorClass}`}>{catTasks.length}</span>
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
                <span className="task-cat-header-count count-none">{uncategorized.length}</span>
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
          onClose={() => setEditId(undefined)}
        />
      )}
    </div>
  )
}
