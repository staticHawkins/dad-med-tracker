import { useState } from 'react'
import { fmtAptDateBlock, fmtAptTime, coveringLabel, aptStatus } from '../../lib/aptUtils'

export default function HeroCard({ apt }) {
  const [open, setOpen] = useState(false)
  if (!apt) return null

  const status = aptStatus(apt)
  const db = fmtAptDateBlock(apt.dateTime)
  const time = fmtAptTime(apt.dateTime)
  const dayLabel = time
    ? `${time} · ${new Date(apt.dateTime).toLocaleDateString('en-US', { weekday: 'long' })}`
    : new Date(apt.dateTime).toLocaleDateString('en-US', { weekday: 'long' })
  const meta = [apt.doctor, apt.location].filter(Boolean).join(' · ')

  return (
    <div className={`hero-card ${status}`} onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', flexWrap: 'wrap' }}>
      <div className="hero-inner">
        <div className="hero-date-block">
          <div className="hero-date-month">{db.month}</div>
          <div className="hero-date-day">{db.day}</div>
        </div>
        <div className="hero-body">
          <div className="hero-card-label">Next appointment</div>
          <div className="hero-card-title">{apt.title}</div>
          {dayLabel && <div className="hero-card-time">{dayLabel}</div>}
          {meta && <div className="hero-card-meta">{meta}</div>}
          {apt.covering && (
            <div style={{ marginTop: 8 }}>
              <span className={`covering-pill ${apt.covering}`}>{coveringLabel(apt.covering)}</span>
            </div>
          )}
        </div>
        <span className={`apt-chevron${open ? ' open' : ''}`}>▼</span>
      </div>
      <div className={`apt-expand${open ? ' open' : ''}`}>
        <div className="apt-expand-grid">
          <div>
            <div className="expand-section-label">Prep &amp; questions</div>
            {apt.prep
              ? <div className="expand-text">{apt.prep}</div>
              : <div className="expand-empty">None added</div>}
          </div>
          <div>
            <div className="expand-section-label">Post appointment notes</div>
            {apt.postNotes
              ? <div className="expand-text">{apt.postNotes}</div>
              : <div className="expand-empty">None added</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
