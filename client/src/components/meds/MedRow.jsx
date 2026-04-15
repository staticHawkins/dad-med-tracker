import { useState, useRef, useEffect } from 'react'
import { pillsNow, st, stLabel, pillStatusClass, fmtDate, freqLabel } from '../../lib/medUtils'
import { markRefilled, delMed } from '../../lib/firestore'

export default function MedRow({ m, onEdit, isExpanded, onToggleExpand }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const menuRef = useRef()

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

  useEffect(() => {
    if (!menuOpen) { setConfirming(false); return }
    function onOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [menuOpen])

  async function handleRefill(e) {
    e.stopPropagation()
    try { await markRefilled(m) } catch { alert('Failed to update. Check your connection.') }
    setMenuOpen(false)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setMenuOpen(false)
    try { await delMed(m.id) } catch { alert('Failed to delete. Check your connection.') }
  }

  function handleRowClick() {
    if (window.innerWidth < 640) {
      onToggleExpand()
    } else {
      onEdit(m.id)
    }
  }

  const callHref = m.pharmacy
    ? `https://www.google.com/maps/search/${encodeURIComponent(m.pharmacy + ' pharmacy')}`
    : null

  return (
    <div className={`med-row${isExpanded ? ' row-open' : ''}`}>
      {/* ── Main row ── */}
      <div className="med-row-main" onClick={handleRowClick}>

        {/* Col 1: Name + subtitle */}
        <div className="med-col-name">
          <div className="med-name">{m.name}</div>
          <div className="med-sub">
            {sub}
            {m.pharmacy && <span className="med-pharm-in-sub"> · {m.pharmacy}</span>}
          </div>
        </div>

        {/* Col 2: Pills + bar  (hidden on mobile) */}
        <div className="med-col-pills">
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
        </div>

        {/* Col 3: Status pill  (on mobile also contains mini pills) */}
        <div className="med-col-status">
          <span className={`spill sp-${pillSt}`}>{lbl}</span>
          <div className="med-mobile-pills">
            <span className={`med-mobile-count ${pc}`}>
              {p.rem}<span className="med-mobile-of">/{p.tot}</span>
            </span>
            <div className="med-bar-mini">
              <div className="med-bar-mini-fill" style={{ width: pct + '%', background: bc }} />
            </div>
          </div>
        </div>

        {/* Col 4: Refill date  (hidden on tablet + mobile) */}
        <div className="med-col-date">{rd}</div>

        {/* Col 5: Pharmacy  (hidden on tablet + mobile) */}
        <div className="med-col-pharm">{m.pharmacy || '—'}</div>

        {/* Col 6: ⋯ menu  (hidden on mobile — actions live in drawer) */}
        <div className="med-col-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button
            className="med-menu-btn"
            onClick={() => { setMenuOpen(o => !o); setConfirming(false) }}
            title="Options"
          >
            ···
          </button>
          {menuOpen && (
            <div className="med-menu-pop">
              <button className="med-menu-item" onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(m.id) }}>
                Edit
              </button>
              <button className="med-menu-item" onClick={handleRefill}>
                Mark refilled
              </button>
              <button
                className={`med-menu-item${confirming ? ' danger confirm' : ' danger'}`}
                onClick={handleDelete}
              >
                {confirming ? 'Confirm delete?' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile inline drawer ── */}
      <div className={`med-drawer${isExpanded ? ' open' : ''}`}>
        <div className="med-drawer-inner">
          <div className="med-drawer-actions">
            {m.pharmacy && (
              <a
                className="btn-call"
                href={callHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                {callHref ? `Find ${m.pharmacy}` : m.pharmacy}
              </a>
            )}
            <button
              className="btn-ghost"
              style={{ flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); onEdit(m.id) }}
            >
              Edit
            </button>
          </div>
          <div className="med-drawer-details">
            {m.pharmacy && (
              <div className="med-drawer-item">
                <span className="med-drawer-lbl">Pharmacy</span>
                <span className="med-drawer-val">{m.pharmacy}</span>
              </div>
            )}
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Refill date</span>
              <span className="med-drawer-val">{rd}</span>
            </div>
            <div className="med-drawer-item">
              <span className="med-drawer-lbl">Supply</span>
              <span className="med-drawer-val">{p.rem} / {p.tot} pills</span>
            </div>
            {fl && (
              <div className="med-drawer-item">
                <span className="med-drawer-lbl">Schedule</span>
                <span className="med-drawer-val">{fl}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
