import { useState, useRef, useEffect } from 'react'
import KPIRow from './KPIRow'
import MedsTable from './MedsTable'
import MedModal from './MedModal'
import { exportCSV, exportJSON, importMeds } from '../../lib/firestore'
import { st } from '../../lib/medUtils'

const FILTER_LABELS = {
  all: 'All medications',
  urgent: 'Urgent — refill within 3 days',
  soon: 'Refill this week (4–7 days)',
  ok: 'Stocked up'
}

export default function MedicationsView({ meds, addTrigger, onAddHandled }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(undefined)  // undefined = closed, null = new, string = editing
  const fileRef = useRef()

  useEffect(() => {
    if (addTrigger) { setEditId(null); onAddHandled() }
  }, [addTrigger])

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

  return (
    <div className="page">
      <KPIRow meds={meds} />

      <div className="tbl-hdr">
        <div className="tbl-left">
          <span className="tbl-title">{FILTER_LABELS[filter]}</span>
          <div className="filter-tabs">
            {['all', 'urgent', 'soon', 'ok'].map(f => (
              <button
                key={f}
                className={`ftab${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'urgent' ? '≤ 3 days' : f === 'soon' ? '4–7 days' : 'Stocked up'}
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
        </div>
      </div>

      <MedsTable meds={meds} filter={filter} search={search} onEdit={openModal} />

      {editId !== undefined && (
        <MedModal meds={meds} editId={editId} onClose={closeModal} />
      )}
    </div>
  )
}
