import { supplyStatus } from '../lib/medUtils'
import { aptStatus, fmtAptDateBlock, fmtAptTime } from '../lib/aptUtils'
import DiseaseTimelineCard from './timeline/DiseaseTimelineCard'

function getTaskStatus(task) {
  return task.status || (task.done ? 'done' : 'todo')
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d) < today
}

function fmtShortDate(dueDate) {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['blue', 'violet', 'teal', 'amber', 'green']

// ── Summary alert bar (desktop only) ────────────────────────────────────────

function SummaryBar({ meds, apts, tasks }) {
  const urgentMed = meds.find(m => supplyStatus(m) === 'urgent')
  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const nextApt = sorted.find(a => aptStatus(a) !== 'past')
  const overdueCt = tasks.filter(t => getTaskStatus(t) !== 'done' && isOverdue(t.dueDate)).length

  if (!urgentMed && !nextApt && overdueCt === 0) return null

  let aptLabel = null
  if (nextApt) {
    const db = fmtAptDateBlock(nextApt.dateTime)
    const t = fmtAptTime(nextApt.dateTime)
    aptLabel = `${db.month} ${db.day}${t ? ` · ${t}` : ''}`
  }

  return (
    <div className="dash-summary-bar">
      {urgentMed && (
        <div className="dash-pill dash-pill-red">
          <span className="dash-pill-icon">+</span>
          <div className="dash-pill-text">
            <span className="dash-pill-label">Urgent medication</span>
            <span className="dash-pill-value">{urgentMed.name} — refill due</span>
          </div>
        </div>
      )}
      {nextApt && (
        <div className="dash-pill dash-pill-amber">
          <span className="dash-pill-icon">📅</span>
          <div className="dash-pill-text">
            <span className="dash-pill-label">Next appointment</span>
            <span className="dash-pill-value">{aptLabel}</span>
          </div>
        </div>
      )}
      {overdueCt > 0 && (
        <div className="dash-pill dash-pill-violet">
          <span className="dash-pill-icon">✓</span>
          <div className="dash-pill-text">
            <span className="dash-pill-label">Overdue task</span>
            <span className="dash-pill-value">{overdueCt} needs attention</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card components ──────────────────────────────────────────────────────────

function MedsCard({ meds, onClick }) {
  const urgent = meds.filter(m => supplyStatus(m) === 'urgent')
  const soon = meds.filter(m => supplyStatus(m) === 'soon')
  const shownPills = urgent.slice(0, 2)
  const extraPills = urgent.length - shownPills.length

  const statusOrder = { urgent: 0, soon: 1, ok: 2 }
  const sortedMeds = [...meds].sort((a, b) => statusOrder[supplyStatus(a)] - statusOrder[supplyStatus(b)])
  const listMeds = sortedMeds.slice(0, 6)
  const listExtra = sortedMeds.length - listMeds.length

  return (
    <button className="dash-card dash-card-meds" onClick={onClick} aria-label="Go to Medications">
      <div className="dash-card-header">
        <span className="dash-card-icon">💊</span>
        <span className="dash-card-title">Medications</span>
        <span className="dash-card-arrow">›</span>
      </div>
      <div className="dash-card-body">
        {meds.length === 0 ? (
          <p className="dash-empty">No medications added</p>
        ) : (
          <>
            <div className="dash-med-stats">
              <div className="dash-task-stat">
                <div className="dash-task-num">{meds.length}</div>
                <div className="dash-task-lbl">Total</div>
              </div>
              <div className="dash-task-stat">
                <div className={`dash-task-num${urgent.length > 0 ? ' overdue-num' : ''}`}>{urgent.length}</div>
                <div className="dash-task-lbl">Urgent</div>
              </div>
              <div className="dash-task-stat">
                <div className={`dash-task-num${soon.length > 0 ? ' soon-num' : ''}`}>{soon.length}</div>
                <div className="dash-task-lbl">Soon</div>
              </div>
            </div>
            {shownPills.length > 0 && (
              <ul className="dash-urgent-list">
                {shownPills.map(m => (
                  <li key={m.id} className="dash-urgent-pill">
                    <span className="dash-urgent-dot" />
                    {m.name} needs attention
                  </li>
                ))}
                {extraPills > 0 && <li><span className="dash-more-label">+{extraPills} more</span></li>}
              </ul>
            )}
            <div className="dash-desktop">
              <div className="dash-section-label">All Medications</div>
              <ul className="dash-item-list">
                {listMeds.map(m => {
                  const s = supplyStatus(m)
                  return (
                    <li key={m.id} className="dash-med-row">
                      <span className="dash-med-name">{m.name}{m.dose ? ` ${m.dose}` : ''}</span>
                      {s !== 'ok' && (
                        <span className={`dash-status-chip dash-chip-${s}`}>
                          {s}
                        </span>
                      )}
                    </li>
                  )
                })}
                {listExtra > 0 && <li className="dash-list-more">+{listExtra} more</li>}
              </ul>
            </div>
          </>
        )}
      </div>
    </button>
  )
}

function AptsCard({ apts, onClick }) {
  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const upcoming = sorted.filter(a => aptStatus(a) !== 'past')
  const nextApt = upcoming[0] || null
  const comingUp = upcoming.slice(1, 5)

  let dateBlock = null
  let aptTime = null
  if (nextApt) {
    dateBlock = fmtAptDateBlock(nextApt.dateTime)
    aptTime = fmtAptTime(nextApt.dateTime)
  }

  const todayCount = apts.filter(a => aptStatus(a) === 'today').length
  const weekCount = apts.filter(a => ['today', 'soon'].includes(aptStatus(a))).length

  return (
    <button className="dash-card dash-card-apts" onClick={onClick} aria-label="Go to Appointments">
      <div className="dash-card-header">
        <span className="dash-card-icon">📅</span>
        <span className="dash-card-title">Appointments</span>
        <span className="dash-card-arrow">›</span>
      </div>
      <div className="dash-card-body">
        {!nextApt ? (
          <p className="dash-empty">No upcoming appointments</p>
        ) : (
          <>
            <div className="dash-apt-block">
              <div className="dash-apt-date">
                <span className="dash-apt-month">{dateBlock.month}</span>
                <span className="dash-apt-day">{dateBlock.day}</span>
              </div>
              <div className="dash-apt-info">
                <div className="dash-apt-title">{nextApt.title}</div>
                <div className="dash-apt-meta">
                  {nextApt.doctor && <span>{nextApt.doctor}</span>}
                  {aptTime && <span>{aptTime}</span>}
                  {nextApt.location && <span>{nextApt.location}</span>}
                </div>
              </div>
            </div>
            {(todayCount > 0 || weekCount > 0) && (
              <div className="dash-apt-sub">
                {todayCount > 0 && <span>{todayCount} today</span>}
                {todayCount > 0 && weekCount > todayCount && <span> · </span>}
                {weekCount > 0 && <span>{weekCount} this week</span>}
              </div>
            )}
            {comingUp.length > 0 && (
              <div className="dash-desktop">
                <div className="dash-section-label">Coming Up</div>
                <ul className="dash-item-list">
                  {comingUp.map(a => {
                    const db = fmtAptDateBlock(a.dateTime)
                    return (
                      <li key={a.id} className="dash-apt-row">
                        <span className="dash-apt-row-name">{a.title}{a.doctor ? ` · ${a.doctor}` : ''}</span>
                        <span className="dash-apt-row-date">{db.month} {db.day}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </button>
  )
}

function TasksCard({ tasks, onClick }) {
  const todoCt = tasks.filter(t => getTaskStatus(t) === 'todo').length
  const inProgCt = tasks.filter(t => getTaskStatus(t) === 'in-progress').length
  const doneCt = tasks.filter(t => getTaskStatus(t) === 'done').length
  const overdueCt = tasks.filter(t => getTaskStatus(t) !== 'done' && isOverdue(t.dueDate)).length

  const activeTasks = tasks
    .filter(t => getTaskStatus(t) !== 'done')
    .sort((a, b) => {
      const aOv = isOverdue(a.dueDate) ? 0 : 1
      const bOv = isOverdue(b.dueDate) ? 0 : 1
      return aOv - bOv
    })
    .slice(0, 4)

  return (
    <button className="dash-card dash-card-tasks" onClick={onClick} aria-label="Go to Tasks">
      <div className="dash-card-header">
        <span className="dash-card-icon">✓</span>
        <span className="dash-card-title">Tasks</span>
        <span className="dash-card-arrow">›</span>
      </div>
      <div className="dash-card-body">
        {tasks.length === 0 ? (
          <p className="dash-empty">No tasks yet</p>
        ) : (
          <>
            <div className="dash-task-stats">
              <div className="dash-task-stat">
                <div className="dash-task-num">{todoCt}</div>
                <div className="dash-task-lbl">To Do</div>
              </div>
              <div className="dash-task-stat">
                <div className="dash-task-num">{inProgCt}</div>
                <div className="dash-task-lbl">In Progress</div>
              </div>
              <div className="dash-task-stat">
                <div className="dash-task-num">{doneCt}</div>
                <div className="dash-task-lbl">Done</div>
              </div>
              <div className="dash-task-stat">
                <div className={`dash-task-num${overdueCt > 0 ? ' overdue-num' : ''}`}>{overdueCt}</div>
                <div className="dash-task-lbl">Overdue</div>
              </div>
            </div>
            {activeTasks.length > 0 && (
              <div className="dash-desktop">
                <ul className="dash-item-list">
                  {activeTasks.map(t => {
                    const ov = isOverdue(t.dueDate)
                    const s = getTaskStatus(t)
                    const due = fmtShortDate(t.dueDate)
                    return (
                      <li key={t.id} className="dash-task-row">
                        <div className="dash-task-row-main">
                          <span className="dash-task-row-title">{t.title}</span>
                          {due && (
                            <span className={`dash-task-row-due${ov ? ' due-overdue' : ''}`}>
                              {ov ? `Was due ${due}` : due}
                            </span>
                          )}
                        </div>
                        <span className={`dash-status-chip dash-chip-${ov ? 'urgent' : s === 'in-progress' ? 'inprog' : 'todo'}`}>
                          {ov ? 'Overdue' : s === 'in-progress' ? 'In progress' : 'To do'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </button>
  )
}

function CareCard({ careTeam, onClick }) {
  const shownList = careTeam.slice(0, 4)
  const extra = careTeam.length - shownList.length

  return (
    <button className="dash-card dash-card-care" onClick={onClick} aria-label="Go to Care Team">
      <div className="dash-card-header">
        <span className="dash-card-icon">👥</span>
        <span className="dash-card-title">Care Team</span>
        <span className="dash-card-arrow">›</span>
      </div>
      <div className="dash-card-body">
        {careTeam.length === 0 ? (
          <p className="dash-empty">No doctors added yet</p>
        ) : (
          <>
            <div className="dash-stat-row">
              <div className="dash-stat">
                <span className="dash-stat-num stat-teal">{careTeam.length}</span>
                <span className="dash-stat-lbl">specialists coordinated</span>
              </div>
            </div>
            {/* Mobile: dot list */}
            <ul className="dash-dr-list dash-mobile-only">
              {shownList.map(d => (
                <li key={d.id} className="dash-dr-item">
                  <span className="dash-dr-dot" />
                  {d.name}{d.specialty ? ` · ${d.specialty}` : ''}
                </li>
              ))}
              {extra > 0 && <li><span className="dash-more-label">+{extra} more</span></li>}
            </ul>
            {/* Desktop: avatar grid */}
            <div className="dash-desktop">
              <div className="dash-avatar-grid">
                {shownList.map((d, i) => (
                  <div key={d.id} className="dash-avatar-item">
                    {d.imageUrl ? (
                      <img
                        className={`dash-avatar-circle dash-avatar-img`}
                        src={d.imageUrl}
                        alt={d.name}
                      />
                    ) : (
                      <div className={`dash-avatar-circle dash-avatar-${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {initials(d.name)}
                      </div>
                    )}
                    <div className="dash-avatar-info">
                      <span className="dash-avatar-name">{d.name}</span>
                      {d.specialty && <span className="dash-avatar-spec">{d.specialty}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {extra > 0 && <div className="dash-care-more">+ {extra} more specialists</div>}
            </div>
          </>
        )}
      </div>
    </button>
  )
}

// ── Exports ──────────────────────────────────────────────────────────────────

export function BackBar({ label, onBack }) {
  return (
    <div className="back-bar">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>
      <span className="back-bar-title">{label}</span>
    </div>
  )
}

export default function DashboardView({ meds, apts, tasks, careTeam, milestones, phases, onNavigate }) {
  return (
    <div className="page dashboard-page">
      <SummaryBar meds={meds} apts={apts} tasks={tasks} />
      <div className="dashboard-grid">
        <div className="dash-card-timeline-wrap">
          <DiseaseTimelineCard
            milestones={milestones}
            phases={phases}
            onViewTimeline={() => onNavigate('timeline')}
          />
        </div>
        <MedsCard meds={meds} onClick={() => onNavigate('meds')} />
        <AptsCard apts={apts} onClick={() => onNavigate('apts')} />
        <TasksCard tasks={tasks} onClick={() => onNavigate('tasks')} />
      </div>
    </div>
  )
}
