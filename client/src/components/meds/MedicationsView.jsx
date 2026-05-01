import { useState, useRef, useMemo } from 'react'
import MedGroupSection from './MedGroupSection'
import MedRow from './MedRow'
import MedModal from './MedModal'
import MedDetailModal from './MedDetailModal'
import MedGroupHeader from './MedGroupHeader'
import { exportCSV, exportJSON, importMeds } from '../../lib/firestore'
import { supplyStatus, pillsNow } from '../../lib/medUtils'
import { filterByPerson } from '../MainApp'
import PersonChip from '../PersonChip'

function PersonFilter({ value, onChange }) {
  return (
    <div className="person-filter">
      {['all', 'dad', 'mom'].map(p => (
        <button key={p} className={`pfill pfill-${p}${value === p ? ' on' : ''}`} onClick={() => onChange(p)}>
          {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}

export default function MedicationsView({ meds, careTeam, personFilter, onPersonFilter }) {
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [viewingMedId, setViewingMedId] = useState(null)
  const fileRef = useRef()

  const urgentRef = useRef()
  const soonRef   = useRef()
  const okRef     = useRef()

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    try {
      const count = await importMeds(file, meds)
      alert(`Imported ${count} new medication(s).`)
    } catch (err) { alert(err.message) }
    e.target.value = ''
  }

  const q = search.toLowerCase()

  const activeMeds   = useMemo(() => meds.filter(m => m.active !== false), [meds])
  const inactiveMeds = useMemo(() => meds.filter(m => m.active === false), [meds])

  const filtered = useMemo(() => {
    let rows = [...filterByPerson(activeMeds, personFilter)].sort((a, b) => pillsNow(a).daysToZero - pillsNow(b).daysToZero)
    if (q) rows = rows.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.pharmacy || '').toLowerCase().includes(q) ||
      (m.doctor || '').toLowerCase().includes(q)
    )
    return rows
  }, [activeMeds, personFilter, q])

  const grouped = useMemo(() => ({
    urgent: filtered.filter(m => supplyStatus(m) === 'urgent'),
    soon:   filtered.filter(m => supplyStatus(m) === 'soon'),
    ok:     filtered.filter(m => supplyStatus(m) === 'ok'),
  }), [filtered])

  return (
    <div className="page">
      <div className="mobile-person-filter">
        <PersonFilter value={personFilter} onChange={onPersonFilter} />
      </div>
      <div className="tbl-hdr">
        <div className="tbl-tools">
          <div className="search-wrap">
            <span className="search-ico">🔍</span>
            <input
              className="search-input"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-ghost" onClick={() => exportCSV(meds)}>⬇ CSV</button>
          <button className="btn-ghost" onClick={() => exportJSON(meds)}>💾 Backup</button>
          <button className="btn-ghost" onClick={() => fileRef.current.click()}>⬆ Import</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn-add" onClick={() => setAddOpen(true)}>+ Add medication</button>
        </div>
      </div>

      {filtered.length === 0 && inactiveMeds.length === 0 ? (
        <div className="med-empty">
          {meds.length === 0
            ? 'No medications yet. Click "+ Add medication" to get started.'
            : 'No medications match your search.'}
        </div>
      ) : (
        <div className="med-groups">
          {filtered.length > 0 && <>
            <MedGroupSection groupKey="urgent" meds={grouped.urgent} sectionRef={urgentRef} onOpen={setViewingMedId} />
            <MedGroupSection groupKey="soon"   meds={grouped.soon}   sectionRef={soonRef}   onOpen={setViewingMedId} />
            <MedGroupSection groupKey="ok"     meds={grouped.ok}     sectionRef={okRef}     onOpen={setViewingMedId}
              forceOpen={!grouped.urgent.length && !grouped.soon.length} />
          </>}
          {inactiveMeds.length > 0 && (
            <div className="med-group med-group-inactive">
              <MedGroupHeader
                label="Inactive"
                count={inactiveMeds.length}
                variant="inactive"
                isOpen={showInactive}
                onToggle={() => setShowInactive(o => !o)}
              />
              {showInactive && (
                <div className="med-group-body">
                  {inactiveMeds.map(m => (
                    <MedRow key={m.id} m={m} onOpen={() => setViewingMedId(m.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <MedModal careTeam={careTeam} onClose={() => setAddOpen(false)} />
      )}

      {viewingMedId && (() => {
        const med = meds.find(x => x.id === viewingMedId)
        if (!med) return null
        return <MedDetailModal med={med} careTeam={careTeam} onClose={() => setViewingMedId(null)} />
      })()}
    </div>
  )
}
