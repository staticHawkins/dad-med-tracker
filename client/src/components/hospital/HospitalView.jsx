import { useState } from 'react'
import { todayStr } from '../../lib/medUtils'
import HospitalStayModal from './HospitalStayModal'
import DailyLogModal from './DailyLogModal'
import PersonChip from '../PersonChip'

function dayCount(admissionDate) {
  const start = new Date(admissionDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((now - start) / 86400000) + 1)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(ts) {
  if (!ts || !ts.includes('T')) return ts || ''
  const [, time] = ts.split('T')
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${mStr} ${ampm}`
}

function getDaySlots(admissionDate) {
  const slots = []
  const start = new Date(admissionDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let d = new Date(today); d >= start; d.setDate(d.getDate() - 1)) {
    slots.push(d.toISOString().slice(0, 10))
  }
  return slots
}

function groupMedLogs(medLogs) {
  const groups = {}
  for (const m of medLogs) {
    if (!groups[m.date]) groups[m.date] = []
    groups[m.date].push(m)
  }
  for (const date of Object.keys(groups)) {
    groups[date].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function DaySlot({ dateStr, log, onClick, admissionDate }) {
  const isToday = dateStr === todayStr()
  const hasLog = !!log
  const dayNum = admissionDate
    ? Math.round((new Date(dateStr + 'T00:00:00') - new Date(admissionDate + 'T00:00:00')) / 86400000) + 1
    : null

  return (
    <button
      className={`day-slot${hasLog ? ' day-slot-filled' : ' day-slot-empty'}`}
      onClick={() => onClick(dateStr, log)}
    >
      <div className="day-slot-header">
        <span className="day-slot-label">
          {isToday ? 'Today' : fmtDate(dateStr)}
          {dayNum !== null && <span className="day-slot-day-num"> · Day {dayNum}</span>}
        </span>
        <span className="day-slot-action">
          {hasLog ? 'Edit ›' : '+ Add notes'}
        </span>
      </div>
      {hasLog && (
        <div className="day-slot-content">
          {log.notes && <div className="day-slot-notes">{log.notes}</div>}
          {log.careTeam && (
            <div className="day-slot-careteam">
              <span className="day-slot-careteam-label">Care team</span> {log.careTeam}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function ActiveStaySection({ stay, onEdit, onDayClick }) {
  const day = dayCount(stay.admissionDate)
  const slots = getDaySlots(stay.admissionDate)
  const logsByDate = Object.fromEntries((stay.dailyLogs || []).map(l => [l.date, l]))

  return (
    <div className="hospital-active-stay">
      <div className="hospital-stay-header">
        <div className="hospital-stay-header-left">
          <PersonChip person={stay.person} />
          <div>
            <div className="hospital-stay-title">
              Day {day} · {stay.hospital || 'Hospital'}
            </div>
            <div className="hospital-stay-meta">
              Admitted {fmtDate(stay.admissionDate)}
              {stay.department ? ` · ${stay.department}` : ''}
            </div>
            {stay.reason && <div className="hospital-stay-reason">{stay.reason}</div>}
          </div>
        </div>
        <button className="btn-ghost hospital-stay-edit-btn" onClick={onEdit}>Edit stay</button>
      </div>

      <div className="daily-logs-list">
        {slots.map(dateStr => (
          <DaySlot
            key={dateStr}
            dateStr={dateStr}
            log={logsByDate[dateStr] || null}
            onClick={onDayClick}
            admissionDate={stay.admissionDate}
          />
        ))}
      </div>
    </div>
  )
}

function MedLogList({ medLogs }) {
  const grouped = groupMedLogs(medLogs)
  if (grouped.length === 0) return (
    <div className="hospital-medlog-empty">No medications logged yet.</div>
  )
  return grouped.map(([date, meds]) => (
    <div key={date} className="hospital-medlog-group">
      <div className="hospital-medlog-date">{fmtDate(date)}</div>
      {meds.map(m => (
        <div key={m.id} className="hospital-medlog-row">
          <span className="hospital-medlog-time">{fmtTime(m.timestamp)}</span>
          <span className="hospital-medlog-name">{m.name}</span>
        </div>
      ))}
    </div>
  ))
}

function MobileMedSection({ medLogs }) {
  const [open, setOpen] = useState(false)
  if (!medLogs.length) return null
  return (
    <div className="hospital-mobile-meds">
      <button className="hospital-mobile-meds-toggle" onClick={() => setOpen(o => !o)}>
        <span>Medications this stay</span>
        <span className="hospital-mobile-meds-count">{medLogs.length}</span>
        <span className={`past-stay-chevron${open ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>›</span>
      </button>
      {open && (
        <div className="hospital-mobile-meds-body">
          <MedLogList medLogs={medLogs} />
        </div>
      )}
    </div>
  )
}

function PastStayCard({ stay }) {
  const [open, setOpen] = useState(false)
  const logs = [...(stay.dailyLogs || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="past-stay-card">
      <button className="past-stay-header" onClick={() => setOpen(o => !o)}>
        <div className="past-stay-header-left">
          <PersonChip person={stay.person} />
          <div>
            <div className="past-stay-title">{stay.hospital || 'Hospital'}</div>
            <div className="past-stay-meta">
              {fmtDate(stay.admissionDate)} – {fmtDate(stay.dischargeDate)}
              {stay.department ? ` · ${stay.department}` : ''}
            </div>
          </div>
        </div>
        <span className={`past-stay-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      {open && (
        <div className="past-stay-body">
          {stay.reason && <div className="past-stay-reason">{stay.reason}</div>}
          {logs.length === 0 ? (
            <div className="hospital-empty">No logs recorded for this stay.</div>
          ) : (
            <div className="daily-logs-list">
              {logs.map(log => (
                <div key={log.id} className="day-slot day-slot-filled day-slot-readonly">
                  <div className="day-slot-header">
                    <span className="day-slot-label">{fmtDate(log.date)}</span>
                  </div>
                  <div className="day-slot-content">
                    {log.notes && <div className="day-slot-notes">{log.notes}</div>}
                    {log.careTeam && (
                      <div className="day-slot-careteam">
                        <span className="day-slot-careteam-label">Care team</span> {log.careTeam}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HospitalView({ stays, activeStay }) {
  const [stayModalOpen, setStayModalOpen] = useState(false)
  const [editingStay, setEditingStay] = useState(null)
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [editingDate, setEditingDate] = useState(null)

  const pastStays = stays.filter(s => !!s.dischargeDate)
  const medLogs = activeStay?.medLogs || []

  function openEditStay() {
    setEditingStay(activeStay)
    setStayModalOpen(true)
  }

  function openNewStay() {
    setEditingStay(null)
    setStayModalOpen(true)
  }

  function handleDayClick(dateStr, log) {
    setEditingLog(log || null)
    setEditingDate(dateStr)
    setLogModalOpen(true)
  }

  function closeLogModal() {
    setLogModalOpen(false)
    setEditingLog(null)
    setEditingDate(null)
  }

  return (
    <div className="page hospital-page">
      <div className="hospital-page-header">
        <h1 className="hospital-page-title">Hospital Stay</h1>
      </div>

      <div className={`hospital-body${activeStay ? ' hospital-body--sidebar' : ''}`}>
        <div>
          {activeStay ? (
            <ActiveStaySection
              stay={activeStay}
              onEdit={openEditStay}
              onDayClick={handleDayClick}
            />
          ) : (
            <div className="hospital-no-active">
              <div className="hospital-no-active-icon">🏥</div>
              <div className="hospital-no-active-text">No active hospital stay</div>
              <button className="btn-add" onClick={openNewStay}>+ Admit</button>
            </div>
          )}

          {/* Mobile only — med log section below the stay card */}
          {activeStay && <MobileMedSection medLogs={medLogs} />}
        </div>

        <aside className="hospital-aside">
          {activeStay && (
            <div className="hospital-overview-card">
              <div className="hospital-overview-heading">Stay overview</div>
              <div className="hospital-overview-stats">
                <div className="hospital-overview-stat" style={{ flex: 'none', width: '100%' }}>
                  <span className="hospital-overview-val">{dayCount(activeStay.admissionDate)}</span>
                  <span className="hospital-overview-label">days admitted</span>
                </div>
              </div>
              {activeStay.department && (
                <div className="hospital-overview-row">
                  <span className="hospital-overview-key">Department</span>
                  <span className="hospital-overview-rowval">{activeStay.department}</span>
                </div>
              )}
              {activeStay.hospital && (
                <div className="hospital-overview-row">
                  <span className="hospital-overview-key">Hospital</span>
                  <span className="hospital-overview-rowval">{activeStay.hospital}</span>
                </div>
              )}
              <div className="hospital-overview-row">
                <span className="hospital-overview-key">Admitted</span>
                <span className="hospital-overview-rowval">{fmtDate(activeStay.admissionDate)}</span>
              </div>
            </div>
          )}

          {activeStay && (
            <div className="hospital-medlog-card">
              <div className="hospital-overview-heading">Medications this stay</div>
              <MedLogList medLogs={medLogs} />
            </div>
          )}

          {pastStays.length > 0 && (
            <div className="past-stays-section">
              <div className="past-stays-heading">Past stays</div>
              {pastStays.map(s => (
                <PastStayCard key={s.id} stay={s} />
              ))}
            </div>
          )}
        </aside>
      </div>

      {stayModalOpen && (
        <HospitalStayModal
          stay={editingStay}
          onClose={() => { setStayModalOpen(false); setEditingStay(null) }}
        />
      )}

      {logModalOpen && activeStay && (
        <DailyLogModal
          stayId={activeStay.id}
          log={editingLog}
          date={editingDate}
          onClose={closeLogModal}
          medLogs={medLogs}
        />
      )}
    </div>
  )
}
