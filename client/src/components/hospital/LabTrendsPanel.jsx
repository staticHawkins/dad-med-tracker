import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const FLAG_COLOR = { N: '#4caf80', H: '#d4872a', L: '#d4872a', C: '#c0605a' }
const FLAG_LABEL = { N: 'Normal', H: 'High', L: 'Low', C: 'Critical' }

function fmtDate(str) {
  if (!str) return ''
  const [, m, d] = str.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

function CustomDot({ cx, cy, payload }) {
  const color = FLAG_COLOR[payload.flag] || '#5C8CFF'
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--panel)" strokeWidth={2} />
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="lab-tooltip">
      <div className="lab-tooltip-date">{fmtDate(d.date)}</div>
      <div className="lab-tooltip-value">{d.value} {d.unit}</div>
      {d.refLow != null && d.refHigh != null && (
        <div className="lab-tooltip-range">Ref: {d.refLow}–{d.refHigh}</div>
      )}
      <div className="lab-tooltip-flag" style={{ color: FLAG_COLOR[d.flag] || '#888' }}>
        {FLAG_LABEL[d.flag] || ''}
      </div>
    </div>
  )
}

function buildDomain(points) {
  const values = points.map(p => p.value)
  const refLow = points.find(p => p.refLow != null)?.refLow
  const refHigh = points.find(p => p.refHigh != null)?.refHigh
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const spread = maxV - minV || maxV * 0.1 || 1
  const pad = spread * 0.6
  const yMin = Math.max(0, parseFloat((minV - pad).toFixed(2)))
  const yMax = parseFloat((maxV + pad).toFixed(2))
  const bandY1 = refLow != null ? Math.max(yMin, refLow) : null
  const bandY2 = refHigh != null ? Math.min(yMax, refHigh) : null
  return {
    yMin, yMax, refLow, refHigh,
    showBand: bandY1 != null && bandY2 != null && bandY1 < bandY2,
    bandY1, bandY2,
    showRefLowLine: refLow != null && refLow >= yMin && refLow <= yMax,
    showRefHighLine: refHigh != null && refHigh >= yMin && refHigh <= yMax,
  }
}

function Chart({ name, unit, points, height, margin, onExpand }) {
  const { yMin, yMax, showBand, bandY1, bandY2, refLow, refHigh, showRefLowLine, showRefHighLine } = buildDomain(points)
  return (
    <div className="metric-chart-wrap" onClick={onExpand} style={{ cursor: onExpand ? 'pointer' : 'default' }}>
      <div className="metric-chart-title">
        {name} {unit ? <span className="metric-chart-unit">({unit})</span> : null}
        {onExpand && <span className="metric-chart-expand">⤢</span>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {showBand && <ReferenceArea y1={bandY1} y2={bandY2} fill="#4caf80" fillOpacity={0.1} stroke="none" />}
          {showRefLowLine && (
            <ReferenceLine y={refLow} stroke="#4caf80" strokeDasharray="4 3" strokeOpacity={0.6} strokeWidth={1}
              label={{ value: refLow, position: 'insideTopLeft', fontSize: 9, fill: '#4caf80', opacity: 0.7 }} />
          )}
          {showRefHighLine && (
            <ReferenceLine y={refHigh} stroke="#4caf80" strokeDasharray="4 3" strokeOpacity={0.6} strokeWidth={1}
              label={{ value: refHigh, position: 'insideBottomLeft', fontSize: 9, fill: '#4caf80', opacity: 0.7 }} />
          )}
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="value" stroke="#5C8CFF" strokeWidth={2} dot={<CustomDot />} activeDot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExpandedModal({ metric, onClose }) {
  const refLow = metric.points.find(p => p.refLow != null)?.refLow
  const refHigh = metric.points.find(p => p.refHigh != null)?.refHigh
  const unit = metric.unit

  return (
    <div className="lab-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lab-modal">
        <div className="lab-modal-header">
          <span className="lab-modal-title">{metric.name} {unit ? `(${unit})` : ''}</span>
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {refLow != null && refHigh != null && (
          <div className="lab-modal-ref">
            Normal range: <strong>{refLow}–{refHigh} {unit}</strong>
          </div>
        )}
        <Chart name={metric.name} unit={metric.unit} points={metric.points} height={280} margin={{ top: 12, right: 16, bottom: 4, left: -8 }} />
        <div className="lab-modal-table">
          <div className="lab-modal-row lab-modal-row--head">
            <span>Date</span><span>Value</span><span>Status</span>
          </div>
          {[...metric.points].reverse().map((p, i) => {
            const color = FLAG_COLOR[p.flag] || '#888'
            return (
              <div key={i} className="lab-modal-row">
                <span>{fmtDate(p.date)}</span>
                <span style={{ fontWeight: 600 }}>{p.value} {p.unit}</span>
                <span style={{ color, fontWeight: 600 }}>{FLAG_LABEL[p.flag] || '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function LabTrendsPanel({ testResults }) {
  const [expanded, setExpanded] = useState(null)

  function normalizeKey(name) {
    return name.replace(/\s*\(.*?\)/g, '').trim().toUpperCase()
  }

  const metricMap = {}
  for (const result of testResults) {
    if (!Array.isArray(result.labValues) || result.labValues.length === 0) continue
    for (const lv of result.labValues) {
      if (lv.value == null || lv.name == null) continue
      const key = normalizeKey(lv.name)
      if (!metricMap[key]) metricMap[key] = { name: lv.name, unit: lv.unit || '', points: [] }
      else if (lv.name.length < metricMap[key].name.length) metricMap[key].name = lv.name
      metricMap[key].points.push({
        date: result.date,
        value: lv.value,
        unit: lv.unit || '',
        refLow: lv.refLow ?? null,
        refHigh: lv.refHigh ?? null,
        flag: lv.flag || 'N',
      })
    }
  }

  const charts = Object.values(metricMap)
    .map(m => ({ ...m, points: [...m.points].sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter(m => m.points.length >= 1)

  if (charts.length === 0) return null

  return (
    <>
      <div className="lab-trends-panel">
        <div className="lab-trends-title">Lab Trends</div>
        <div className="lab-trends-grid">
          {charts.map(m => (
            <Chart
              key={m.name} name={m.name} unit={m.unit} points={m.points}
              height={140} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              onExpand={() => setExpanded(m)}
            />
          ))}
        </div>
      </div>
      {expanded && <ExpandedModal metric={expanded} onClose={() => setExpanded(null)} />}
    </>
  )
}
