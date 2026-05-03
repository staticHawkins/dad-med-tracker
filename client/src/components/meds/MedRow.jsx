import { pillsNow, supplyStatus, supplyStatusLabel, refillStatusLabel, pillStatusClass, fmtDate, freqLabel, getRefillDate, queuedFill, effectiveDaysToZero } from '../../lib/medUtils'
import PersonChip from '../PersonChip'

export default function MedRow({ m, onOpen }) {
  const isInactive = m.active === false
  const s = supplyStatus(m)
  const lbl = supplyStatusLabel(m)
  const rsl = refillStatusLabel(m)
  const p = pillsNow(m)
  const pct = p.tot > 0 ? Math.round((p.rem / p.tot) * 100) : 0
  const pc = pillStatusClass(p.rem, p.tot)
  const bc = pc === 'zero' || pc === 'low' ? 'var(--red)' : s === 'soon' ? 'var(--amber)' : 'var(--green)'
  const daysCls = p.rem <= 0 ? 'zero' : s === 'urgent' ? 'zero' : s === 'soon' ? 'low' : 'ok'
  const pillSt = p.rem <= 0 ? 'empty' : s
  const fl = freqLabel(m)
  const sub = [m.brandName || null, m.dose, m.rxNum ? 'Rx ' + m.rxNum : '', fl].filter(Boolean).join(' · ')
  const rdDate = getRefillDate(m)
  const rd = rdDate ? fmtDate(rdDate) : '—'
  const hasQueued = !!queuedFill(m)
  const effDays = hasQueued ? effectiveDaysToZero(m) : null

  return (
    <div
      className={`med-row${isInactive ? ' med-row-inactive' : ''}`}
      style={{ borderLeft: `3px solid var(--${m.person || 'dad'})`, cursor: 'pointer' }}
      onClick={onOpen}
    >
      <div className="med-row-main">

        <div className="med-col-name">
          <div className="med-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PersonChip person={m.person} />
            {m.name}
          </div>
          <div className="med-sub">
            {sub}
            {m.pharmacy && <span className="med-pharm-in-sub"> · {m.pharmacy}</span>}
          </div>
        </div>

        <div className="med-col-pills">
          <div className="pills-top">
            <span className={`pill-count ${p.daysToZero === 999 ? pc : daysCls}`}>
              {p.daysToZero === 999 ? p.rem : p.daysToZero}
            </span>
            <span className="pill-of">{p.daysToZero === 999 ? 'pills' : 'd'}</span>
          </div>
          <div className="bar-row">
            <div className="bar-bg">
              <div className="bar-fill" style={{ width: pct + '%', background: bc }} />
            </div>
            <span className="bar-pct">{pct}%</span>
          </div>
        </div>

        <div className="med-col-status">
          <span className={`spill sp-${pillSt}`}>{lbl}</span>
          {rsl && <span className="refill-status-badge">{rsl}</span>}
          <div className="med-mobile-pills">
            <span className={`med-mobile-count ${p.daysToZero === 999 ? pc : daysCls}`}>
              {p.daysToZero === 999 ? p.rem : p.daysToZero}
              <span className="med-mobile-of">{p.daysToZero === 999 ? 'p' : 'd'}</span>
            </span>
            {effDays != null && (
              <span className="med-mobile-queued">→ {effDays}d</span>
            )}
          </div>
        </div>

        <div className="med-col-date">{rd}</div>
        <div className="med-col-pharm">{m.pharmacy || '—'}</div>
      </div>
    </div>
  )
}
