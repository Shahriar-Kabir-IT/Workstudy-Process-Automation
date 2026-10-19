import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { LineChart, Donut } from '../components/charts.jsx'
import { bpt, ucl, lcl, round } from '../engine/calc.js'

const ROUNDS = [
  { n: 1, label: '1st · Non-Balance', when: 'Day 2–3' },
  { n: 2, label: '2nd · Balance', when: 'Day 4–5' },
  { n: 3, label: '3rd · Re-Balance', when: 'Day 7–8' },
  { n: 4, label: '4th · Re-Balance', when: 'Volume' },
  { n: 5, label: '5th · Re-Balance', when: 'Volume' },
]

export default function CycleTime({ style }) {
  const nav = useNavigate()
  const { updateStyle, operatorsFor, operators: allOps } = useStore()
  const ops = style.ops || []
  const facOps = operatorsFor(style.factory).length ? operatorsFor(style.factory) : allOps
  // candidate operators for an operation: same line + same machine, with sensible fallbacks
  const candFor = (op) => {
    const lm = facOps.filter(o => (!style.line || String(o.line) === String(style.line)) && (!op.machine || o.machine === op.machine))
    if (lm.length) return lm
    const byLine = facOps.filter(o => !style.line || String(o.line) === String(style.line))
    return byLine.length ? byLine : facOps
  }
  const operators = facOps
  const [roundN, setRoundN] = useState(style.cycleRound || 1)

  // observation state: sl -> { op: operatorId, t: observedMinutes }
  const [obs, setObs] = useState(() => {
    const init = {}
    ops.forEach((o, i) => {
      const saved = (style.cycle || []).find(c => c.sl === o.sl)
      const cands = candFor(o)
      const defId = cands.length ? cands[i % cands.length].id : ''
      init[o.sl] = saved
        ? { op: saved.operator?.id || defId, t: String(saved.observed) }
        : { op: defId, t: o.smv.toFixed(2) }
    })
    return init
  })

  if (!ops.length) {
    return (
      <div>
        <div className="page-head"><div><h1>9 · Cycle Time</h1><div className="sub">Responsible: WSE</div></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>Build and lay out the OB first — cycle time is taken on the verified layout.</Note>
      </div>
    )
  }
  if (!operators.length) {
    return (
      <div>
        <div className="page-head"><div><h1>9 · Cycle Time</h1><div className="sub">Responsible: WSE</div></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>No operators for {style.factory} yet. Upload the operator list first (Dashboard → 👷 Operators).</Note>
      </div>
    )
  }

  const setObsVal = (sl, k, v) => setObs(o => ({ ...o, [sl]: { ...o[sl], [k]: v } }))

  // rows with a valid observed time
  const rows = ops.map(o => {
    const e = obs[o.sl] || {}
    const t = Number(e.t)
    const operator = operators.find(op => op.id === e.op) || operators[0]
    return { sl: o.sl, name: o.name, machine: o.machine, smv: o.smv, operator, observed: t > 0 ? t : 0 }
  })
  const valid = rows.filter(r => r.observed > 0)

  const totalObserved = round(valid.reduce((s, r) => s + r.observed, 0), 2)
  const stations = valid.length
  const b = stations ? bpt(totalObserved, stations) : 0
  const U = b ? ucl(b) : 0, L = b ? lcl(b) : 0
  const potential = b ? Math.floor(60 / b) : 0
  const caps = valid.map(r => ({ label: r.name.split(' ').slice(0, 2).join(' '), value: Math.floor(60 / r.observed) }))
  const currentLine = caps.length ? Math.min(...caps.map(c => c.value)) : 0
  const performance = potential ? round((currentLine / potential) * 100, 0) : 0
  const gap = potential ? round(100 - performance, 0) : 0
  const uclCap = L ? Math.floor(60 / L) : 0
  const lclCap = U ? Math.floor(60 / U) : 0
  const meanCap = b ? Math.floor(60 / b) : 0

  const save = () => {
    const cycle = valid.map(r => ({ sl: r.sl, name: r.name, operator: r.operator, observed: r.observed }))
    updateStyle(style.id, { cycle, cycleRound: roundN })
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>9 · Cycle Time</h1><div className="sub">Responsible: WSE · operator time study on the verified layout</div></div>
        <div className="flex" style={{ gap: 10 }}>
          <button className="btn" onClick={save}>💾 Save round</button>
          <button className="btn primary" onClick={() => nav(`/style/${style.id}/skill`)}>Next: Skill Matrix →</button>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="flex wrap" style={{ gap: 8, marginBottom: 16 }}>
        {ROUNDS.map(r => (
          <button key={r.n} className={`pr-step ${r.n === roundN ? 'current' : ''}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => setRoundN(r.n)}>
            <span className="d" />{r.label} · {r.when}
          </button>
        ))}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Total Observed Time" value={totalObserved} unit="min" accent="#2563eb" />
        <Stat label="Basic Pitch (Bpt)" value={b || '—'} unit="min" foot={b ? `UCL ${U} · LCL ${L}` : 'enter times'} />
        <Stat label="Worker Potential" value={potential || '—'} unit="pcs/hr" accent="#0891b2" foot="60 ÷ Bpt" />
        <Stat label="Observed Stations" value={`${stations}/${ops.length}`} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h3>Process Capacity — Control Chart</h3><span className="hint">updates as you type</span></div>
          <div className="card-pad">
            {caps.length ? <LineChart points={caps} ucl={uclCap} lcl={lclCap} mean={meanCap} />
              : <div className="center muted" style={{ padding: '60px 0' }}>Enter observed times below to build the chart.</div>}
          </div>
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Performance</h3>
          <div className="flex" style={{ justifyContent: 'space-around' }}>
            <Donut value={performance} label="Performance" color="#16a34a" />
            <Donut value={gap} label="Productivity Gap" color="#d97706" />
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="kv"><span className="k">Current Output (bottleneck)</span><span className="v">{currentLine} pcs/hr</span></div>
            <div className="kv"><span className="k">Worker Potential</span><span className="v">{potential} pcs/hr</span></div>
            <div className="kv"><span className="k">Potential / 10 hrs</span><span className="v">{potential * 10} pcs</span></div>
          </div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head"><h3>Observation Entry — Round {roundN}</h3><span className="hint">pick operator · type observed minutes/piece</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
          <table>
            <thead><tr><th>#</th><th>Process</th><th>Machine</th><th className="num">SMV</th><th>Operator</th><th className="num">Observed (min)</th><th className="num">Capacity/hr</th><th>Status</th></tr></thead>
            <tbody>
              {ops.map(o => {
                const e = obs[o.sl] || {}
                const t = Number(e.t)
                const inBand = t > 0 && b && t <= U && t >= L
                return (
                  <tr key={o.sl}>
                    <td className="mono">{o.sl}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{o.name}</td>
                    <td><Badge tone={o.machine === 'Manual' ? 'gray' : 'blue'}>{o.machine}</Badge></td>
                    <td className="num mono">{o.smv.toFixed(2)}</td>
                    <td>
                      <select className="inp" style={{ padding: '5px 8px', minWidth: 150 }} value={e.op} onChange={ev => setObsVal(o.sl, 'op', ev.target.value)}>
                        {candFor(o).map(op => <option key={op.id} value={op.id}>{op.name} · L{op.line} · {op.machine}</option>)}
                      </select>
                    </td>
                    <td className="num">
                      <input className="inp" type="number" step="0.01" style={{ padding: '5px 8px', width: 90, textAlign: 'right' }} value={e.t} onChange={ev => setObsVal(o.sl, 't', ev.target.value)} />
                    </td>
                    <td className="num mono">{t > 0 ? Math.floor(60 / t) : '—'}</td>
                    <td>{t <= 0 ? <span className="muted">—</span> : !b ? <Badge tone="gray">—</Badge> : inBand ? <Badge tone="green">In control</Badge> : t > U ? <Badge tone="red">Slow</Badge> : <Badge tone="blue">Fast</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
