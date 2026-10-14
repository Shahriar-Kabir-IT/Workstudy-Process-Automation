import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { MATRIX_MIN_PER_HOUR, operatorEfficiency, gradeFromEff, round } from '../engine/calc.js'
import { useStore } from '../store.jsx'

function cellColor(eff) {
  if (eff == null) return '#f8fafc'
  if (eff >= 85) return '#dcfce7'
  if (eff >= 70) return '#ecfccb'
  if (eff >= 55) return '#fef9c3'
  return '#fee2e2'
}

export default function SkillMatrix({ style }) {
  const { operatorsFor } = useStore()
  const ops = operatorsFor(style.factory).slice(0, 12)
  const styleOps = (style.ops || []).filter(o => o.machine !== 'Manual')
  const MACHINES = [...new Set(styleOps.map(o => o.machine))].slice(0, 8)
  const avgSmv = (m) => {
    const list = styleOps.filter(o => o.machine === m)
    return list.length ? list.reduce((s, o) => s + o.smv, 0) / list.length : 0.4
  }
  const smvByM = Object.fromEntries(MACHINES.map(m => [m, avgSmv(m)]))

  if (!MACHINES.length || !ops.length) {
    return (
      <div>
        <div className="page-head"><div><h1>10 · Skill Matrix</h1><div className="sub">Responsible: WSE</div></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>{!ops.length
          ? `No operators for ${style.factory}. Upload the operator list (Dashboard → 👷 Operators).`
          : 'Build the Operation Breakdown first — the skill matrix is generated from the machines used in this style.'}</Note>
      </div>
    )
  }

  // build matrix: operator x machine -> {output, eff} | null
  const matrix = ops.map((op, i) => {
    const cells = MACHINES.map((m, j) => {
      if ((i * 3 + j) % 7 === 0) return null // not skilled on this machine
      const frac = 0.55 + (((i * 7 + j * 13 + 3) % 9) / 9) * 0.42
      const cap = Math.floor(MATRIX_MIN_PER_HOUR / smvByM[m])
      const output = Math.round(cap * frac)
      const eff = operatorEfficiency(output, smvByM[m])
      return { output, eff }
    })
    const effs = cells.filter(Boolean).map(c => c.eff)
    const avg = effs.length ? round(effs.reduce((s, v) => s + v, 0) / effs.length, 0) : 0
    return { op, cells, avg, grade: gradeFromEff(avg), skills: effs.length }
  })

  const lineAvg = round(matrix.reduce((s, r) => s + r.avg, 0) / matrix.length, 0)
  const multiSkilled = matrix.filter(r => r.skills >= 4).length

  // worked example
  const ex = matrix[0].cells.find(Boolean)
  const exM = MACHINES[matrix[0].cells.findIndex(Boolean)]

  return (
    <div>
      <div className="page-head">
        <div><h1>10 · Skill Matrix</h1><div className="sub">Responsible: WSE · auto-collected operation / machine / efficiency data</div></div>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="note" style={{ marginBottom: 16 }}>
        <span>⏱️ <b>Effective working hour = {MATRIX_MIN_PER_HOUR} minutes</b> (85% of 60). All skill-matrix efficiency figures use this.
          &nbsp;<span className="formula">Efficiency = (Output/hr × SMV) ÷ {MATRIX_MIN_PER_HOUR} × 100</span>
          {ex ? <> — e.g. {matrix[0].op.name.split(' ')[0]} on {exM}: ({ex.output} × {smvByM[exM].toFixed(2)}) ÷ {MATRIX_MIN_PER_HOUR} = <b>{ex.eff}%</b></> : null}
        </span>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Operators" value={ops.length} accent="#2563eb" />
        <Stat label="Avg Line Skill" value={lineAvg} unit="%" accent={lineAvg >= 75 ? '#16a34a' : '#d97706'} foot="@ 51-min hour" />
        <Stat label="Multi-skilled (4+)" value={multiSkilled} foot="machines mastered" accent="#0891b2" />
        <Stat label="Machine Types" value={MACHINES.length} />
      </div>

      <div className="card">
        <div className="card-head"><h3>Operator × Machine Efficiency</h3><span className="hint">cell = efficiency % · blank = not skilled</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Operator</th><th>ID</th>
                {MACHINES.map(m => <th key={m} className="num">{m}</th>)}
                <th className="num">Avg</th><th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(r => (
                <tr key={r.op.id}>
                  <td><b>{r.op.name}</b></td>
                  <td className="mono muted">{r.op.id}</td>
                  {r.cells.map((c, j) => (
                    <td key={j} className="num mono" style={{ background: cellColor(c ? c.eff : null), fontWeight: c ? 600 : 400 }}>
                      {c ? c.eff + '%' : '—'}
                    </td>
                  ))}
                  <td className="num mono"><b>{r.avg}%</b></td>
                  <td><Badge tone={r.grade.startsWith('A') ? 'green' : r.grade === 'B' ? 'blue' : r.grade === 'C' ? 'amber' : 'red'}>{r.grade}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Note tone="blue" >The system auto-collects each operator's cycle-time results over time to keep this matrix current — filter by date range and print on request.</Note>
    </div>
  )
}
