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

function MetricChart({ name, unit, points }) {
  const values = points.map(p => p.value)
  const refLow = points.find(p => p.refLow != null)?.refLow
  const refHigh = points.find(p => p.refHigh != null)?.refHigh

  const allVals = [...values, refLow, refHigh].filter(v => v != null)
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad = (maxV - minV) * 0.25 || 1
  const yMin = Math.max(0, parseFloat((minV - pad).toFixed(2)))
  const yMax = parseFloat((maxV + pad).toFixed(2))

  return (
    <div className="metric-chart-wrap">
      <div className="metric-chart-title">
        {name} {unit ? <span className="metric-chart-unit">({unit})</span> : null}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {refLow != null && refHigh != null && (
            <ReferenceArea
              y1={refLow} y2={refHigh}
              fill="#4caf80" fillOpacity={0.08}
              stroke="none"
            />
          )}
          {refLow != null && (
            <ReferenceLine y={refLow} stroke="#4caf80" strokeDasharray="4 3" strokeOpacity={0.5} strokeWidth={1} />
          )}
          {refHigh != null && (
            <ReferenceLine y={refHigh} stroke="#4caf80" strokeDasharray="4 3" strokeOpacity={0.5} strokeWidth={1} />
          )}
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#5C8CFF"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function LabTrendsPanel({ testResults }) {
  // Collect data points per metric across all results that have labValues
  const metricMap = {}
  for (const result of testResults) {
    if (!Array.isArray(result.labValues) || result.labValues.length === 0) continue
    for (const lv of result.labValues) {
      if (lv.value == null || lv.name == null) continue
      const key = lv.name.toUpperCase()
      if (!metricMap[key]) metricMap[key] = { name: lv.name, unit: lv.unit || '', points: [] }
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

  // Sort each metric's points chronologically and keep only those with ≥2 points
  const charts = Object.values(metricMap)
    .map(m => ({ ...m, points: [...m.points].sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter(m => m.points.length >= 2)

  if (charts.length === 0) return null

  return (
    <div className="lab-trends-panel">
      <div className="lab-trends-title">Lab Trends</div>
      <div className="lab-trends-grid">
        {charts.map(m => (
          <MetricChart key={m.name} name={m.name} unit={m.unit} points={m.points} />
        ))}
      </div>
    </div>
  )
}
