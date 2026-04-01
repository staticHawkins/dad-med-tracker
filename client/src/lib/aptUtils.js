import { today } from './medUtils'

export function aptStatus(a) {
  const dt = new Date(a.dateTime)
  const t = today()
  const todayEnd = new Date(t); todayEnd.setHours(23, 59, 59, 999)
  const weekEnd = new Date(t); weekEnd.setDate(t.getDate() + 7)
  if (dt < t) return 'past'
  if (dt <= todayEnd) return 'today'
  if (dt <= weekEnd) return 'soon'
  return 'upcoming'
}

export function fmtAptDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const dayPart = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${timePart} · ${dayPart}`
}

export function fmtAptDateBlock(str) {
  if (!str) return { month: '—', day: '—' }
  const d = new Date(str)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: d.getDate()
  }
}

export function fmtAptTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (d.getHours() === 0 && d.getMinutes() === 0) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function coveringLabel(c) {
  return { fanuel: 'Fanuel', saron: 'Saron', both: 'Both', tbd: 'TBD' }[c] || 'TBD'
}

export function typeLabel(t) {
  return { checkup: 'Checkup', specialist: 'Specialist', lab: 'Lab', imaging: 'Imaging', other: 'Other' }[t] || ''
}
