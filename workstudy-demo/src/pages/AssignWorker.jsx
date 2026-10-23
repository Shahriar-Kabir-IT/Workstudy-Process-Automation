import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { computeOB } from '../engine/calc.js'

const BAND = 0.05

export default function AssignWorker({ style }) {
  const nav = useNavigate()
  const { updateStyle, operatorsFor } = useStore()
  const ops = style.ops || []
  const mops = style.machineOps || {}
  const opBySl = Object.fromEntries(ops.map(o => [o.sl, o]))
  const operators = operatorsFor(style.factory)
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const [workers, setWorkers] = useState(() => style.machineWorker || {})
  const [section, setSection] = useState('')

  const setWorker = (m, opId) => {
    setWorkers(prev => {
      const next = { ...prev }
      // one worker = one machine: if picked elsewhere, move them here
      if (opId) Object.keys(next).forEach(k => { if (next[k] === opId && k !== String(m)) delete next[k] })
      if (opId) next[m] = opId; else delete next[m]
      updateStyle(style.id, { machineWorker: next })
      return next
    })
  }

  if (!style.layoutLine || !Object.keys(mops).length) {
    return (
      <div>
        <div className="page-head"><div><h1>👷 Assign Workers</h1></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>Build the <b>machine layout</b> first (Line Layout) — workers are assigned to the machines that run the processes.</Note>
      </div>
    )
  }

  const line = style.layoutLine
  const pitch = computeOB(ops, style.manpower).pitchTime
  const allMachines = Object.keys(mops).map(Number).filter(m => (mops[m] || []).length).sort((a, b) => a - b)
  const nMach = (sl) => Object.values(mops).filter(l => l.includes(sl)).length || 1
  const loadOf = (m) => (mops[m] || []).reduce((s, sl) => s + (opBySl[sl]?.smv || 0) / nMach(sl), 0)
  const loadColor = (l) => l === 0 ? '#cbd5e1' : l > pitch + BAND ? '#dc2626' : l < pitch - BAND ? '#d97706' : '#16a34a'

  // operators of THIS line, then machine-matched
  const lineName = String(line.name)
  const lineOperators = operators.filter(o => String(o.line) === lineName)
  const candFor = (m) => {
    const types = (mops[m] || []).map(sl => opBySl[sl]?.machine)
    const match = lineOperators.filter(o => types.includes(o.machine))
    return match.length ? match : lineOperators
  }

  // sections present in this layout
  const sections = [...new Set(allMachines.flatMap(m => (mops[m] || []).map(sl => (opBySl[sl]?.section || '').trim())).filter(Boolean))]
  const inSection = (m) => !section || (mops[m] || []).some(sl => (opBySl[sl]?.section || '').trim() === section)
  const machines = allMachines.filter(inSection)

  const staffed = allMachines.filter(m => workers[m]).length
  const assignedAt = Object.fromEntries(Object.entries(workers).map(([mm, id]) => [id, mm]))   // operatorId → machine

  // details grouped per machine (one operator does ALL processes on the machine)
  const groups = machines.map(m => {
    const list = (mops[m] || []).filter(sl => !section || (opBySl[sl]?.section || '').trim() === section)
    const load = loadOf(m)                                   // combined per-piece minutes for the operator
    return { m, list, operator: opById[workers[m]], cap: load > 0 ? Math.floor(60 / load) : null }
  }).filter(g => g.list.length)
  const rowCount = groups.reduce((s, g) => s + g.list.length, 0)

  return (
    <div>
      <div className="page-head">
        <div><h1>👷 Assign Workers</h1><div className="sub">Staff each machine on the line · {lineOperators.length} operators on line {lineName}</div></div>
        <button className="btn primary" onClick={() => { updateStyle(style.id, { machineWorker: workers, step: Math.max(style.step, 9), status: 'Cycle Time' }); nav(`/style/${style.id}/cycle`) }}>Next: Cycle Time →</button>
      </div>
      <div style={{ marginBottom: 14 }}><ProgressRail step={style.step} /></div>

      {!lineOperators.length ? (
        <Note>No operators assigned to <b>line {lineName}</b>. <span style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/operators')}>Upload / assign operators for this line →</span></Note>
      ) : null}

      {/* FILTER BAR — line (fixed) → section */}
      <div className="card card-pad aw-filter">
        <div className="aw-step">
          <span className="aw-step-n">1</span>
          <div><div className="aw-step-lbl">Line</div><Badge tone={line.shape === 'U' ? 'green' : 'violet'}>{line.name} · {line.shape}-Shape · {line.machines} machines</Badge></div>
        </div>
        <div className="aw-arrow">→</div>
        <div className="aw-step">
          <span className="aw-step-n">2</span>
          <div><div className="aw-step-lbl">Section</div>
            <select className="inp" value={section} onChange={e => setSection(e.target.value)} style={{ height: 34, minWidth: 170 }}>
              <option value="">All sections ({allMachines.length} stations)</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="aw-sum">
          <div><div className="aw-sum-n" style={{ color: staffed === allMachines.length ? '#16a34a' : '#d97706' }}>{staffed}/{allMachines.length}</div><div className="aw-sum-l">workers assigned</div></div>
          <div><div className="aw-sum-n" style={{ color: '#2563eb' }}>{groups.reduce((s, g) => s + (g.cap || 0), 0).toLocaleString()}</div><div className="aw-sum-l">capacity pcs/hr</div></div>
        </div>
      </div>

      {/* ① assign a worker to each station (filtered) */}
      <div className="card mt">
        <div className="card-head"><h3>① Assign worker to each machine {section ? <Badge tone="blue">{section}</Badge> : null}</h3><span className="hint">{machines.length} station{machines.length === 1 ? '' : 's'} · a process on N machines = N workers</span></div>
        <div className="card-pad aw-grid">
          {machines.map(m => {
            const list = mops[m] || []
            const col = loadColor(loadOf(m))
            const assigned = !!workers[m]
            return (
              <div key={m} className="aw-card" style={{ borderColor: assigned ? '#16a34a' : 'var(--line)' }}>
                <div className="aw-card-head">
                  <b>W{m}</b>
                  <span className="aw-card-load" style={{ color: col }}>{loadOf(m).toFixed(2)} min{assigned ? ' · ✓' : ''}</span>
                </div>
                <div className="aw-procs">
                  {list.map(sl => {
                    const o = opBySl[sl]
                    return (
                      <div key={sl} className="aw-proc">
                        <span className="aw-proc-name">{o?.name}</span>
                        <Badge tone={o?.machine === 'QC' ? 'violet' : o?.machine === 'Manual' || o?.machine === 'HP' ? 'gray' : 'blue'}>{o?.machine}</Badge>
                      </div>
                    )
                  })}
                </div>
                <select className="inp" value={workers[m] || ''} disabled={!lineOperators.length} onChange={e => setWorker(m, e.target.value)} title={workers[m] ? opById[workers[m]]?.name : ''} style={{ height: 36, fontSize: 11.5 }}>
                  <option value="">— select worker —</option>
                  {candFor(m).map(o => {
                    const at = assignedAt[o.id]
                    const busy = at && String(at) !== String(m)
                    return <option key={o.id} value={o.id}>{o.name} · {o.grade || '?'} · {o.machine || '—'}{busy ? ` — ⚠ already on W${at}` : ''}</option>
                  })}
                </select>
              </div>
            )
          })}
          {!machines.length ? <div className="center muted" style={{ padding: '28px 0', gridColumn: '1/-1' }}>No stations in this section.</div> : null}
        </div>
      </div>

      {/* ② details */}
      <div className="card mt">
        <div className="card-head"><h3>② Assignment details</h3><span className="hint">{rowCount} process rows · one operator does every process on their machine</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 400 }}>
          <table>
            <thead><tr><th>Machine No.</th><th>Process</th><th>Section</th><th>Machine</th><th className="num">Process SMV</th><th>Operator</th><th className="num">Capacity / hr</th></tr></thead>
            <tbody>
              {groups.map(g => g.list.map((sl, i) => {
                const o = opBySl[sl]
                return (
                  <tr key={g.m + '-' + sl} style={i === 0 && g.list.length > 1 ? { borderTop: '2px solid var(--line)' } : null}>
                    {i === 0 ? <td className="mono" rowSpan={g.list.length} style={{ verticalAlign: 'middle', fontWeight: 700 }}>W{g.m}{g.list.length > 1 ? <span className="muted" style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>{g.list.length} processes</span> : null}</td> : null}
                    <td style={{ whiteSpace: 'nowrap' }}><b>{o?.name}</b></td>
                    <td><span className="muted" style={{ fontSize: 11.5 }}>{o?.section || '—'}</span></td>
                    <td><Badge tone={o?.machine === 'QC' ? 'violet' : o?.machine === 'Manual' || o?.machine === 'HP' ? 'gray' : 'blue'}>{o?.machine}</Badge></td>
                    <td className="num mono">{(o?.smv || 0).toFixed(2)}</td>
                    {i === 0 ? <td rowSpan={g.list.length} style={{ verticalAlign: 'middle' }}>{g.operator ? <span><b>{g.operator.name}</b> <span className="muted" style={{ fontSize: 11 }}>· {g.operator.grade}</span></span> : <span className="muted">— unassigned —</span>}</td> : null}
                    {i === 0 ? <td className="num mono" rowSpan={g.list.length} style={{ verticalAlign: 'middle', color: '#16a34a', fontWeight: 600 }}>{g.cap != null ? g.cap.toLocaleString() : '—'}</td> : null}
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
