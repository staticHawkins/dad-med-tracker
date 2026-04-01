import { describe, it, expect, beforeEach, vi } from 'vitest'
import { aptStatus, fmtAptDateBlock, fmtAptTime, coveringLabel, typeLabel } from '../lib/aptUtils'

const FIXED_TODAY = new Date('2026-03-31T12:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── aptStatus ─────────────────────────────────────────────────────────────────

describe('aptStatus', () => {
  it('returns past for a past date', () => {
    expect(aptStatus({ dateTime: '2026-03-01T10:00:00' })).toBe('past')
  })

  it('returns today for today before end of day', () => {
    expect(aptStatus({ dateTime: '2026-03-31T14:00:00' })).toBe('today')
  })

  it('returns soon for within 7 days', () => {
    expect(aptStatus({ dateTime: '2026-04-05T10:00:00' })).toBe('soon')
  })

  it('returns upcoming for beyond 7 days', () => {
    expect(aptStatus({ dateTime: '2026-04-15T10:00:00' })).toBe('upcoming')
  })
})

// ── fmtAptDateBlock ───────────────────────────────────────────────────────────

describe('fmtAptDateBlock', () => {
  it('returns correct month and day', () => {
    const { month, day } = fmtAptDateBlock('2026-03-31T10:00:00')
    expect(month).toBe('Mar')
    expect(day).toBe(31)
  })

  it('returns placeholder for empty string', () => {
    const { month, day } = fmtAptDateBlock('')
    expect(month).toBe('—')
    expect(day).toBe('—')
  })
})

// ── fmtAptTime ────────────────────────────────────────────────────────────────

describe('fmtAptTime', () => {
  it('returns empty string for midnight (all-day)', () => {
    expect(fmtAptTime('2026-03-31T00:00:00')).toBe('')
  })

  it('returns formatted time for a non-midnight time', () => {
    const result = fmtAptTime('2026-03-31T14:30:00')
    expect(result).toContain('2:30')
    expect(result).toContain('PM')
  })

  it('returns empty string for falsy input', () => {
    expect(fmtAptTime('')).toBe('')
  })
})

// ── coveringLabel ─────────────────────────────────────────────────────────────

describe('coveringLabel', () => {
  it('maps known values', () => {
    expect(coveringLabel('fanuel')).toBe('Fanuel')
    expect(coveringLabel('saron')).toBe('Saron')
    expect(coveringLabel('both')).toBe('Both')
    expect(coveringLabel('tbd')).toBe('TBD')
  })

  it('returns TBD for unknown values', () => {
    expect(coveringLabel('')).toBe('TBD')
    expect(coveringLabel(undefined)).toBe('TBD')
  })
})

// ── typeLabel ─────────────────────────────────────────────────────────────────

describe('typeLabel', () => {
  it('maps known types', () => {
    expect(typeLabel('checkup')).toBe('Checkup')
    expect(typeLabel('specialist')).toBe('Specialist')
    expect(typeLabel('lab')).toBe('Lab')
    expect(typeLabel('imaging')).toBe('Imaging')
    expect(typeLabel('other')).toBe('Other')
  })

  it('returns empty string for unknown types', () => {
    expect(typeLabel('')).toBe('')
    expect(typeLabel(undefined)).toBe('')
  })
})
