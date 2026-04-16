const PHASE_FLEX = { pre: 1, line1: 8, line2: 3, line3: 3.5, line4: 2 }

export default function PhaseStrip({ phases }) {
  if (!phases || phases.length === 0) return <div className="tl-phase-strip" />
  return (
    <div className="tl-phase-strip">
      {phases.map(p => (
        <div
          key={p.key}
          className="tl-phase-seg"
          style={{ flex: PHASE_FLEX[p.key] || 1, background: p.color }}
          title={p.shortLabel}
        />
      ))}
    </div>
  )
}
