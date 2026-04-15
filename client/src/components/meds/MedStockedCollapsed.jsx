import { pillsNow } from '../../lib/medUtils'

export default function MedStockedCollapsed({ items, onShow }) {
  const days = items.map(m => pillsNow(m).daysToZero).filter(d => d > 0)
  const minD = days.length ? Math.min(...days) : 0
  const maxD = days.length ? Math.max(...days) : 0
  const preview = items.slice(0, 3)

  return (
    <div className="stk-collapsed">
      <span className="stk-dots">
        {preview.map((_, i) => <span key={i} className="stk-dot" />)}
        {items.length > 3 && <span className="stk-dot stk-dot-dim" />}
      </span>
      <span className="stk-text">
        <span className="lbl-full">
          {items.length} medication{items.length !== 1 ? 's' : ''} · all stocked {minD}–{maxD} days
        </span>
        <span className="lbl-short">
          {items.length} med{items.length !== 1 ? 's' : ''} · {minD}–{maxD} days supply
        </span>
      </span>
      <button className="stk-show-btn" onClick={onShow}>Show ›</button>
    </div>
  )
}
