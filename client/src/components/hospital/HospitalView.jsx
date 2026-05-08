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

function DaySlot({ dateStr, log, onClick }) {
  const isToday = dateStr === todayStr()
  const hasLog = !!log

  return (
    <button
      className={`day-slot${hasLog ? ' day-slot-filled' : ' day-slot-empty'}`}
      onClick={() => onClick(dateStr, log)}
    >
      <div className="day-slot-header">
        <span className="day-slot-label">
          {isToday ? 'Today' : fmtDate(dateStr)}
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
          />
        ))}
      </div>
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

      {pastStays.length > 0 && (
        <div className="past-stays-section">
          <div className="past-stays-heading">Past stays</div>
          {pastStays.map(s => (
            <PastStayCard key={s.id} stay={s} />
          ))}
        </div>
      )}

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
        />
      )}
    </div>
  )
}
