import { describe, it, expect, beforeEach, vi } from 'vitest'
import { pillsNow, st, stLabel, pillStatusClass, fmtDate, today, freqPerDay, freqLabel } from '../lib/medUtils'

// Pin "today" to a fixed date for deterministic tests
const FIXED_TODAY = new Date('2026-03-31T00:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// ── freqPerDay ────────────────────────────────────────────────────────────────

describe('freqPerDay', () => {
  it('returns 1 for once-daily', () => {
    expect(freqPerDay({ frequencyPreset: 'once-daily' })).toBe(1)
  })
  it('returns 2 for twice-daily', () => {
    expect(freqPerDay({ frequencyPreset: 'twice-daily' })).toBe(2)
  })
  it('returns 0.5 for every-other-day', () => {
    expect(freqPerDay({ frequencyPreset: 'every-other-day' })).toBe(0.5)
  })
  it('returns null for as-needed', () => {
    expect(freqPerDay({ frequencyPreset: 'as-needed' })).toBeNull()
  })
  it('computes custom daily rate', () => {
    expect(freqPerDay({ frequencyPreset: 'custom', frequencyCustomCount: '1', frequencyCustomEvery: '3', frequencyCustomUnit: 'days' }))
      .toBeCloseTo(1/3)
  })
  it('computes custom weekly rate', () => {
    expect(freqPerDay({ frequencyPreset: 'custom', frequencyCustomCount: '1', frequencyCustomEvery: '2', frequencyCustomUnit: 'weeks' }))
      .toBeCloseTo(1/14)
  })
  it('falls back to legacy frequency number', () => {
    expect(freqPerDay({ frequency: 1.5 })).toBe(1.5)
  })
})

// ── freqLabel ─────────────────────────────────────────────────────────────────

describe('freqLabel', () => {
  it('labels once-daily', () => expect(freqLabel({ frequencyPreset: 'once-daily' })).toBe('1× daily'))
  it('labels twice-daily', () => expect(freqLabel({ frequencyPreset: 'twice-daily' })).toBe('2× daily'))
  it('labels every-other-day', () => expect(freqLabel({ frequencyPreset: 'every-other-day' })).toBe('Every other day'))
  it('labels as-needed', () => expect(freqLabel({ frequencyPreset: 'as-needed' })).toBe('As needed'))
  it('labels custom', () => {
    expect(freqLabel({ frequencyPreset: 'custom', frequencyCustomCount: '2', frequencyCustomEvery: '3', frequencyCustomUnit: 'days' }))
      .toBe('2× every 3 days')
  })
  it('labels legacy frequency=1', () => expect(freqLabel({ frequency: 1 })).toBe('1× daily'))
  it('labels legacy frequency=0.5', () => expect(freqLabel({ frequency: 0.5 })).toBe('Every other day'))
})

// ── pillsNow ──────────────────────────────────────────────────────────────────

describe('pillsNow', () => {
  it('returns full supply when filled today', () => {
    const med = { filledDate: '2026-03-31', supply: 30, frequency: 1 }
    const { rem, tot, daysToZero } = pillsNow(med)
    expect(rem).toBe(30)
    expect(tot).toBe(30)
    expect(daysToZero).toBe(30)
  })

  it('subtracts consumed pills based on elapsed days', () => {
    const med = { filledDate: '2026-03-21', supply: 30, frequency: 1 } // 10 days ago
    const { rem, daysToZero } = pillsNow(med)
    expect(rem).toBe(20)
    expect(daysToZero).toBe(20)
  })

  it('does not go below 0 remaining', () => {
    const med = { filledDate: '2026-01-01', supply: 10, frequency: 1 } // way in the past
    const { rem } = pillsNow(med)
    expect(rem).toBe(0)
  })

  it('handles fractional frequency (0.5 pills/day)', () => {
    const med = { filledDate: '2026-03-31', supply: 30, frequency: 0.5 }
    const { daysToZero } = pillsNow(med)
    expect(daysToZero).toBe(60)
  })

  it('returns full supply when no filledDate', () => {
    const med = { supply: 30, frequency: 1 }
    const { rem, tot } = pillsNow(med)
    expect(rem).toBe(30)
    expect(tot).toBe(30)
  })

  it('as-needed: returns supply unchanged regardless of elapsed days', () => {
    const med = { frequencyPreset: 'as-needed', filledDate: '2026-03-01', supply: 30 }
    const { rem, tot, runOutDate, daysToZero } = pillsNow(med)
    expect(rem).toBe(30)
    expect(tot).toBe(30)
    expect(runOutDate).toBeNull()
    expect(daysToZero).toBe(999)
  })
})

// ── st ────────────────────────────────────────────────────────────────────────

describe('st', () => {
  it('returns urgent when 0 pills remain', () => {
    const med = { filledDate: '2026-01-01', supply: 10, frequency: 1 }
    expect(st(med)).toBe('urgent')
  })

  it('returns urgent when ≤3 days remain', () => {
    const med = { filledDate: '2026-03-29', supply: 30, frequency: 10 } // ~2 days left
    expect(st(med)).toBe('urgent')
  })

  it('returns soon when 4–7 days remain', () => {
    const med = { filledDate: '2026-03-31', supply: 5, frequency: 1 } // 5 days
    expect(st(med)).toBe('soon')
  })

  it('returns ok when 8+ days remain', () => {
    const med = { filledDate: '2026-03-31', supply: 30, frequency: 1 } // 30 days
    expect(st(med)).toBe('ok')
  })
})

// ── stLabel ───────────────────────────────────────────────────────────────────

describe('stLabel', () => {
  it('returns "Out of pills" when rem is 0', () => {
    const med = { filledDate: '2026-01-01', supply: 5, frequency: 1 }
    expect(stLabel(med)).toBe('Out of pills')
  })

  it('returns "Refill today" when 1 day remains', () => {
    const med = { filledDate: '2026-03-31', supply: 1, frequency: 1 }
    expect(stLabel(med)).toBe('Refill today')
  })

  it('returns "Refill in Xd" for urgent multi-day', () => {
    const med = { filledDate: '2026-03-31', supply: 3, frequency: 1 }
    expect(stLabel(med)).toBe('Refill in 3d')
  })

  it('returns "OK — Xd left" when stocked', () => {
    const med = { filledDate: '2026-03-31', supply: 30, frequency: 1 }
    expect(stLabel(med)).toBe('OK — 30d left')
  })
})

// ── pillStatusClass ───────────────────────────────────────────────────────────

describe('pillStatusClass', () => {
  it('returns zero when rem is 0', () => {
    expect(pillStatusClass(0, 30)).toBe('zero')
  })

  it('returns low when rem < 25% of total', () => {
    expect(pillStatusClass(7, 30)).toBe('low')
  })

  it('returns ok when rem >= 25% of total', () => {
    expect(pillStatusClass(8, 30)).toBe('ok')
    expect(pillStatusClass(30, 30)).toBe('ok')
  })
})

// ── fmtDate ───────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('returns — for falsy values', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('')).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
  })

  it('formats a date string correctly', () => {
    const result = fmtDate('2026-03-31')
    expect(result).toContain('Mar')
    expect(result).toContain('31')
    expect(result).toContain('2026')
  })

  it('formats a Date object correctly', () => {
    const result = fmtDate(new Date('2026-01-15T00:00:00'))
    expect(result).toContain('Jan')
    expect(result).toContain('15')
  })
})
