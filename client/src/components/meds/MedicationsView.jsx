import { useState, useRef, useMemo } from 'react'
import MedGroupSection from './MedGroupSection'
import MedModal from './MedModal'
import { exportCSV, exportJSON, importMeds } from '../../lib/firestore'
import { st, pillsNow } from '../../lib/medUtils'

export default function MedicationsView({ meds, careTeam }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(undefined)  // undefined=closed, null=new, string=editing
  const fileRef = useRef()

  const urgentRef = useRef()
  const soonRef   = useRef()
  const okRef     = useRef()

  function openModal(id = null) { setEditId(id) }
  function closeModal() { setEditId(undefined) }

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

  const filtered = useMemo(() => {
    let rows = [...meds].sort((a, b) => pillsNow(a).daysToZero - pillsNow(b).daysToZero)
    if (q) rows = rows.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.pharmacy || '').toLowerCase().includes(q) ||
      (m.doctor || '').toLowerCase().includes(q)
    )
    return rows
  }, [meds, q])

  const grouped = useMemo(() => ({
    urgent: filtered.filter(m => st(m) === 'urgent'),
    soon:   filtered.filter(m => st(m) === 'soon'),
    ok:     filtered.filter(m => st(m) === 'ok'),
  }), [filtered])

  return (
    <div className="page">
      <div className="tbl-hdr">
        <div className="tbl-left">
          <div className="filter-tabs">
            {[
              ['all',    'All'],
              ['urgent', '≤ 3d'],
              ['soon',   '4–7d'],
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
          <button className="btn-add" onClick={() => openModal()}>+ Add medication</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="med-empty">
          {meds.length === 0
            ? 'No medications yet. Click "+ Add medication" to get started.'
            : 'No medications match your search.'}
        </div>
      ) : (
        <div className="med-groups">
          <MedGroupSection groupKey="urgent" meds={grouped.urgent} sectionRef={urgentRef} onEdit={openModal} />
          <MedGroupSection groupKey="soon"   meds={grouped.soon}   sectionRef={soonRef}   onEdit={openModal} />
          <MedGroupSection groupKey="ok"     meds={grouped.ok}     sectionRef={okRef}     onEdit={openModal} />
        </div>
      )}

      {editId !== undefined && (
        <MedModal meds={meds} careTeam={careTeam} editId={editId} onClose={closeModal} />
      )}
    </div>
  )
}
