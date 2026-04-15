import { st } from '../../lib/medUtils'

export default function KPIRow({ meds }) {
  const urgent = meds.filter(m => st(m) === 'urgent')
  const soon   = meds.filter(m => st(m) === 'soon')
  const ok     = meds.filter(m => st(m) === 'ok')

  return (
    <div className="kpi-row">
      <div className="kpi kpi-total">
        <div className="kpi-num">{meds.length}</div>
        <div className="kpi-lbl">
          <span className="lbl-full">Total medications</span>
          <span className="lbl-short">Total</span>
        </div>
      </div>
      <div className="kpi kpi-urgent">
        <div className="kpi-num">{urgent.length}</div>
        <div className="kpi-lbl">
          <span className="lbl-full">Refill within 3 days</span>
          <span className="lbl-short">Urgent</span>
        </div>
        {urgent.length > 0 && (
          <div className="kpi-sub">{urgent.map(m => m.name).join(', ')}</div>
        )}
      </div>
      <div className="kpi kpi-soon">
        <div className="kpi-num">{soon.length}</div>
        <div className="kpi-lbl">
          <span className="lbl-full">Refill this week</span>
          <span className="lbl-short">This week</span>
        </div>
      </div>
      <div className="kpi kpi-ok">
        <div className="kpi-num">{ok.length}</div>
        <div className="kpi-lbl">
          <span className="lbl-full">Stocked up</span>
          <span className="lbl-short">Stocked</span>
        </div>
      </div>
    </div>
  )
}
