// CommonJS port of client/src/lib/medUtils.js supply status logic.
// Thresholds must stay in sync with that file.

function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

function freqPerDay(m) {
  const preset = m.frequencyPreset
  if (preset === 'as-needed')       return null
  if (preset === 'once-daily')      return 1
  if (preset === 'twice-daily')     return 2
  if (preset === 'every-other-day') return 0.5
  if (preset === 'custom') {
    const count = parseFloat(m.frequencyCustomCount) || 1
    const every = parseFloat(m.frequencyCustomEvery) || 1
    const unit  = m.frequencyCustomUnit === 'weeks' ? 7 : 1
    return count / (every * unit)
  }
  return parseFloat(m.frequency) || 1
}

function pillsNow(m) {
  const freq    = freqPerDay(m)
  const supply  = parseInt(m.supply) || 30
  const filledDate = m.filledDate ? new Date(m.filledDate + 'T00:00:00') : null
  if (!filledDate) return { rem: supply, tot: supply, runOutDate: null, daysToZero: 999 }
  if (freq === null) return { rem: supply, tot: supply, runOutDate: null, daysToZero: 999 }
  const elapsed  = Math.max(0, daysBetween(filledDate, today()))
  const consumed = Math.min(Math.round(elapsed * freq), supply)
  const rem      = supply - consumed
  const daysToZero = freq > 0 ? Math.ceil(rem / freq) : 999
  const runOutDate = new Date(today())
  runOutDate.setDate(today().getDate() + daysToZero)
  return { rem, tot: supply, runOutDate, daysToZero }
}

const REFILL_LEAD = 14

function supplyStatus(m) {
  const p = pillsNow(m)
  if (p.rem <= 0)              return 'urgent'
  if (p.daysToZero <= 7)       return 'urgent'
  if (p.daysToZero <= REFILL_LEAD) return 'soon'
  return 'ok'
}

module.exports = { pillsNow, supplyStatus, REFILL_LEAD }
