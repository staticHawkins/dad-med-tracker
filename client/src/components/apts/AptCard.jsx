import { fmtAptDateBlock, fmtAptTime, coveringLabel, typeLabel } from '../../lib/aptUtils'

export default function AptCard({ apt, status, onView, hasNote }) {
  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const tl = typeLabel(apt.type)

  return (
    <div className={`apt-card ${status}`} data-apt-id={apt.id} onClick={() => onView(apt.id)} style={{ cursor: 'pointer' }}>
      <div className="apt-card-top">
        <div className="apt-date">
          <div className="apt-date-month">{db.month}</div>
          <div className="apt-date-day">{db.day}</div>
        </div>
        <div className="apt-divider" />
        <div className="apt-body">
          <div className="apt-title">{apt.title}</div>
          {time && <div className="apt-time">{time}</div>}
          <div className="apt-meta">
            {apt.doctor && <span className="apt-doctor">{apt.doctor}</span>}
            {apt.location && <span className={`apt-location${apt.doctor ? ' has-doctor' : ''}`}>{apt.location}</span>}
            {tl && <span className="type-chip">{tl}</span>}
          </div>
        </div>
        {apt.covering && (
          <span className={`covering-pill ${apt.covering}`}>{coveringLabel(apt.covering)}</span>
        )}
        <div className={`apt-note-indicator${hasNote ? ' has-note' : ' no-note'}`}>
          {hasNote ? '📋' : '—'}
        </div>
      </div>
    </div>
  )
}
