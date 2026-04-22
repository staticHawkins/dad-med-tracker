import { supplyStatus } from '../../lib/medUtils'

export default function KPIRow({ meds }) {
  const urgent = meds.filter(m => supplyStatus(m) === 'urgent')
  const soon   = meds.filter(m => supplyStatus(m) === 'soon')
  const ok     = meds.filter(m => supplyStatus(m) === 'ok')

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
          <span className="lbl-full">Refill within 7 days</span>
          <span className="lbl-short">Urgent</span>
        </div>
        {urgent.length > 0 && (
          <div className="kpi-sub">{urgent.map(m => m.name).join(', ')}</div>
        )}
      </div>
      <div className="kpi kpi-soon">
        <div className="kpi-num">{soon.length}</div>
        <div className="kpi-lbl">
          <span className="lbl-full">Refill in 2 weeks</span>
          <span className="lbl-short">2 weeks</span>
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
