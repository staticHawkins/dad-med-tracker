import { pillsNow, st, stLabel, pillStatusClass, fmtDate, getRefillDate, freqLabel } from '../../lib/medUtils'
import { markRefilled, delMed } from '../../lib/firestore'

export default function MedsTable({ meds, filter, search, onEdit }) {
  const q = search.toLowerCase()

  let rows = [...meds].sort((a, b) => pillsNow(a).daysToZero - pillsNow(b).daysToZero)
  if (filter !== 'all') rows = rows.filter(m => st(m) === filter)
  if (q) rows = rows.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.pharmacy || '').toLowerCase().includes(q) ||
    (m.doctor || '').toLowerCase().includes(q)
  )

  async function handleDelete(m) {
    if (!confirm(`Remove ${m.name}?`)) return
    try { await delMed(m.id) } catch { alert('Failed to delete. Check your connection.') }
  }

  async function handleRefill(m) {
    try { await markRefilled(m) } catch { alert('Failed to update. Check your connection.') }
  }

  if (!rows.length) {
    return (
      <div className="tbl-wrap">
        <table>
          <colgroup>
            <col className="c-med" /><col className="c-status" /><col className="c-pills" />
            <col className="c-refill" /><col className="c-pharm" /><col className="c-act" />
          </colgroup>
          <thead>
            <tr>
              <th>Medication</th><th>Status</th><th>Pills remaining</th>
              <th>Refill date</th><th>Pharmacy</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr className="empty-row">
              <td colSpan={6}>
                {meds.length === 0
                  ? 'No medications yet. Click "+ Add medication" to get started.'
                  : 'No medications match this filter.'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="tbl-wrap">
      <table>
        <colgroup>
          <col className="c-med" /><col className="c-status" /><col className="c-pills" />
          <col className="c-refill" /><col className="c-pharm" /><col className="c-act" />
        </colgroup>
        <thead>
          <tr>
            <th>Medication</th><th>Status</th><th>Pills remaining</th>
            <th>Refill date</th><th>Pharmacy</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => {
            const s = st(m)
            const lbl = stLabel(m)
            const p = pillsNow(m)
            const pct = p.tot > 0 ? Math.round((p.rem / p.tot) * 100) : 0
            const pc = pillStatusClass(p.rem, p.tot)
            const bc = pc === 'zero' || pc === 'low' ? 'var(--red)' : s === 'soon' ? 'var(--amber)' : 'var(--green)'
            const pillSt = p.rem <= 0 ? 'empty' : s
            const fl = freqLabel(m)
            const sub = [m.dose, m.rxNum ? 'Rx ' + m.rxNum : '', fl].filter(Boolean).join(' · ')
            const rd = m.refillDate ? fmtDate(m.refillDate) : (p.runOutDate ? fmtDate(p.runOutDate) + ' *' : '—')

            return (
              <tr key={m.id} onClick={() => onEdit(m.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="td-name">{m.name}</div>
                  {sub && <div className="td-sub">{sub}</div>}
                </td>
                <td>
                  <span className={`spill sp-${pillSt}`}>{lbl}</span>
                </td>
                <td className="pills-cell">
                  <div className="pills-top">
                    <span className={`pill-count ${pc}`}>{p.rem}</span>
                    <span className="pill-of">/ {p.tot}</span>
                  </div>
                  <div className="bar-row">
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: pct + '%', background: bc }} />
                    </div>
                    <span className="bar-pct">{pct}%</span>
                  </div>
                </td>
                <td className="td-dt">{rd}</td>
                <td className="td-ph">{m.pharmacy || '—'}</td>
                <td className="td-act">
                  <button className="act green" title="Mark refilled" onClick={e => { e.stopPropagation(); handleRefill(m) }}>✓</button>
                  <button className="act red" title="Remove" onClick={e => { e.stopPropagation(); handleDelete(m) }}>✕</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
