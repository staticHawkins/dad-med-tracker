import { useState } from 'react'
import { aptStatus } from '../../lib/aptUtils'
import { useNotes } from '../../hooks/useNotes'
import MiniCalendar from './MiniCalendar'
import HeroCard from './HeroCard'
import AgendaGroups from './AgendaGroups'
import AptModal from './AptModal'
import AptDetailModal from './AptDetailModal'

export default function AppointmentsView({ apts, careTeam }) {
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [pastExpanded, setPastExpanded] = useState(false)
  const noteById = useNotes()

  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const nextApt = sorted.find(a => aptStatus(a) !== 'past') || null

  const detailApt = detailId ? apts.find(a => a.id === detailId) : null
  const detailNote = detailApt?.dateTime ? noteById[detailApt.dateTime.slice(0, 10)] || null : null

  return (
    <div className="page">
      <div className="apt-layout">
        <div className="apt-sidebar">
          <MiniCalendar
            apts={apts}
            onPastExpand={() => setPastExpanded(true)}
          />
        </div>
        <div className="apt-main">
          <div id="apt-hero">
            <HeroCard apt={nextApt} />
          </div>
          <div className="agenda-controls">
            <div className="search-wrap">
              <span className="search-ico">🔍</span>
              <input
                className="search-input"
                placeholder="Search appointments…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-add" onClick={() => setAddOpen(true)}>+ Add appointment</button>
          </div>
          <div id="apt-agenda">
            <AgendaGroups
              apts={apts}
              search={search}
              noteById={noteById}
              onView={id => setDetailId(id)}
              pastExpanded={pastExpanded}
              onPastExpand={() => setPastExpanded(o => !o)}
              careTeam={careTeam}
            />
          </div>
        </div>
      </div>

      {addOpen && (
        <AptModal careTeam={careTeam} onClose={() => setAddOpen(false)} />
      )}

      {detailApt && (
        <AptDetailModal
          apt={detailApt}
          note={detailNote}
          careTeam={careTeam}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}
