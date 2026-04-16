import MilestoneTag from './MilestoneTag'

const DOT_STYLE = {
  green:  { background: '#3cbf7a' },
  red:    { background: '#e55b4d' },
  filled: { background: '#e8eaf0' },
  hollow: { background: 'transparent', border: '1px solid rgba(255,255,255,0.25)' },
  amber:  { background: '#e09340' },
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    monthDay: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    year: String(y),
    full: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}

// Desktop layout: date left col | dot+line center | content right
function DesktopRow({ milestone, showConnector }) {
  const { monthDay, year } = fmtDate(milestone.date)
  const dotStyle = DOT_STYLE[milestone.dot] || DOT_STYLE.filled
  return (
    <div className="tl-row">
      <div className="tl-left">
        <div className="tl-date-main">{monthDay}<br />{year}</div>
      </div>
      <div className="tl-mid">
        <div className="tl-dot" style={dotStyle} />
        {showConnector && <div className="tl-connector" />}
      </div>
      <div className="tl-content">
        {milestone.tags && milestone.tags.length > 0 && (
          <div className="tl-tags">
            {milestone.tags.map((t, i) => (
              <MilestoneTag key={i} label={t.label} type={t.type} />
            ))}
          </div>
        )}
        <div className="tl-title">{milestone.title}</div>
        <div className="tl-body">{milestone.summary}</div>
      </div>
    </div>
  )
}

// Mobile layout: dot left | content block (date inline at top)
function MobileRow({ milestone }) {
  const { full } = fmtDate(milestone.date)
  const dotStyle = DOT_STYLE[milestone.dot] || DOT_STYLE.filled
  return (
    <div className="tl-row-mobile">
      <div className="tl-dot" style={{ ...dotStyle, flexShrink: 0, marginTop: 3 }} />
      <div className="tl-content" style={{ paddingLeft: 0 }}>
        <div className="tl-date-inline">{full}</div>
        {milestone.tags && milestone.tags.length > 0 && (
          <div className="tl-tags">
            {milestone.tags.map((t, i) => (
              <MilestoneTag key={i} label={t.label} type={t.type} />
            ))}
          </div>
        )}
        <div className="tl-title">{milestone.title}</div>
        <div className="tl-body">{milestone.summary}</div>
      </div>
    </div>
  )
}

export default function MilestoneRow({ milestone, showConnector = true, mobile = false }) {
  if (mobile) return <MobileRow milestone={milestone} />
  return <DesktopRow milestone={milestone} showConnector={showConnector} />
}
