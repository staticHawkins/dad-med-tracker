import { useState } from 'react'
import { supplyStatus, fmtShortDate } from '../lib/medUtils'
import { aptStatus, fmtAptDateBlock, fmtAptTime } from '../lib/aptUtils'
import DiseaseTimelineCard from './timeline/DiseaseTimelineCard'
import PersonChip from './PersonChip'

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
  return `${fmtShortDate(start)} – ${fmtShortDate(end)}`
}

function getLastWeekRange() {
  const { start } = getWeekRange()  // Monday of current week
  const end = new Date()
  end.setDate(end.getDate() - 1)    // yesterday
  end.setHours(23, 59, 59, 999)
  return { start, end }
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
            Apts
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
          {weekApts.filter(a => (a.person||'dad') === 'mom').length > 0 && (
            <div className="dash-week-breakdown">
              <span style={{color:'var(--dad)'}}>D:{weekApts.filter(a => (a.person||'dad')==='dad').length}</span>
              {' · '}
              <span style={{color:'var(--mom)'}}>M:{weekApts.filter(a => (a.person||'dad')==='mom').length}</span>
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
          {weekTasks.filter(t => (t.person||'dad') === 'mom').length > 0 && (
            <div className="dash-week-breakdown">
              <span style={{color:'var(--dad)'}}>D:{weekTasks.filter(t => (t.person||'dad')==='dad').length}</span>
              {' · '}
              <span style={{color:'var(--mom)'}}>M:{weekTasks.filter(t => (t.person||'dad')==='mom').length}</span>
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
          {[...urgentMeds, ...soonMeds].filter(m => (m.person||'dad') === 'mom').length > 0 && (
            <div className="dash-week-breakdown">
              <span style={{color:'var(--dad)'}}>D:{[...urgentMeds, ...soonMeds].filter(m => (m.person||'dad')==='dad').length}</span>
              {' · '}
              <span style={{color:'var(--mom)'}}>M:{[...urgentMeds, ...soonMeds].filter(m => (m.person||'dad')==='mom').length}</span>
            </div>
          )}
        </button>

      </div>
    </div>
  )
}

// ── Card components ──────────────────────────────────────────────────────────

function MedsCard({ meds, allMeds, onClick }) {
  const urgent = allMeds.filter(m => supplyStatus(m) === 'urgent')
  const soon = allMeds.filter(m => supplyStatus(m) === 'soon')
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
        {allMeds.length === 0 ? (
          <div className="dash-empty"><span className="dash-empty-icon">💊</span><span className="dash-empty-text">No medications added yet</span></div>
        ) : (
          <>
            <div className="dash-med-stats">
              <div className="dash-task-stat">
                <div className="dash-task-num">{allMeds.length}</div>
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
                    <li key={m.id} className="dash-med-row" style={{ borderLeft: `2px solid var(--${m.person || 'dad'})`, paddingLeft: 6 }}>
                      <span className="dash-med-name">{m.name}{m.dose ? ` ${m.dose}` : ''}</span>
                      <PersonChip person={m.person} />
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

function AptsCard({ apts, allApts, onClick }) {
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

  const todayCount = allApts.filter(a => aptStatus(a) === 'today').length
  const weekCount = allApts.filter(a => ['today', 'soon'].includes(aptStatus(a))).length

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
            <div className="dash-apt-block" style={{ borderLeft: `2px solid var(--${nextApt.person || 'dad'})`, paddingLeft: 8 }}>
              <div className="dash-apt-date">
                <span className="dash-apt-month">{dateBlock.month}</span>
                <span className="dash-apt-day">{dateBlock.day}</span>
              </div>
              <div className="dash-apt-info">
                <div className="dash-apt-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {nextApt.title} <PersonChip person={nextApt.person} />
                </div>
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
                      <li key={a.id} className="dash-apt-row" style={{ borderLeft: `2px solid var(--${a.person || 'dad'})`, paddingLeft: 6 }}>
                        <PersonChip person={a.person} />
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

const DASH_CATS = [
  { key: 'medical',  label: 'Medical',  icon: '💊', num: 'blue',  dim: 'var(--blue-dim)',  border: 'var(--blue-border)',  color: 'var(--blue)'  },
  { key: 'house',    label: 'House',    icon: '🏠', num: 'amber', dim: 'var(--amber-dim)', border: 'var(--amber-border)', color: 'var(--amber)' },
  { key: 'finances', label: 'Finances', icon: '💰', num: 'green', dim: 'var(--green-dim)', border: 'var(--green-border)', color: 'var(--green)' },
]

function TasksCard({ tasks, allTasks, onClick }) {
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
        {allTasks.length === 0 ? (
          <div className="dash-empty"><span className="dash-empty-icon">✓</span><span className="dash-empty-text">No tasks yet</span></div>
        ) : (
          <>
            <div className="dash-task-stats dash-cat-stats">
              {DASH_CATS.map(({ key, label, icon, dim, border, color }) => {
                const catActive = allTasks.filter(t => (t.category || '') === key && getTaskStatus(t) !== 'done')
                const activeCt = catActive.length
                const momCt = catActive.filter(t => (t.person||'dad') === 'mom').length
                const dadCt = catActive.length - momCt
                return (
                  <div key={key} className="dash-task-stat" style={{ background: dim, borderColor: border }}>
                    <div className="dash-task-num" style={{ color: activeCt > 0 ? color : 'var(--text3)' }}>{activeCt}</div>
                    <div className="dash-task-lbl">{icon} {label}</div>
                    {momCt > 0 && (
                      <div className="dash-week-breakdown" style={{ marginTop: 2 }}>
                        <span style={{ color: 'var(--dad)' }}>D:{dadCt}</span>
                        {' · '}
                        <span style={{ color: 'var(--mom)' }}>M:{momCt}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {activeTasks.length > 0 && (
              <div className="dash-desktop">
                <ul className="dash-item-list">
                  {activeTasks.map(t => {
                    const ov = isOverdue(t.dueDate)
                    const due = fmtShortDate(t.dueDate)
                    const cat = DASH_CATS.find(c => c.key === t.category)
                    return (
                      <li key={t.id} className="dash-task-row" style={{ borderLeft: `2px solid var(--${t.person || 'dad'})`, paddingLeft: 6 }}>
                        <div className="dash-task-row-main">
                          <PersonChip person={t.person} />
                          <span className="dash-task-row-title">{t.title}</span>
                          {due && (
                            <span className={`dash-task-row-due${ov ? ' due-overdue' : ''}`}>
                              {ov ? `Was due ${due}` : due}
                            </span>
                          )}
                        </div>
                        {cat && (
                          <span className="dash-status-chip" style={{ background: cat.dim, color: cat.color, borderColor: cat.border }}>
                            {cat.icon}
                          </span>
                        )}
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

// ── Files card ───────────────────────────────────────────────────────────────

function aptFileIcon(type = '') {
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📄'
  if (type.includes('word') || type.includes('document')) return '📝'
  return '📎'
}

function FilesCard({ apts, onNavigate }) {
  const recentFiles = apts
    .flatMap(a => (a.files || []).map(f => ({ ...f, aptTitle: a.title, aptId: a.id })))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 6)

  return (
    <button className="dash-card dash-card-files" onClick={() => onNavigate('apts')} aria-label="Go to Appointment Files">
      <div className="dash-card-header">
        <span className="dash-card-icon">📎</span>
        <span className="dash-card-title">Appointment Files</span>
        <span className="dash-card-arrow">›</span>
      </div>
      <div className="dash-card-body">
        {recentFiles.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-icon">📎</span>
            <span className="dash-empty-text">No files uploaded yet</span>
          </div>
        ) : (
          <ul className="dash-file-list">
            {recentFiles.map(f => (
              <li key={f.uploadedAt + f.name} className="dash-file-row">
                <span className="dash-file-icon">{aptFileIcon(f.type)}</span>
                <div className="dash-file-info">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dash-file-name"
                    onClick={e => e.stopPropagation()}
                  >
                    {f.name}
                  </a>
                  <span className="dash-file-apt">{f.aptTitle}</span>
                </div>
                <span className="dash-file-date">{fmtShortDate(f.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </button>
  )
}

// ── Last Week in Review ──────────────────────────────────────────────────────

function LastWeekReview({ meds, apts, tasks, onNavigate }) {
  const [open, setOpen] = useState(new Date().getDay() === 0)

  const { start, end } = getLastWeekRange()
  const startStr = start.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)

  const lastApts = [...apts]
    .filter(a => { const d = new Date(a.dateTime); return d >= start && d <= end })
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))

  const doneTasks = tasks.filter(t => {
    if (getTaskStatus(t) !== 'done') return false
    if (!t.updatedAt) return false
    const d = new Date(t.updatedAt)
    return d >= start && d <= end
  })

  const missedTasks = tasks.filter(t => {
    if (getTaskStatus(t) === 'done') return false
    if (!t.dueDate) return false
    const [y, m, d] = t.dueDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= start && new Date(y, m - 1, d) <= end
  })

  const refilledMeds = meds.filter(m => {
    const fills = m.fills || []
    if (fills.some(f => f.filledDate >= startStr && f.filledDate <= endStr)) return true
    return !!(m.filledDate && m.filledDate >= startStr && m.filledDate <= endStr)
  })

  const hasAny = lastApts.length > 0 || doneTasks.length > 0 || missedTasks.length > 0 || refilledMeds.length > 0

  return (
    <div className="dash-lastweek-wrap">
      <button className="dash-lastweek-toggle" onClick={() => setOpen(o => !o)}>
        <span className="dash-lastweek-label">↩ Week in Review</span>
        <span className="dash-week-range">{fmtWeekRange(start, end)}</span>
        <span className={`dash-lastweek-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      {open && (
        <div className="dash-lastweek-body">
          {!hasAny ? (
            <div className="dash-lastweek-empty">Nothing recorded for last week</div>
          ) : (
            <div className="dash-lastweek-grid">

              <div className="dash-lastweek-section">
                <button className="dash-lastweek-sec-head" style={{ color: 'var(--amber)' }} onClick={() => onNavigate('apts')}>
                  <span className="dash-week-dot" style={{ background: 'var(--amber)' }} />
                  Appointments
                  <span className="dash-lastweek-count">{lastApts.length}</span>
                  <span className="dash-lastweek-sec-arrow">›</span>
                </button>
                {lastApts.length === 0 ? (
                  <div className="dash-lastweek-none">None</div>
                ) : (
                  <ul className="dash-lastweek-list">
                    {lastApts.map(a => {
                      const d = new Date(a.dateTime)
                      return (
                        <li key={a.id}>
                          <button className="dash-lastweek-item" style={{ borderLeft: `2px solid var(--${a.person || 'dad'})`, paddingLeft: 6 }} onClick={() => onNavigate('apts')}>
                            <PersonChip person={a.person} />
                            <span className="dash-lastweek-item-title">{a.title}{a.doctor ? ` · ${a.doctor}` : ''}</span>
                            <span className="dash-lastweek-item-meta">{DAY_ABBR[d.getDay()]} {fmtShortDate(d)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="dash-lastweek-section">
                <button className="dash-lastweek-sec-head" style={{ color: 'var(--violet)' }} onClick={() => onNavigate('tasks')}>
                  <span className="dash-week-dot" style={{ background: 'var(--violet)' }} />
                  Tasks
                  {doneTasks.length > 0 && <span className="dash-lastweek-count">{doneTasks.length} done</span>}
                  {missedTasks.length > 0 && <span className="dash-lastweek-count dash-lastweek-count-missed">{missedTasks.length} missed</span>}
                  {doneTasks.length === 0 && missedTasks.length === 0 && <span className="dash-lastweek-count">0</span>}
                  <span className="dash-lastweek-sec-arrow">›</span>
                </button>
                {doneTasks.length === 0 && missedTasks.length === 0 ? (
                  <div className="dash-lastweek-none">None due</div>
                ) : (
                  <ul className="dash-lastweek-list">
                    {doneTasks.map(t => (
                      <li key={t.id}>
                        <button className="dash-lastweek-item" style={{ borderLeft: `2px solid var(--${t.person || 'dad'})`, paddingLeft: 6 }} onClick={() => onNavigate('tasks')}>
                          <PersonChip person={t.person} />
                          <span className="dash-lastweek-item-title">{t.title}</span>
                          <span className="dash-status-chip dash-chip-done">done</span>
                        </button>
                      </li>
                    ))}
                    {missedTasks.map(t => (
                      <li key={t.id}>
                        <button className="dash-lastweek-item" style={{ borderLeft: `2px solid var(--${t.person || 'dad'})`, paddingLeft: 6 }} onClick={() => onNavigate('tasks')}>
                          <PersonChip person={t.person} />
                          <span className="dash-lastweek-item-title">{t.title}</span>
                          <span className="dash-status-chip dash-chip-urgent">missed</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="dash-lastweek-section">
                <button className="dash-lastweek-sec-head" style={{ color: 'var(--blue)' }} onClick={() => onNavigate('meds')}>
                  <span className="dash-week-dot" style={{ background: 'var(--blue)' }} />
                  Refills
                  <span className="dash-lastweek-count">{refilledMeds.length}</span>
                  <span className="dash-lastweek-sec-arrow">›</span>
                </button>
                {refilledMeds.length === 0 ? (
                  <div className="dash-lastweek-none">None</div>
                ) : (
                  <ul className="dash-lastweek-list">
                    {refilledMeds.map(m => {
                      const fills = m.fills || []
                      const fillEntry = fills.find(f => f.filledDate >= startStr && f.filledDate <= endStr)
                      const filledOn = fillEntry ? fillEntry.filledDate : m.filledDate
                      return (
                        <li key={m.id}>
                          <button className="dash-lastweek-item" style={{ borderLeft: `2px solid var(--${m.person || 'dad'})`, paddingLeft: 6 }} onClick={() => onNavigate('meds')}>
                            <PersonChip person={m.person} />
                            <span className="dash-lastweek-item-title">{m.name}{m.dose ? ` ${m.dose}` : ''}</span>
                            {filledOn && <span className="dash-lastweek-item-meta">{fmtShortDate(filledOn)}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
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

function HospitalStayBanner({ stay, onNavigate }) {
  const start = new Date(stay.admissionDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const day = Math.max(1, Math.round((now - start) / 86400000) + 1)
  return (
    <div className="hospital-dash-banner" role="status">
      <span className="hospital-dash-banner-icon">🏥</span>
      <span className="hospital-dash-banner-text">
        Day {day} · {stay.hospital || 'Hospital'}
        {stay.department ? ` · ${stay.department}` : ''}
      </span>
      <button className="hospital-dash-banner-link" onClick={() => onNavigate('hospital')}>
        View stay →
      </button>
    </div>
  )
}

export default function DashboardView({ meds, filteredMeds, apts, filteredApts, tasks, filteredTasks, milestones, phases, activeStay, onNavigate }) {
  return (
    <div className="page dashboard-page">
      {activeStay && <HospitalStayBanner stay={activeStay} onNavigate={onNavigate} />}
      <div className="dashboard-grid">
        <div className="dash-card-week-wrap">
          <WeekCard meds={meds} apts={apts} tasks={tasks} onNavigate={onNavigate} />
        </div>
        <LastWeekReview meds={meds} apts={apts} tasks={tasks} onNavigate={onNavigate} />
        <MedsCard meds={filteredMeds} allMeds={meds} onClick={() => onNavigate('meds')} />
        <AptsCard apts={filteredApts} allApts={apts} onClick={() => onNavigate('apts')} />
        <TasksCard tasks={filteredTasks} allTasks={tasks} onClick={() => onNavigate('tasks')} />
        <FilesCard apts={apts} onNavigate={onNavigate} />
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
