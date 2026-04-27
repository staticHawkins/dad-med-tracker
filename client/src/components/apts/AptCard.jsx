import { fmtAptDateBlock, fmtAptTime, coveringLabel } from '../../lib/aptUtils'

export default function AptCard({ apt, status, onView, hasNote, careTeam = [] }) {
  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const doctor = careTeam.find(dr => dr.name === apt.doctor)
  const photoUrl = doctor?.imageUrl || null
  const initials = apt.doctor ? apt.doctor.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : null

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
          </div>
        </div>
        <div className="apt-card-right">
          {apt.covering && (
            <span className={`covering-pill ${apt.covering}`}>{coveringLabel(apt.covering)}</span>
          )}
          {initials && (
            <div className="apt-dr-avatar">
              {photoUrl
                ? <img src={photoUrl} alt={apt.doctor} className="apt-dr-photo" />
                : <span className="apt-dr-initials">{initials}</span>
              }
            </div>
          )}
          <div className={`apt-note-indicator${hasNote ? ' has-note' : ' no-note'}`}>
            {hasNote ? '📋' : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
