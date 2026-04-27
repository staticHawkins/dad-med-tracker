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

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekRange() {
  const now = new Date()
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function fmtWeekRange(start, end) {
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

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

// ── This Week card ───────────────────────────────────────────────────────────

function WeekCard({ meds, apts, tasks, onNavigate }) {
  const { start, end } = getWeekRange()

  const weekApts = [...apts]
    .filter(a => { const d = new Date(a.dateTime); return d >= start && d <= end })
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))

  const weekTasks = tasks.filter(t => {
    if (getTaskStatus(t) === 'done') return false
    if (!t.dueDate) return false
    const [y, m, d] = t.dueDate.split('-').map(Number)
    return new Date(y, m - 1, d) <= end
  })
  const overdueTasksCt = weekTasks.filter(t => isOverdue(t.dueDate)).length
  const inProgTasksCt  = weekTasks.filter(t => !isOverdue(t.dueDate) && getTaskStatus(t) === 'in-progress').length
  const todoTasksCt    = weekTasks.filter(t => !isOverdue(t.dueDate) && getTaskStatus(t) === 'todo').length

  const urgentMeds = meds.filter(m => supplyStatus(m) === 'urgent')
  const soonMeds   = meds.filter(m => supplyStatus(m) === 'soon')
  const weekMeds   = urgentMeds.length + soonMeds.length

  const aptChips = weekApts.slice(0, 3).map(a => {
    const d = new Date(a.dateTime)
    return `${DAY_ABBR[d.getDay()]} ${d.getDate()}`
  })

  return (
    <div className="dash-card dash-card-week">
      <div className="dash-card-header">
        <span className="dash-card-icon">🗓</span>
        <span className="dash-card-title">This Week</span>
        <span className="dash-week-range">{fmtWeekRange(start, end)}</span>
      </div>
      <div className="dash-week-body">

        <button className="dash-week-section" onClick={() => onNavigate('apts')} aria-label="This week: appointments">
          <div className="dash-week-sec-label" style={{color:'var(--amber)'}}>
            <span className="dash-week-dot" style={{background:'var(--amber)'}} />
            Appointments
          </div>
          <div className={`dash-week-num${weekApts.length === 0 ? ' dash-week-num-zero' : ''}`}
               style={weekApts.length > 0 ? {color:'var(--amber)'} : undefined}>
            {weekApts.length}
          </div>
          <div className={`dash-week-sub${weekApts.length === 0 ? ' dash-week-sub-zero' : ''}`}>
            {weekApts.length === 0 ? 'nothing scheduled' : 'this week'}
          </div>
          {aptChips.length > 0 && (
            <div className="dash-week-chips">
              {aptChips.map(c => <span key={c} className="dash-status-chip dash-chip-soon">{c}</span>)}
              {weekApts.length > 3 && <span className="dash-status-chip dash-chip-todo">+{weekApts.length - 3} more</span>}
            </div>
          )}
        </button>

        <button className="dash-week-section" onClick={() => onNavigate('tasks')} aria-label="This week: tasks">
          <div className="dash-week-sec-label" style={{color:'var(--violet)'}}>
            <span className="dash-week-dot" style={{background:'var(--violet)'}} />
            Tasks Due
          </div>
          <div className={`dash-week-num${weekTasks.length === 0 ? ' dash-week-num-zero' : ''}`}
               style={weekTasks.length > 0 ? {color:'var(--violet)'} : undefined}>
            {weekTasks.length}
          </div>
          <div className={`dash-week-sub${weekTasks.length === 0 ? ' dash-week-sub-zero' : ''}`}>
            {weekTasks.length === 0 ? 'all caught up' : 'due this week'}
          </div>
          {weekTasks.length > 0 && (
            <div className="dash-week-chips">
              {overdueTasksCt > 0 && <span className="dash-status-chip dash-chip-urgent">{overdueTasksCt} overdue</span>}
              {inProgTasksCt  > 0 && <span className="dash-status-chip dash-chip-inprog">{inProgTasksCt} in progress</span>}
              {todoTasksCt    > 0 && <span className="dash-status-chip dash-chip-todo">{todoTasksCt} to do</span>}
            </div>
          )}
        </button>

        <button className="dash-week-section" onClick={() => onNavigate('meds')} aria-label="This week: medications">
          <div className="dash-week-sec-label" style={{color:'var(--blue)'}}>
            <span className="dash-week-dot" style={{background:'var(--blue)'}} />
            Refills
          </div>
          <div className={`dash-week-num${weekMeds === 0 ? ' dash-week-num-zero' : ''}`}
               style={weekMeds === 0 ? undefined : {color: urgentMeds.length > 0 ? 'var(--red)' : 'var(--blue)'}}>
            {weekMeds}
          </div>
          <div className={`dash-week-sub${weekMeds === 0 ? ' dash-week-sub-zero' : ''}`}>
            {weekMeds === 0 ? 'supply looks good' : 'need attention'}
          </div>
          {weekMeds > 0 && (
            <div className="dash-week-chips">
              {urgentMeds.length > 0 && <span className="dash-status-chip dash-chip-urgent">{urgentMeds.length} urgent</span>}
              {soonMeds.length   > 0 && <span className="dash-status-chip dash-chip-soon">{soonMeds.length} soon</span>}
            </div>
          )}
        </button>

      </div>
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
          <div className="dash-empty"><span className="dash-empty-icon">💊</span><span className="dash-empty-text">No medications added yet</span></div>
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
          <div className="dash-empty"><span className="dash-empty-icon">📅</span><span className="dash-empty-text">No upcoming appointments</span></div>
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
          <div className="dash-empty"><span className="dash-empty-icon">✓</span><span className="dash-empty-text">No tasks yet</span></div>
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

// ── Exports ──────────────────────────────────────────────────────────────────

export function BackBar({ label, onBack }) {
  return (
    <div className="back-bar">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>
      <span className="back-bar-title">{label}</span>
    </div>
  )
}

export default function DashboardView({ meds, apts, tasks, milestones, phases, onNavigate }) {
  return (
    <div className="page dashboard-page">
      <SummaryBar meds={meds} apts={apts} tasks={tasks} />
      <div className="dashboard-grid">
        <div className="dash-card-week-wrap">
          <WeekCard meds={meds} apts={apts} tasks={tasks} onNavigate={onNavigate} />
        </div>
        <MedsCard meds={meds} onClick={() => onNavigate('meds')} />
        <AptsCard apts={apts} onClick={() => onNavigate('apts')} />
        <TasksCard tasks={tasks} onClick={() => onNavigate('tasks')} />
        <div className="dash-card-timeline-wrap">
          <DiseaseTimelineCard
            milestones={milestones}
            phases={phases}
            onViewTimeline={() => onNavigate('timeline')}
          />
        </div>
      </div>
    </div>
  )
}
