import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { computeOB, round, uclCT, lclCT, cyclePerformance, cycleGap, effPct } from '../engine/calc.js'

const ROUNDS = [
  { n: 1, label: '1st · Non-Balance', when: 'Day 2–3' },
  { n: 2, label: '2nd · Balance', when: 'Day 4–5' },
  { n: 3, label: '3rd · Re-Balance', when: 'Day 7–8' },
  { n: 4, label: '4th · Re-Balance', when: 'Volume' },
  { n: 5, label: '5th · Re-Balance', when: 'Volume' },
]
const avgOf = (reads) => { const r = (reads || []).map(Number).filter(x => x > 0); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0 }
const emptyStudy = { obs: {}, nnva: [], currentPcs: '', plannedPcs: '', header: {} }

// balancing control chart: capacity bar per station + mean / UCL / LCL capacity lines
function BalanceChart({ caps, mean, hi, lo }) {
  const W = 920, H = 230, pad = { l: 40, r: 10, t: 14, b: 40 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const n = caps.length || 1
  const bw = iw / n
  const max = Math.max(mean, hi, ...caps.map(c => c.value), 1) * 1.1
  const y = (v) => pad.t + ih - (v / max) * ih
  const line = (v, color, dash, label) => (
    <g>
      <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke={color} strokeWidth="1.5" strokeDasharray={dash} />
      <text x={W - pad.r} y={y(v) - 3} textAnchor="end" fontSize="9" fill={color} fontWeight="700">{label} {Math.round(v)}</text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {[0, 0.5, 1].map((f, i) => <line key={i} x1={pad.l} y1={y(max * f)} x2={W - pad.r} y2={y(max * f)} stroke="#eef2f7" />)}
      {caps.map((c, i) => {
        const col = c.value < lo ? '#dc2626' : c.value > hi ? '#2563eb' : '#16a34a'   // below lower cap = bottleneck
        const h = Math.max(0, pad.t + ih - y(c.value))
        return (
          <g key={i}>
            <rect x={pad.l + i * bw + bw * 0.15} y={y(c.value)} width={bw * 0.7} height={h} rx="2" fill={col} opacity="0.85">
              <title>{c.label}: {c.value}/hr</title>
            </rect>
            <text x={pad.l + i * bw + bw / 2} y={H - 26} textAnchor="end" fontSize="7.5" fill="#94a3b8" transform={`rotate(-60 ${pad.l + i * bw + bw / 2} ${H - 26})`}>{c.label}</text>
          </g>
        )
      })}
      {line(hi, '#0891b2', '4 3', 'Upper')}
      {line(mean, '#16a34a', '0', 'Bpt')}
      {line(lo, '#dc2626', '4 3', 'Lower')}
    </svg>
  )
}

export default function CycleTime({ style }) {
  const nav = useNavigate()
  const { updateStyle, operatorsFor, user } = useStore()
  const ops = style.ops || []
  const mops = style.machineOps || {}
  const machineWorker = style.machineWorker || {}
  const opBySl = Object.fromEntries(ops.map(o => [o.sl, o]))
  const line = style.layoutLine
  const operators = operatorsFor(style.factory)
  const opById = Object.fromEntries(operators.map(o => [o.id, o]))
  const lineOperators = line ? operators.filter(o => String(o.line) === String(line.name)) : operators

  const [roundN, setRoundN] = useState(1)
  const [studies, setStudies] = useState(() => style.cycleStudies || {})
  const [timer, setTimer] = useState(null)        // { key, start } — running stopwatch
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setNowTs(Date.now()), 100)
    return () => clearInterval(id)
  }, [timer])
  const study = studies[roundN] || emptyStudy
  const patch = (p) => setStudies(prev => {
    const next = { ...prev, [roundN]: { ...emptyStudy, ...(prev[roundN] || {}), ...p } }
    updateStyle(style.id, { cycleStudies: next })
    return next
  })

  if (!line || !Object.keys(mops).length) {
    return (
      <div>
        <div className="page-head"><div><h1>9 · Cycle Time</h1></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>Cycle time is taken on the <b>verified layout</b> — finish Line Layout &amp; Assign Workers first.</Note>
      </div>
    )
  }

  // stations = machines (with their processes + assigned operator) + NNVA
  const machineStations = Object.keys(mops).map(Number).filter(m => (mops[m] || []).length).sort((a, b) => a - b)
    .map(m => {
      const procs = (mops[m] || []).map(sl => opBySl[sl]).filter(Boolean)
      return { key: 'M' + m, label: 'M' + m, name: procs.map(p => p.name).join(' + '), machine: procs.map(p => p.machine).join('/'), smv: procs.reduce((s, p) => s + (p.smv || 0), 0), defaultOp: machineWorker[m], nnva: false }
    })
  const nnvaStations = (study.nnva || []).map((x, i) => ({ key: 'N' + x.id, label: 'NNVA', name: x.name || `NNVA ${i + 1}`, machine: x.machine || '—', smv: 0, defaultOp: x.op, nnva: true, idx: i }))
  const stations = [...machineStations, ...nnvaStations]

  const obsFor = (key) => study.obs?.[key] || {}
  const readsOf = (key) => obsFor(key).reads || []
  const opFor = (st) => obsFor(st.key).op || st.defaultOp || ''

  const setRead = (key, idx, val) => {
    const obs = { ...(study.obs || {}) }
    const reads = [...(obs[key]?.reads || [])]; reads[idx] = val
    obs[key] = { ...(obs[key] || {}), reads }
    patch({ obs })
  }
  const setOp = (key, opId) => { const obs = { ...(study.obs || {}) }; obs[key] = { ...(obs[key] || {}), op: opId }; patch({ obs }) }
  // stopwatch: ▶ start → ■ stop records the elapsed minutes into the first empty of the 5 reading slots
  const recordRead = (key, minutes) => {
    const reads = study.obs?.[key]?.reads || []
    const idx = [0, 1, 2, 3, 4].find(i => !(Number(reads[i]) > 0))
    if (idx != null) setRead(key, idx, round(minutes, 3))
  }
  const toggleTimer = (key) => {
    if (timer && timer.key === key) { recordRead(key, (Date.now() - timer.start) / 60000); setTimer(null) }
    else setTimer({ key, start: Date.now() })
  }
  const addNNVA = () => patch({ nnva: [...(study.nnva || []), { id: Date.now().toString(36), name: '', machine: 'HP', op: '' }] })
  const setNNVA = (i, k, v) => { const nnva = (study.nnva || []).map((x, j) => j === i ? { ...x, [k]: v } : x); patch({ nnva }) }
  const removeNNVA = (i) => { const nnva = (study.nnva || []).filter((_, j) => j !== i); patch({ nnva }) }

  // ---- calculations ----
  const rows = stations.map(st => { const a = round(avgOf(readsOf(st.key)), 3); return { ...st, avg: a, cap: a > 0 ? Math.floor(60 / a) : 0 } })
  const observed = rows.filter(r => r.avg > 0)
  const totalTime = round(observed.reduce((s, r) => s + r.avg, 0), 2)
  const workers = stations.length
  // SMV of the processes actually placed on the line (the stations being studied)
  const placedSls = new Set(Object.values(mops).flat())
  const smv = round([...placedSls].reduce((s, sl) => s + (opBySl[sl]?.smv || 0), 0), 2)
  const b = workers && totalTime ? round(totalTime / workers, 4) : 0
  const U = b ? uclCT(b) : 0, L = b ? lclCT(b) : 0
  const potential = b ? Math.floor(60 / b) : 0
  const capHi = L ? Math.floor(60 / L) : 0   // fastest (LCL time → high capacity)
  const capLo = U ? Math.floor(60 / U) : 0   // slowest allowed (UCL time → low capacity); below = bottleneck
  const currentPcs = Number(study.currentPcs) || 0
  const perf = totalTime ? cyclePerformance(smv, totalTime) : 0
  const gap = potential && currentPcs ? cycleGap(potential, currentPcs) : 0

  // planned pcs/hr: from Production Plan peak day ÷ working hours, else manual
  const pp = style.productionPlan || {}
  const peakPlan = Math.max(0, ...Object.values(pp.entries || {}).map(e => Number(e.plan) || 0))
  const defaultPlanned = pp.workingHours && peakPlan ? Math.round(peakPlan / pp.workingHours) : 0
  const plannedPcs = study.plannedPcs !== '' && study.plannedPcs != null ? Number(study.plannedPcs) : defaultPlanned
  const peakEff = workers && smv ? effPct(plannedPcs, smv, workers) : 0
  const currentEff = workers && smv ? effPct(currentPcs, smv, workers) : 0

  const caps = observed.map(r => ({ label: (r.name || '').split(' ').slice(0, 3).join(' '), value: r.cap }))
  const H = study.header || {}
  const setH = (k, v) => patch({ header: { ...H, [k]: v } })

  const Field = ({ k, children }) => <div className="ct-f"><span>{k}</span>{children}</div>

  return (
    <div>
      <div className="page-head">
        <div><h1>9 · Cycle Time</h1><div className="sub">Operator time study on the verified layout · 5 readings per station</div></div>
        <button className="btn primary" onClick={() => { updateStyle(style.id, { cycleStudies: studies, step: Math.max(style.step, 10), status: 'Skill Matrix' }); nav(`/style/${style.id}/skill`) }}>Next: Skill Matrix →</button>
      </div>
      <div style={{ marginBottom: 14 }}><ProgressRail step={style.step} /></div>

      {/* round selector */}
      <div className="flex wrap" style={{ gap: 8, marginBottom: 12 }}>
        {ROUNDS.map(r => (
          <button key={r.n} className={`pr-step ${r.n === roundN ? 'current' : ''}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => setRoundN(r.n)}>
            <span className="d" />{r.label} · {r.when}
          </button>
        ))}
      </div>

      {/* header */}
      <div className="card card-pad ct-head">
        <Field k="SMV"><b style={{ color: '#2563eb' }}>{smv}</b></Field>
        <Field k="Factory"><b>{style.factory}</b></Field>
        <Field k="Style"><b>{style.styleNo}</b></Field>
        <Field k="Buyer"><b>{style.buyer}</b></Field>
        <Field k="Line"><Badge tone={line.shape === 'U' ? 'green' : 'violet'}>{line.name}</Badge></Field>
        <Field k="Item"><b>{style.item}</b></Field>
        <Field k="Section"><input className="inp ct-in" value={H.section ?? 'SEWING'} onChange={e => setH('section', e.target.value)} /></Field>
        <Field k="Observer"><input className="inp ct-in" value={H.observer ?? user.name} onChange={e => setH('observer', e.target.value)} /></Field>
        <Field k="Date"><input className="inp ct-in" type="date" value={H.date ?? ''} onChange={e => setH('date', e.target.value)} /></Field>
        <Field k="Graph #"><input className="inp ct-in" value={H.graph ?? `BALANCING-0${roundN}`} onChange={e => setH('graph', e.target.value)} /></Field>
        <Field k="Total M/c Cont. Time"><input className="inp ct-in" value={H.mcCont ?? ''} onChange={e => setH('mcCont', e.target.value)} placeholder="min" /></Field>
        <Field k="Total Non-M/c Cont. Time"><input className="inp ct-in" value={H.nonMcCont ?? ''} onChange={e => setH('nonMcCont', e.target.value)} placeholder="min" /></Field>
      </div>

      {/* summary */}
      <div className="card card-pad mt ct-sum">
        <div><div className="ct-n" style={{ color: '#2563eb' }}>{totalTime || '—'}</div><div className="ct-l">Total Time (min)</div></div>
        <div><div className="ct-n">{b || '—'}</div><div className="ct-l">Bpt</div></div>
        <div><div className="ct-n" style={{ fontSize: 15 }}>{U || '—'} / {L || '—'}</div><div className="ct-l">UCL / LCL</div></div>
        <div><div className="ct-n">{workers}</div><div className="ct-l">Workers</div></div>
        <div><div className="ct-n" style={{ color: '#0891b2' }}>{potential || '—'}</div><div className="ct-l">Potential pcs/hr</div></div>
        <div><div className="ct-n" style={{ color: '#0891b2' }}>{potential ? (potential * 10).toLocaleString() : '—'}</div><div className="ct-l">Potential /10hr</div></div>
        <div><div className="ct-l" style={{ marginBottom: 2 }}>Current pcs/hr</div><input className="inp" type="number" value={study.currentPcs} onChange={e => patch({ currentPcs: e.target.value })} style={{ width: 80, height: 30 }} /></div>
        <div><div className="ct-l" style={{ marginBottom: 2 }}>Planned pcs/hr</div><input className="inp" type="number" value={study.plannedPcs !== '' && study.plannedPcs != null ? study.plannedPcs : defaultPlanned} onChange={e => patch({ plannedPcs: e.target.value })} style={{ width: 80, height: 30 }} /></div>
        <div><div className="ct-n" style={{ color: '#16a34a' }}>{perf || '—'}%</div><div className="ct-l">Worker Perf.</div></div>
        <div><div className="ct-n" style={{ color: '#d97706' }}>{gap || '—'}%</div><div className="ct-l">Productivity Gap</div></div>
        <div><div className="ct-n" style={{ color: '#7c3aed' }}>{peakEff || '—'}%</div><div className="ct-l">Planned Peak Eff.</div></div>
        <div><div className="ct-n" style={{ color: '#7c3aed' }}>{currentEff || '—'}%</div><div className="ct-l">Planned Current Eff.</div></div>
      </div>

      {/* balancing chart */}
      <div className="card mt">
        <div className="card-head"><h3>Cycle Time Graph — Process Capacity (Balancing)</h3><span className="hint">bars below the lower line are bottlenecks</span></div>
        <div className="card-pad">
          {caps.length ? <BalanceChart caps={caps} mean={potential} hi={capHi} lo={capLo} />
            : <div className="center muted" style={{ padding: '50px 0' }}>Enter readings below to build the balancing chart.</div>}
        </div>
      </div>

      {/* observation grid */}
      <div className="card mt">
        <div className="card-head"><h3>Observation — Round {roundN}</h3>
          <button className="btn sm" onClick={addNNVA} title="Add a Necessary Non-Value-Added process">➕ Add NNVA</button>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 460 }}>
          <table className="ct-table">
            <thead><tr><th>Station</th><th>Process</th><th>M/c</th><th>Operator</th><th>⏱ Timer</th><th className="num" colSpan={5}>5 Cycle Times (min)</th><th className="num">Avg</th><th className="num">Cap/hr</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(st => {
                const reads = readsOf(st.key)
                const within = st.avg > 0 && b && st.avg <= U && st.avg >= L
                return (
                  <tr key={st.key} style={st.nnva ? { background: '#faf7ff' } : null}>
                    <td className="mono">{st.nnva ? <Badge tone="violet">NNVA</Badge> : st.label}</td>
                    <td style={{ minWidth: 150 }}>
                      {st.nnva
                        ? <input className="inp ct-in" value={study.nnva[st.idx]?.name || ''} onChange={e => setNNVA(st.idx, 'name', e.target.value)} placeholder="NNVA process name" />
                        : <b style={{ fontSize: 11.5 }}>{st.name}</b>}
                    </td>
                    <td>{st.nnva
                      ? <input className="inp ct-in" style={{ width: 56 }} value={study.nnva[st.idx]?.machine || ''} onChange={e => setNNVA(st.idx, 'machine', e.target.value)} />
                      : <Badge tone="blue">{st.machine}</Badge>}</td>
                    <td>
                      <select className="inp ct-in" style={{ minWidth: 120 }} value={opFor(st)} onChange={e => setOp(st.key, e.target.value)}>
                        <option value="">— operator —</option>
                        {lineOperators.map(o => <option key={o.id} value={o.id}>{o.name} · {o.grade}</option>)}
                      </select>
                    </td>
                    <td>
                      {(() => {
                        const running = timer && timer.key === st.key
                        const full = [0, 1, 2, 3, 4].every(i => Number(reads[i]) > 0)
                        const secs = running ? ((nowTs - timer.start) / 1000).toFixed(1) : null
                        return (
                          <button className="btn sm" disabled={!running && full}
                            style={{ minWidth: 76, background: running ? '#dc2626' : full ? undefined : '#16a34a', color: running || !full ? '#fff' : undefined, borderColor: running ? '#dc2626' : full ? undefined : '#16a34a' }}
                            onClick={() => toggleTimer(st.key)} title={running ? 'Stop & record' : full ? 'All 5 captured' : 'Start timing this cycle'}>
                            {running ? `■ ${secs}s` : full ? '✓ 5/5' : '▶ Start'}
                          </button>
                        )
                      })()}
                    </td>
                    {[0, 1, 2, 3, 4].map(i => (
                      <td key={i} className="num"><input className="inp ct-read" type="number" step="0.01" value={reads[i] ?? ''} onChange={e => setRead(st.key, i, e.target.value)} /></td>
                    ))}
                    <td className="num mono" style={{ fontWeight: 700 }}>{st.avg || '—'}</td>
                    <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{st.cap || '—'}</td>
                    <td>{st.avg <= 0 ? <span className="muted">—</span> : !b ? '—' : within ? <Badge tone="green">In control</Badge> : st.avg > U ? <Badge tone="red">Bottleneck</Badge> : <Badge tone="blue">Fast</Badge>}
                      {st.nnva ? <button className="btn sm" style={{ marginLeft: 6, color: '#dc2626' }} onClick={() => removeNNVA(st.idx)}>✕</button> : null}
                    </td>
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
