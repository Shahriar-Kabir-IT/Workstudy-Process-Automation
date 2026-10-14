import { useNavigate } from 'react-router-dom'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { BarChart } from '../components/charts.jsx'
import { computeOB, lineTargetPerHour } from '../engine/calc.js'

export default function ProductionPlan({ style }) {
  const nav = useNavigate()
  const tSMV = style.ops.length ? computeOB(style.ops, style.manpower).totalSMV : style.smv
  const ramp = [40, 55, 65, 72, 78, 80, 82, 82]
  const days = ramp.map((eff, i) => {
    const perHour = lineTargetPerHour(style.manpower, tSMV, eff / 100)
    return { day: 'D' + (i + 1), eff, out: perHour * 10 }
  })
  const chart = days.map(d => ({ label: d.day, value: d.out }))

  return (
    <div>
      <div className="page-head">
        <div><h1>7 · Style Production Buildup Plan</h1><div className="sub flex" style={{ gap: 8 }}><Badge tone="gray">Sub-process · Not Priority</Badge></div></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/changeover`)}>Next: Change Over →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Manpower" value={style.manpower} />
        <Stat label="Working Hours" value={10} unit="hrs/day" />
        <Stat label="Peak Efficiency" value={82} unit="%" accent="#16a34a" />
        <Stat label="Order Qty" value={style.order.toLocaleString()} unit="pcs" accent="#2563eb" />
      </div>

      <div className="card">
        <div className="card-head"><h3>Daywise Production Buildup</h3><span className="hint">output ramps with efficiency</span></div>
        <div className="card-pad"><BarChart data={chart} color="#0891b2" /></div>
      </div>

      <div className="card mt">
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead><tr><th>Day</th><th className="num">Efficiency %</th><th className="num">Target/hr</th><th className="num">Daily Output</th></tr></thead>
            <tbody>
              {days.map(d => (
                <tr key={d.day}><td><b>{d.day}</b></td><td className="num mono">{d.eff}%</td><td className="num mono">{d.out / 10}</td><td className="num mono">{d.out.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Note tone="blue" >This step is flagged <b>Not Priority</b> in the process flow — included for completeness.</Note>
    </div>
  )
}
