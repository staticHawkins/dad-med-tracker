import PhaseStrip from './PhaseStrip'
import MilestoneRow from './MilestoneRow'

const OUTCOME_COLOR = {
  Active:      '#3cbf7a',
  Stabilized:  '#3cbf7a',
  Progression: '#e55b4d',
  Failure:     '#e55b4d',
}

const TIER_LABELS = {
  pre:   'Emergency',
  line1: '1st line',
  line2: '2nd line',
  line3: '3rd line',
  line4: '4th line',
}

function PhaseCard({ phase }) {
  const outcomeColor = OUTCOME_COLOR[phase.outcome] || '#9ba3b8'
  return (
    <div className="tl-phase-card" style={{ '--phase-color': phase.color }}>
      <div className="tl-phase-tier">{TIER_LABELS[phase.key] || phase.key}</div>
      <div className="tl-phase-name">{phase.shortLabel}</div>
      <div className="tl-phase-period">{phase.period}</div>
      <div className="tl-phase-outcome" style={{ color: outcomeColor }}>{phase.outcome}</div>
      <div className="tl-phase-bottom-border" style={{ background: phase.color }} />
    </div>
  )
}

export default function TimelineView({ milestones, phases }) {
  return (
    <div className="page tl-page">
      {/* Patient header */}
      <div className="tl-patient-header">
        <div className="tl-patient-name">Guangul Zekiros</div>
        <div className="tl-patient-meta">
          DOB Aug 28, 1956 · Age 69 &nbsp;|&nbsp; MRN 1394784 &nbsp;|&nbsp;
          Referring Dr. Amar Gupta &nbsp;|&nbsp; PMH Hypertension · HCV (treated) · BPH
        </div>
        <div className="tl-header-divider" />
      </div>

      {/* Diagnosis block */}
      <div className="tl-diag-block">
        <div>
          <div className="tl-diag-label">Primary diagnosis</div>
          <div className="tl-diag-value">Mixed HCC / Cholangiocarcinoma</div>
        </div>
        <div>
          <div className="tl-diag-label">Staging</div>
          <div className="tl-diag-value">T4 · Stage IIIB+ · BCLC-B/C</div>
        </div>
        <div>
          <div className="tl-diag-label">Disease onset</div>
          <div className="tl-diag-value">Ruptured HCC · Oct 12, 2024</div>
        </div>
        <div>
          <div className="tl-diag-label">Notes reviewed</div>
          <div className="tl-diag-value">30 notes · Oct 2024 – Mar 2026</div>
        </div>
      </div>

      {/* Treatment phases strip */}
      <div className="tl-phases-strip">
        {phases.length === 0
          ? ['pre','line1','line2','line3','line4'].map(k => (
              <div key={k} className="tl-phase-card tl-phase-card-empty" />
            ))
          : phases.map(p => <PhaseCard key={p.key} phase={p} />)
        }
      </div>

      {/* Milestones section */}
      <div className="tl-section-label">Clinical Milestones — Most Recent First</div>

      <div className="tl-milestones-list">
        {milestones.length === 0 ? (
          <div className="tl-body" style={{ padding: '16px 0' }}>
            No milestones yet. Call <code>seedTimeline()</code> in the browser console to load data.
          </div>
        ) : (
          milestones.map((m, i) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              showConnector={i < milestones.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}
