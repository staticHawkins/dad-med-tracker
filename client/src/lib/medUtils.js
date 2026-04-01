export function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

export function pillsNow(m) {
  const freq = parseFloat(m.frequency) || 1
  const supply = parseInt(m.supply) || 30
  const filledDate = m.filledDate ? new Date(m.filledDate + 'T00:00:00') : null
  if (!filledDate) return { rem: supply, tot: supply, runOutDate: null, daysToZero: 999 }
  const elapsed = Math.max(0, daysBetween(filledDate, today()))
  const consumed = Math.min(Math.round(elapsed * freq), supply)
  const rem = supply - consumed
  const daysToZero = freq > 0 ? Math.ceil((supply - consumed) / freq) : 999
  const runOutDate = new Date(today())
  runOutDate.setDate(today().getDate() + daysToZero)
  return { rem, tot: supply, runOutDate, daysToZero }
}

export function getRefillDate(m) {
  if (m.refillDate) return new Date(m.refillDate + 'T00:00:00')
  return pillsNow(m).runOutDate
}

const REFILL_LEAD = 7

export function st(m) {
  const p = pillsNow(m)
  if (p.rem <= 0) return 'urgent'
  if (p.daysToZero <= 3) return 'urgent'
  if (p.daysToZero <= REFILL_LEAD) return 'soon'
  return 'ok'
}

export function stLabel(m) {
  const p = pillsNow(m)
  if (p.rem <= 0) return 'Out of pills'
  const d = p.daysToZero
  if (d <= 0) return 'Out of pills'
  if (d <= 3) return d === 1 ? 'Refill today' : 'Refill in ' + d + 'd'
  if (d <= REFILL_LEAD) return 'Refill in ' + d + 'd'
  return 'OK — ' + d + 'd left'
}

export function pillStatusClass(rem, tot) {
  const pct = tot > 0 ? rem / tot : 0
  if (rem <= 0) return 'zero'
  if (pct < 0.25) return 'low'
  return 'ok'
}

export function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string') d = new Date(d + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
