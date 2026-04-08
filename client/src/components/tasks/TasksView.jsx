import { useState } from 'react'
import { toggleTask, delTask } from '../../lib/firestore'
import TaskModal from './TaskModal'

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

  const doctorMap = Object.fromEntries(careTeam.map(dr => [dr.id, dr]))
  const userMap = Object.fromEntries(users.map(u => [u.uid, u]))

  const filtered = tasks.filter(t => {
    if (filter === 'mine') return t.assigneeUids?.includes(user.uid)
    if (filter === 'open') return !t.done
    if (filter === 'done') return t.done
    return true
  }).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.updatedAt?.localeCompare(a.updatedAt || '') || 0
  })

  async function handleToggle(task) {
    try { await toggleTask(task) } catch { alert('Failed to update.') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return
    try { await delTask(id) } catch { alert('Failed to delete.') }
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'open', label: 'Open' },
    { key: 'done', label: 'Done' },
  ]

  return (
    <div className="view-wrap">
      <div className="tbl-tools" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
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

      {filtered.length === 0 ? (
        <div className="task-empty">
          {filter === 'mine' ? 'No tasks assigned to you.' : filter === 'done' ? 'No completed tasks.' : filter === 'open' ? 'No open tasks. All done!' : 'No tasks yet. Click "+ Add Task" to get started.'}
        </div>
      ) : (
        <ul className="task-list">
          {filtered.map(task => {
            const taskDoctorIds = Array.isArray(task.doctorIds)
              ? task.doctorIds
              : (task.doctorId ? [task.doctorId] : [])
            const doctors = taskDoctorIds.map(id => doctorMap[id]).filter(Boolean)
            const assignees = (task.assigneeUids || []).map(uid => userMap[uid]?.displayName || userMap[uid]?.email).filter(Boolean)
            const overdue = !task.done && isOverdue(task.dueDate)

            return (
              <li key={task.id} className={`task-row${task.done ? ' task-done' : ''}`}>
                <button
                  className="task-check"
                  onClick={() => handleToggle(task)}
                  title={task.done ? 'Mark open' : 'Mark done'}
                >
                  {task.done ? '✓' : ''}
                </button>
                <div className="task-body">
                  <div className="task-title">{task.title}</div>
                  {task.description && <div className="task-desc">{task.description}</div>}
                  <div className="task-meta">
                    {assignees.length > 0 && assignees.map((name, i) => (
                      <span key={i} className={`covering-pill ${name.toLowerCase()}`}>{name}</span>
                    ))}
                    {doctors.map(dr => (
                      <span key={dr.id} className="task-doctor">👨‍⚕️ {dr.name}</span>
                    ))}
                    {task.dueDate && (
                      <span className={`task-due${overdue ? ' overdue' : ''}`}>
                        {overdue ? '⚠ ' : ''}{formatDue(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="task-actions">
                  <button className="btn-ghost" title="Edit" onClick={() => setEditId(task.id)}>✏</button>
                  <button className="btn-ghost" title="Delete" onClick={() => handleDelete(task.id)}>✕</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editId !== undefined && (
        <TaskModal
          tasks={tasks}
          careTeam={careTeam}
          users={users}
          editId={editId}
          onClose={() => setEditId(undefined)}
        />
      )}
    </div>
  )
}
