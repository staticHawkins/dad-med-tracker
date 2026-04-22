import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import KPIRow from '../components/meds/KPIRow'

const FIXED_TODAY = new Date('2026-03-31T00:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

const urgentMed   = { id: '1', name: 'Metformin', filledDate: '2026-03-29', supply: 3, frequency: 1 }
const soonMed     = { id: '2', name: 'Lisinopril', filledDate: '2026-03-31', supply: 10, frequency: 1 }
const okMed       = { id: '3', name: 'Atorvastatin', filledDate: '2026-03-31', supply: 30, frequency: 1 }

describe('KPIRow', () => {
  it('shows correct total count', () => {
    render(<KPIRow meds={[urgentMed, soonMed, okMed]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Total medications')).toBeInTheDocument()
  })

  it('shows correct urgent count', () => {
    render(<KPIRow meds={[urgentMed, soonMed, okMed]} />)
    const urgentCard = screen.getByText('Refill within 7 days').closest('.kpi-urgent')
    expect(urgentCard.querySelector('.kpi-num').textContent).toBe('1')
  })

  it('shows urgent med names when urgent > 0', () => {
    render(<KPIRow meds={[urgentMed, okMed]} />)
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('shows 0 urgent when all meds are stocked', () => {
    render(<KPIRow meds={[okMed]} />)
    expect(screen.getByText('Refill within 7 days')).toBeInTheDocument()
    // Urgent count should be 0
    const urgentCard = screen.getByText('Refill within 7 days').closest('.kpi-urgent')
    expect(urgentCard.querySelector('.kpi-num').textContent).toBe('0')
  })

  it('renders empty state with zeros for no meds', () => {
    render(<KPIRow meds={[]} />)
    const nums = document.querySelectorAll('.kpi-num')
    nums.forEach(n => expect(n.textContent).toBe('0'))
  })
})
