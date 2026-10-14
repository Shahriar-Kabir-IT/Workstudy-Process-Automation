import { useNavigate } from 'react-router-dom'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'

const TEAMS = [
  { team: 'FR. PART', wip: 120, plan: 2.5, actual: 2.8 },
  { team: 'BK. PART', wip: 95, plan: 2.0, actual: 1.9 },
  { team: 'OUTPUT', wip: 60, plan: 3.0, actual: 3.4 },
]

export default function Changeover({ style }) {
  const nav = useNavigate()
  return (
    <div>
      <div className="page-head">
        <div><h1>8 · Change Over Time</h1><div className="sub"><Badge tone="gray">Sub-process · Not Priority</Badge></div></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/cycle`)}>Next: Cycle Time →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="card">
        <div className="card-head"><h3>Line Feeding &amp; Ending Plan</h3><span className="hint">plan vs actual · variance auto-calculated</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead><tr><th>Team</th><th className="num">WIP</th><th className="num">Plan (hrs)</th><th className="num">Actual (hrs)</th><th className="num">Variance</th><th>Result</th></tr></thead>
            <tbody>
              {TEAMS.map(t => {
                const v = +(t.actual - t.plan).toFixed(1)
                return (
                  <tr key={t.team}>
                    <td><b>{t.team}</b></td>
                    <td className="num mono">{t.wip}</td>
                    <td className="num mono">{t.plan.toFixed(1)}</td>
                    <td className="num mono">{t.actual.toFixed(1)}</td>
                    <td className="num mono" style={{ color: v > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}</td>
                    <td>{v > 0 ? <Badge tone="red">Over</Badge> : <Badge tone="green">On/Under</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Note tone="blue">Interruptions &amp; team-wise delays are logged here. Flagged <b>Not Priority</b> in the process flow.</Note>
    </div>
  )
}
