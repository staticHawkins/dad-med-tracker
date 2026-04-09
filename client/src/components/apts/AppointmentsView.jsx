import { useState } from 'react'
import { aptStatus } from '../../lib/aptUtils'
import { useSpecialties } from '../../hooks/useSpecialties'
import { useNotes } from '../../hooks/useNotes'
import MiniCalendar from './MiniCalendar'
import HeroCard from './HeroCard'
import AgendaGroups from './AgendaGroups'
import AptModal from './AptModal'

export default function AppointmentsView({ apts, careTeam }) {
  const specialties = useSpecialties()
  const [search, setSearch] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [editId, setEditId] = useState(undefined)
  const [pastExpanded, setPastExpanded] = useState(false)
  const noteById = useNotes()

  const availableSpecialties = specialties.filter(s =>
    apts.some(a => a.specialty === s.id)
  )

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
          {availableSpecialties.length > 0 && (
            <div className="specialty-filters">
              <button
                className={`sf-chip${specialty === '' ? ' active' : ''}`}
                onClick={() => setSpecialty('')}
              >All</button>
              {availableSpecialties.map(s => (
                <button
                  key={s.id}
                  className={`sf-chip${specialty === s.id ? ' active' : ''}`}
                  onClick={() => setSpecialty(o => o === s.id ? '' : s.id)}
                >{s.label}</button>
              ))}
            </div>
          )}
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
            <button className="btn-add" onClick={() => openModal()}>+ Add appointment</button>
          </div>
          <div id="apt-agenda">
            <AgendaGroups
              apts={apts}
              search={search}
              specialty={specialty}
              noteById={noteById}
              onEdit={openModal}
              pastExpanded={pastExpanded}
              onPastExpand={() => setPastExpanded(o => !o)}
            />
          </div>
        </div>
      </div>

      {editId !== undefined && (
        <AptModal apts={apts} careTeam={careTeam} editId={editId} onClose={closeModal} />
      )}
    </div>
  )
}
