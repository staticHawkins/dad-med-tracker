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

export function exportToICS(apt) {
  const start = new Date(apt.dateTime)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const toICSDate = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dad Med Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${apt.id}@dad-med-tracker`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${icsEsc(apt.title || 'Appointment')}`,
  ]

  if (apt.location) lines.push(`LOCATION:${icsEsc(apt.location)}`)

  const descParts = []
  if (apt.doctor) descParts.push(`Doctor: ${apt.doctor}`)
  if (apt.prep) descParts.push(`Prep: ${apt.prep}`)
  if (apt.postNotes) descParts.push(`Notes: ${apt.postNotes}`)
  if (descParts.length) lines.push(`DESCRIPTION:${icsEsc(descParts.join('\n'))}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(apt.title || 'appointment').replace(/\s+/g, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

