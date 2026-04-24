import { useState, useRef, useMemo } from 'react'
import MedGroupSection from './MedGroupSection'
import MedRow from './MedRow'
import MedModal from './MedModal'
import MedGroupHeader from './MedGroupHeader'
import { exportCSV, exportJSON, importMeds } from '../../lib/firestore'
import { supplyStatus, pillsNow } from '../../lib/medUtils'

export default function MedicationsView({ meds, careTeam }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [expandedInactiveId, setExpandedInactiveId] = useState(null)
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

  function handleFilter(f) {
    setActiveFilter(f)
    if (f === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const ref = f === 'urgent' ? urgentRef : f === 'soon' ? soonRef : okRef
    if (!ref.current) return
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ref.current.classList.add('highlighted')
    setTimeout(() => ref.current?.classList.remove('highlighted'), 1400)
  }

  const q = search.toLowerCase()

  const activeMeds   = useMemo(() => meds.filter(m => m.active !== false), [meds])
  const inactiveMeds = useMemo(() => meds.filter(m => m.active === false), [meds])

  const filtered = useMemo(() => {
    let rows = [...activeMeds].sort((a, b) => pillsNow(a).daysToZero - pillsNow(b).daysToZero)
    if (q) rows = rows.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.pharmacy || '').toLowerCase().includes(q) ||
      (m.doctor || '').toLowerCase().includes(q)
    )
    return rows
  }, [activeMeds, q])

  const grouped = useMemo(() => ({
    urgent: filtered.filter(m => supplyStatus(m) === 'urgent'),
    soon:   filtered.filter(m => supplyStatus(m) === 'soon'),
    ok:     filtered.filter(m => supplyStatus(m) === 'ok'),
  }), [filtered])

  return (
    <div className="page">
      <div className="tbl-hdr">
        <div className="tbl-left">
          <div className="filter-tabs">
            {[
              ['all',    'All'],
              ['urgent', '≤ 7d'],
              ['soon',   '8–14d'],
              ['ok',     'Stocked'],
            ].map(([f, label]) => (
              <button
                key={f}
                className={`ftab${activeFilter === f ? ' active' : ''}`}
                onClick={() => handleFilter(f)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
            <MedGroupSection groupKey="urgent" meds={grouped.urgent} sectionRef={urgentRef} careTeam={careTeam} />
            <MedGroupSection groupKey="soon"   meds={grouped.soon}   sectionRef={soonRef}   careTeam={careTeam} />
            <MedGroupSection groupKey="ok"     meds={grouped.ok}     sectionRef={okRef}     careTeam={careTeam} />
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
                    <MedRow
                      key={m.id}
                      m={m}
                      careTeam={careTeam}
                      isExpanded={expandedInactiveId === m.id}
                      onToggleExpand={() => setExpandedInactiveId(prev => prev === m.id ? null : m.id)}
                    />
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
    </div>
  )
}
