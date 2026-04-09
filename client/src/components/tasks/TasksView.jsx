import { useState, useEffect, useRef } from 'react'
import { updateTaskAssignees, delTask } from '../../lib/firestore'
import TaskModal from './TaskModal'

const STATUSES = ['todo', 'in-progress', 'done']
const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }
const STATUS_CLASSES = { todo: 'status-todo', 'in-progress': 'status-inprog', done: 'status-done' }

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
  const [filter, setFilter] = useState('all')
  const [editId, setEditId] = useState(undefined)
  const [assignPopupId, setAssignPopupId] = useState(null)
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

  const filtered = tasks.filter(t => {
    if (filter === 'mine') return t.assigneeUids?.includes(user.uid)
    return true
  }).sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.updatedAt?.localeCompare(a.updatedAt || '') || 0
  })

  // Group by status
  const visibleStatuses = filter === 'all' || filter === 'mine'
    ? STATUSES
    : [filter]

  const groups = visibleStatuses.map(status => ({
    status,
    label: STATUS_LABELS[status],
    tasks: filtered.filter(t => getStatus(t) === status)
  }))

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

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'todo', label: 'To Do' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'done', label: 'Done' },
  ]


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

  const hasAny = filtered.length > 0

  return (
    <div className="page">
      <div className="tbl-tools" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              className={`ftab${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn-add" onClick={() => setEditId(null)}>+ Add Task</button>
      </div>

      {!hasAny ? (
        <div className="task-empty">
          {filter === 'mine' ? 'No tasks assigned to you.'
            : filter === 'done' ? 'No completed tasks.'
            : filter === 'todo' ? 'No to-do tasks.'
            : filter === 'in-progress' ? 'No tasks in progress.'
            : 'No tasks yet. Click "+ Add Task" to get started.'}
        </div>
      ) : (
        <div className="task-groups">
          {groups.map(g => (
            <div key={g.status} className="task-group">
              <div className="task-group-header">
                <span className={`task-status-badge ${STATUS_CLASSES[g.status]}`}>{g.label}</span>
                <span className="task-group-count">{g.tasks.length}</span>
              </div>
              {g.tasks.length > 0 && (
                <ul className="task-list">
                  {g.tasks.map(renderTask)}
                </ul>
              )}
            </div>
          ))}
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
