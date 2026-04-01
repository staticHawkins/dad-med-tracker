import { useState } from 'react'
import { aptStatus } from '../../lib/aptUtils'
import { today } from '../../lib/medUtils'
import AptCard from './AptCard'

export default function AgendaGroups({ apts, search, onEdit, pastExpanded, onPastExpand }) {
  const q = search.toLowerCase()

  const rows = [...apts]
    .filter(a =>
      !q ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.doctor || '').toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q)
    )
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))

  const grouped = { today: [], soon: [], upcoming: [], past: [] }
  rows.forEach(a => grouped[aptStatus(a)].push(a))

  const t = today()
  const start = new Date(t); start.setDate(t.getDate() + 1)
  const end   = new Date(t); end.setDate(t.getDate() + 7)
  const weekRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text2)' }}>
        {apts.length === 0
          ? 'No appointments yet. Click "+ Add appointment" to get started.'
          : 'No appointments match your search.'}
      </div>
    )
  }

  return (
    <>
      {grouped.today.length > 0 && (
        <div className="agenda-group">
          <div className="group-hdr">
            <span className="group-label today-lbl">Today — {todayStr}</span>
            <div className="group-line" />
            <span className="group-count">{grouped.today.length}</span>
          </div>
          {grouped.today.map(a => <AptCard key={a.id} apt={a} status="today" onEdit={onEdit} />)}
        </div>
      )}

      {grouped.soon.length > 0 && (
        <div className="agenda-group">
          <div className="group-hdr">
            <span className="group-label">This week — {weekRange}</span>
            <div className="group-line" />
            <span className="group-count">{grouped.soon.length}</span>
          </div>
          {grouped.soon.map(a => <AptCard key={a.id} apt={a} status="soon" onEdit={onEdit} />)}
        </div>
      )}

      {grouped.upcoming.length > 0 && (
        <div className="agenda-group">
          <div className="group-hdr">
            <span className="group-label">Upcoming</span>
            <div className="group-line" />
            <span className="group-count">{grouped.upcoming.length}</span>
          </div>
          {grouped.upcoming.map(a => <AptCard key={a.id} apt={a} status="upcoming" onEdit={onEdit} />)}
        </div>
      )}

      {grouped.past.length > 0 && (
        <div className="agenda-group">
          <button className="past-toggle" onClick={onPastExpand}>
            <span className={`past-toggle-icon${pastExpanded ? ' open' : ''}`}>▼</span>
            {pastExpanded
              ? ' Hide past appointments'
              : ` Show ${grouped.past.length} past appointment${grouped.past.length !== 1 ? 's' : ''}`}
          </button>
          <div className={`past-content${pastExpanded ? ' open' : ''}`}>
            <div className="group-hdr" style={{ marginTop: 10 }}>
              <span className="group-label">Past</span>
              <div className="group-line" />
              <span className="group-count">{grouped.past.length}</span>
            </div>
            <div className="past-group-wrap">
              {[...grouped.past].reverse().map(a => <AptCard key={a.id} apt={a} status="past" onEdit={onEdit} />)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
