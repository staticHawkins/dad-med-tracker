import { useState, useEffect } from 'react'
import { aptStatus } from '../../lib/aptUtils'
import MiniCalendar from './MiniCalendar'
import HeroCard from './HeroCard'
import AgendaGroups from './AgendaGroups'
import AptModal from './AptModal'

export default function AppointmentsView({ apts, addTrigger, onAddHandled }) {
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(undefined)
  const [pastExpanded, setPastExpanded] = useState(false)

  useEffect(() => {
    if (addTrigger) { setEditId(null); onAddHandled() }
  }, [addTrigger])

  function openModal(id = null) { setEditId(id) }
  function closeModal() { setEditId(undefined) }

  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const nextApt = sorted.find(a => aptStatus(a) !== 'past') || null

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
          </div>
          <div id="apt-agenda">
            <AgendaGroups
              apts={apts}
              search={search}
              onEdit={openModal}
              pastExpanded={pastExpanded}
              onPastExpand={() => setPastExpanded(o => !o)}
            />
          </div>
        </div>
      </div>

      {editId !== undefined && (
        <AptModal apts={apts} editId={editId} onClose={closeModal} />
      )}
    </div>
  )
}
