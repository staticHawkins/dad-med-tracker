import { st } from '../../lib/medUtils'

export default function KPIRow({ meds }) {
  const urgent = meds.filter(m => st(m) === 'urgent')
  const soon   = meds.filter(m => st(m) === 'soon')
  const ok     = meds.filter(m => st(m) === 'ok')

  return (
    <div className="kpi-row">
      <div className="kpi kpi-total">
        <div className="kpi-num">{meds.length}</div>
        <div className="kpi-lbl">Total medications</div>
      </div>
      <div className="kpi kpi-urgent">
        <div className="kpi-num">{urgent.length}</div>
        <div className="kpi-lbl">Refill within 3 days</div>
        {urgent.length > 0 && (
          <div className="kpi-sub">{urgent.map(m => m.name).join(', ')}</div>
        )}
      </div>
      <div className="kpi kpi-soon">
        <div className="kpi-num">{soon.length}</div>
        <div className="kpi-lbl">Refill this week</div>
      </div>
      <div className="kpi kpi-ok">
        <div className="kpi-num">{ok.length}</div>
        <div className="kpi-lbl">Stocked up (8+ days)</div>
      </div>
    </div>
  )
}
