import { useState } from 'react'
import { today } from '../../lib/medUtils'
import { aptStatus } from '../../lib/aptUtils'

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function MiniCalendar({ apts, onPastExpand }) {
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  function changeMonth(dir) {
    setCalMonth(m => {
      let next = m + dir
      if (next > 11) { setCalYear(y => y + 1); return 0 }
      if (next < 0)  { setCalYear(y => y - 1); return 11 }
      return next
    })
  }

  const monthLabel = new Date(calYear, calMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Build dotMap: "YYYY-M-D" → Set of assignees
  const dotMap = {}
  apts.forEach(a => {
    if (!a.dateTime) return
    const d = new Date(a.dateTime)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    if (!dotMap[key]) dotMap[key] = new Set()
    const c = a.covering || 'tbd'
    if (c === 'both') { dotMap[key].add('fanuel'); dotMap[key].add('saron') }
    else dotMap[key].add(c)
  })

  const firstDow = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const todayObj = today()

  function handleDayClick(d) {
    const key = `${calYear}-${calMonth + 1}-${d}`
    if (!dotMap[key]) return

    const matches = apts.filter(a => {
      if (!a.dateTime) return false
      const dt = new Date(a.dateTime)
      return dt.getFullYear() === calYear && dt.getMonth() + 1 === calMonth + 1 && dt.getDate() === d
    })
    if (!matches.length) return

    const hasPast = matches.some(a => aptStatus(a) === 'past')
    if (hasPast && onPastExpand) onPastExpand()

    setTimeout(() => {
      const card = document.querySelector(`[data-apt-id="${matches[0].id}"]`)
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`empty-${i}`} className="cal-day empty" />)

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${calMonth + 1}-${d}`
    const isToday = d === todayObj.getDate() && calMonth === todayObj.getMonth() && calYear === todayObj.getFullYear()
    const assignees = dotMap[key]
    const isPast = !isToday && (calYear < todayObj.getFullYear() || (calYear === todayObj.getFullYear() && calMonth < todayObj.getMonth()))

    const cls = ['cal-day', isToday && 'today', assignees && 'has-apt', isPast && 'faded'].filter(Boolean).join(' ')

    cells.push(
      <div key={d} className={cls} onClick={() => handleDayClick(d)}>
        <div className="cal-day-num">{d}</div>
        {assignees && (
          <div className="cal-dots">
            {[...assignees].map(a => <div key={a} className={`cal-dot ${a}`} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mini-cal">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
      </div>
      <div className="cal-grid">
        {DAYS_OF_WEEK.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells}
      </div>
    </div>
  )
}
