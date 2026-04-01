import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MedsTable from '../components/meds/MedsTable'

const FIXED_TODAY = new Date('2026-03-31T00:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

const med1 = { id: '1', name: 'Metformin', dose: '500 mg', filledDate: '2026-03-31', supply: 30, frequency: 1, pharmacy: 'CVS' }
const med2 = { id: '2', name: 'Lisinopril', dose: '10 mg',  filledDate: '2026-03-31', supply: 5, frequency: 1, pharmacy: 'Walgreens' }

const noop = () => {}

describe('MedsTable', () => {
  it('shows empty state when no meds', () => {
    render(<MedsTable meds={[]} filter="all" search="" onEdit={noop} />)
    expect(screen.getByText(/No medications yet/)).toBeInTheDocument()
  })

  it('shows filter empty state when meds exist but none match filter', () => {
    render(<MedsTable meds={[med1]} filter="urgent" search="" onEdit={noop} />)
    expect(screen.getByText(/No medications match this filter/)).toBeInTheDocument()
  })

  it('renders medication names', () => {
    render(<MedsTable meds={[med1, med2]} filter="all" search="" onEdit={noop} />)
    expect(screen.getByText('Metformin')).toBeInTheDocument()
    expect(screen.getByText('Lisinopril')).toBeInTheDocument()
  })

  it('filters by search query', () => {
    render(<MedsTable meds={[med1, med2]} filter="all" search="cvs" onEdit={noop} />)
    expect(screen.getByText('Metformin')).toBeInTheDocument()
    expect(screen.queryByText('Lisinopril')).not.toBeInTheDocument()
  })

  it('renders status pills', () => {
    render(<MedsTable meds={[med2]} filter="all" search="" onEdit={noop} />)
    // med2 has 5 days supply → 'soon'
    expect(screen.getByText(/Refill in/)).toBeInTheDocument()
  })

  it('renders pharmacy column', () => {
    render(<MedsTable meds={[med1]} filter="all" search="" onEdit={noop} />)
    expect(screen.getByText('CVS')).toBeInTheDocument()
  })

  it('sorts urgent meds to the top', () => {
    const urgentMed = { id: '3', name: 'Urgent Drug', filledDate: '2026-03-29', supply: 2, frequency: 1 }
    render(<MedsTable meds={[med1, urgentMed]} filter="all" search="" onEdit={noop} />)
    const rows = document.querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('Urgent Drug')
  })
})
