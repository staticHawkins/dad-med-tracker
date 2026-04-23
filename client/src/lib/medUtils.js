export function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function todayStr() {
  const d = today()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

export function freqPerDay(m) {
  const preset = m.frequencyPreset
  if (preset === 'as-needed') return null
  if (preset === 'once-daily')      return 1
  if (preset === 'twice-daily')     return 2
  if (preset === 'every-other-day') return 0.5
  if (preset === 'custom') {
    const count = parseFloat(m.frequencyCustomCount) || 1
    const every = parseFloat(m.frequencyCustomEvery) || 1
    const unit  = m.frequencyCustomUnit === 'weeks' ? 7 : 1
    return count / (every * unit)
  }
  // legacy: plain frequency number
  return parseFloat(m.frequency) || 1
}

export function freqLabel(m) {
  const preset = m.frequencyPreset
  if (preset === 'once-daily')      return '1× daily'
  if (preset === 'twice-daily')     return '2× daily'
  if (preset === 'every-other-day') return 'Every other day'
  if (preset === 'as-needed')       return 'As needed'
  if (preset === 'custom') {
    const count = m.frequencyCustomCount || 1
    const every = m.frequencyCustomEvery || 1
    const unit  = m.frequencyCustomUnit || 'days'
    const u = every === 1 || every === '1' ? unit.replace(/s$/, '') : unit
    return `${count}× every ${every} ${u}`
  }
  // legacy
  const f = parseFloat(m.frequency)
  if (!f) return ''
  if (f === 1)   return '1× daily'
  if (f === 2)   return '2× daily'
  if (f === 0.5) return 'Every other day'
  return `${f}× daily`
}

export function pillsNow(m) {
  const freq = freqPerDay(m)
  const supply = parseInt(m.supply) || 30
  const filledDate = m.filledDate ? new Date(m.filledDate + 'T00:00:00') : null
  if (!filledDate) return { rem: supply, tot: supply, runOutDate: null, daysToZero: 999 }
  if (freq === null) {
    // as-needed: track pills only, no runout math
    return { rem: supply, tot: supply, runOutDate: null, daysToZero: 999 }
  }
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

const REFILL_LEAD = 14

export function supplyStatus(m) {
  const p = pillsNow(m)
  if (p.rem <= 0) return 'urgent'
  if (p.daysToZero <= 7) return 'urgent'
  if (p.daysToZero <= REFILL_LEAD) return 'soon'
  return 'ok'
}

export function supplyStatusLabel(m) {
  const p = pillsNow(m)
  if (p.rem <= 0) return 'Out of pills'
  const d = p.daysToZero
  if (d <= 0) return 'Out of pills'
  if (d <= 7) return d === 1 ? 'Refill today' : 'Refill in ' + d + 'd'
  if (d <= REFILL_LEAD) return 'Refill in ' + d + 'd'
  return 'OK — ' + d + 'd left'
}

export function refillStatusLabel(m) {
  const s = m.refillStatus
  if (!s) return null
  if (s === 'requested')     return 'Requested'
  if (s === 'ready-pickup')  return 'Ready · Pickup'
  if (s === 'ready-courier') return 'Ready · Courier'
  if (s === 'picked-up')     return 'Picked up'
  if (s === 'delivered')     return 'Delivered'
  return null
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
