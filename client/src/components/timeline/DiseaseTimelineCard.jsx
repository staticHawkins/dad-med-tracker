import { useState, useEffect } from 'react'
import PhaseStrip from './PhaseStrip'
import MilestoneRow from './MilestoneRow'

const PHASE_COLORS = {
  pre:   '#6b7280',
  line1: '#4a7fd4',
  line2: '#1a8a66',
  line3: '#c08030',
  line4: '#c04040',
}
const PHASE_LABELS = {
  pre:   'Pre-tx',
  line1: 'STRIDE',
  line2: 'Cabo',
  line3: 'Ivosid',
  line4: 'GCD',
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width:640px)')
    const handler = e => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

export default function DiseaseTimelineCard({ milestones, phases, onViewTimeline }) {
  const isMobile = useIsMobile()
  const shown = isMobile ? milestones.slice(0, 1) : milestones.slice(0, 5)

  return (
    <button
      className="dash-card dash-card-timeline"
      onClick={onViewTimeline}
      aria-label="View Disease Timeline"
    >
      <div className="dash-card-header">
        <span className="dash-card-icon">⏱</span>
        <span className="dash-card-title">Disease Timeline</span>
        <span className="dash-card-arrow">›</span>
      </div>

      <PhaseStrip phases={phases} />

      <div className="tl-card-rows">
        {milestones.length === 0 ? (
          <div className="tl-body" style={{ padding: '8px 0' }}>No milestones yet.</div>
        ) : (
          shown.map((m, i) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              mobile={isMobile}
              showConnector={!isMobile && i < shown.length - 1}
            />
          ))
        )}
      </div>

      <div className="tl-card-footer">
        {isMobile ? (
          <>
            <span className="tl-footer-count">{milestones.length} milestones total</span>
            <span className="tl-footer-link" onClick={e => { e.stopPropagation(); onViewTimeline() }}>
              View full timeline ↗
            </span>
          </>
        ) : (
          <>
            <div className="tl-legend">
              {Object.entries(PHASE_COLORS).map(([key, color]) => (
                <span key={key} className="tl-legend-item">
                  <span className="tl-legend-dot" style={{ background: color }} />
                  <span className="tl-legend-label">{PHASE_LABELS[key]}</span>
                </span>
              ))}
            </div>
            <span className="tl-footer-link" onClick={e => { e.stopPropagation(); onViewTimeline() }}>
              View full timeline ↗
            </span>
          </>
        )}
      </div>
    </button>
  )
}
