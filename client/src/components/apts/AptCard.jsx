import { fmtAptDateBlock, fmtAptTime, coveringLabel } from '../../lib/aptUtils'
import { useSpecialties, specialtyLabel } from '../../hooks/useSpecialties'
import PersonChip from '../PersonChip'

export default function AptCard({ apt, status, onView, hasNote, careTeam = [] }) {
  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const doctor = careTeam.find(dr => dr.name === apt.doctor)
  const photoUrl = doctor?.imageUrl || null
  const initials = apt.doctor ? apt.doctor.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : null
  const specialties = useSpecialties()
  const specialty = doctor?.specialty ? specialtyLabel(specialties, doctor.specialty) : null

  return (
    <div className={`apt-card ${status}`} data-apt-id={apt.id} onClick={() => onView(apt.id)} style={{ cursor: 'pointer', borderLeft: `3px solid var(--${apt.person || 'dad'})` }}>
      <div className="apt-card-top">
        <div className="apt-date">
          <div className="apt-date-month">{db.month}</div>
          <div className="apt-date-day">{db.day}</div>
        </div>
        <div className="apt-divider" />
        <div className="apt-body">
          <div className="apt-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {apt.title} <PersonChip person={apt.person} />
          </div>
          {time && <div className="apt-time">{time}</div>}
          <div className="apt-meta">
            {specialty && <span className="apt-doctor">{specialty}</span>}
            {apt.location && <span className={`apt-location${specialty ? ' has-doctor' : ''}`}>{apt.location}</span>}
          </div>
          {apt.covering && (
            <span className={`covering-pill ${apt.covering}`} style={{ marginTop: 4 }}>{coveringLabel(apt.covering)}</span>
          )}
        </div>
        <div className="apt-card-right">
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
