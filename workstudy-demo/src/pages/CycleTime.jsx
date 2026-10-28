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

// balancing control chart: capacity LINE across stations + mean / UCL / LCL control lines
function BalanceChart({ caps, mean, hi, lo }) {
  const W = 960, H = 250, pad = { l: 38, r: 12, t: 30, b: 44 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const n = caps.length || 1
  const cw = iw / n
  const max = Math.max(mean, hi, ...caps.map(c => c.value), 1) * 1.08
  const y = (v) => pad.t + ih - (v / max) * ih
  const cx = (i) => pad.l + i * cw + cw / 2
  const step = Math.ceil(n / 46)
  const colOf = (v) => v < lo ? '#dc2626' : v > hi ? '#2563eb' : '#16a34a'   // below lower = bottleneck
  const pts = caps.map((c, i) => `${cx(i).toFixed(1)},${y(c.value).toFixed(1)}`).join(' ')
  const legend = [
    { c: '#0891b2', t: `Upper ${Math.round(hi)}`, d: '4 3' },
    { c: '#16a34a', t: `Bpt ${Math.round(mean)}`, d: '0' },
    { c: '#dc2626', t: `Lower ${Math.round(lo)}`, d: '4 3' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {legend.map((g, i) => (
        <g key={i} transform={`translate(${pad.l + i * 150}, 12)`}>
          <line x1={0} y1={0} x2={18} y2={0} stroke={g.c} strokeWidth="2.5" strokeDasharray={g.d} />
          <text x={23} y={3.5} fontSize="11" fill={g.c} fontWeight="700">{g.t}</text>
        </g>
      ))}
      {[0, 0.5, 1].map((f, i) => <line key={i} x1={pad.l} y1={y(max * f)} x2={W - pad.r} y2={y(max * f)} stroke="#eef2f7" />)}
      {/* control lines */}
      <line x1={pad.l} y1={y(hi)} x2={W - pad.r} y2={y(hi)} stroke="#0891b2" strokeWidth="1.3" strokeDasharray="4 3" />
      <line x1={pad.l} y1={y(mean)} x2={W - pad.r} y2={y(mean)} stroke="#16a34a" strokeWidth="1.6" />
      <line x1={pad.l} y1={y(lo)} x2={W - pad.r} y2={y(lo)} stroke="#dc2626" strokeWidth="1.3" strokeDasharray="4 3" />
      {/* capacity line + colored markers */}
      <polyline points={pts} fill="none" stroke="#475569" strokeWidth="1.6" strokeLinejoin="round" />
      {caps.map((c, i) => (
        <g key={i}>
          <circle cx={cx(i)} cy={y(c.value)} r="3.2" fill={colOf(c.value)} stroke="#fff" strokeWidth="1">
            <title>{c.label} · {c.name} — {c.value} pcs/hr</title>
          </circle>
          {i % step === 0 ? <text x={cx(i)} y={H - 30} textAnchor="end" fontSize="8" fill="#94a3b8" transform={`rotate(-55 ${cx(i)} ${H - 30})`}>{c.label}</text> : null}
        </g>
      ))}
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

  // stations = machines (with their processes + assigned operator). NNVA is an OB process placed in the layout, so it shows up here too.
  const stations = Object.keys(mops).map(Number).filter(m => (mops[m] || []).length).sort((a, b) => a - b)
    .map(m => {
      const procs = (mops[m] || []).map(sl => opBySl[sl]).filter(Boolean)
      return { key: 'M' + m, label: 'W' + m, name: procs.map(p => p.name).join(' + '), machine: procs.map(p => p.machine).join('/'), smv: procs.reduce((s, p) => s + (p.smv || 0), 0), defaultOp: machineWorker[m], nnva: procs.some(p => p.nnva) }
    })

  const obsFor = (key) => study.obs?.[key] || {}
  const readsOf = (key) => obsFor(key).reads || []
  const opFor = (st) => obsFor(st.key).op || st.defaultOp || ''

  const setRead = (key, idx, val) => {
    const obs = { ...(study.obs || {}) }
    const reads = [...(obs[key]?.reads || [])]; reads[idx] = val
    obs[key] = { ...(obs[key] || {}), reads }
    patch({ obs })
  }
  const clearRead = (key, idx) => setRead(key, idx, '')
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

  // a round is complete only when EVERY station has all 5 readings; completing LOCKS it (read-only)
  const stDone = (key) => [0, 1, 2, 3, 4].every(i => Number(readsOf(key)[i]) > 0)
  const doneCount = stations.filter(st => stDone(st.key)).length
  const allComplete = stations.length > 0 && doneCount === stations.length
  const locked = allComplete

  // ---- calculations ----
  const rows = stations.map(st => { const a = round(avgOf(readsOf(st.key)), 3); return { ...st, avg: a, cap: a > 0 ? Math.floor(60 / a) : 0 } })
  const observed = rows.filter(r => r.avg > 0)
  const totalTime = round(observed.reduce((s, r) => s + r.avg, 0), 2)
  const workers = stations.length
  // SMV of the processes actually placed on the line (the stations being studied)
  const placedSls = new Set(Object.values(mops).flat())
  const smv = round([...placedSls].reduce((s, sl) => s + (opBySl[sl]?.smv || 0), 0), 2)
  // pitch time (takt) = Total SMV ÷ manpower — the per-station balancing target the layout was built on
  const pitch = style.manpower > 0 ? round(computeOB(ops, style.manpower).pitchTime, 3) : 0
  const pBand = round(pitch * 0.1, 3)   // ±10% balance window around pitch
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

  const caps = observed.map(r => ({ label: r.label, name: r.name, value: r.cap }))
  const H = study.header || {}
  const setH = (k, v) => patch({ header: { ...H, [k]: v } })

  const Field = ({ k, children }) => <div className="ct-f"><span>{k}</span>{children}</div>

  return (
    <div>
      <div className="page-head">
        <div><h1>9 · Cycle Time</h1><div className="sub">Operator time study on the verified layout · 5 readings per station</div></div>
        <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
          <Badge tone={allComplete ? 'green' : 'amber'}>{allComplete ? '🔒 Complete & locked' : `${doneCount}/${stations.length} stations done`}</Badge>
          <button className="btn primary" disabled={!allComplete} title={allComplete ? '' : 'Capture all 5 cycles for every station first'}
            onClick={() => { updateStyle(style.id, { cycleStudies: studies, step: Math.max(style.step, 10), status: 'Skill Matrix' }); nav(`/style/${style.id}/skill`) }}>Next: Skill Matrix →</button>
        </div>
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
          <span className="hint">{locked ? '🔒 Round complete & locked — delete a cycle (✕) to re-measure' : 'capture 5 cycles per station · ✕ deletes a cycle'}{pitch > 0 ? ` · status vs pitch ${pitch} min (±10%)` : ''}</span>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 460 }}>
          <table className="ct-table">
            <thead><tr><th>Station</th><th>Process</th><th>M/c</th><th>Operator</th><th>⏱ Timer</th><th className="num" colSpan={5}>5 Cycle Times (min)</th><th className="num">Avg</th><th className="num">Cap/hr</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(st => {
                const reads = readsOf(st.key)
                // status vs PITCH TIME: within ±10% of pitch = balanced; above = bottleneck; below = fast
                const within = st.avg > 0 && pitch > 0 && st.avg <= pitch + pBand && st.avg >= pitch - pBand
                const running = timer && timer.key === st.key
                const full = stDone(st.key)
                const secs = running ? ((nowTs - timer.start) / 1000).toFixed(1) : null
                return (
                  <tr key={st.key} style={st.nnva ? { background: '#faf7ff' } : null}>
                    <td className="mono"><b>{st.label}</b></td>
                    <td style={{ minWidth: 150 }}><b style={{ fontSize: 11.5 }}>{st.name}</b> {st.nnva ? <Badge tone="violet">NNVA</Badge> : null}</td>
                    <td><Badge tone="blue">{st.machine}</Badge></td>
                    <td>
                      <select className="inp ct-in" style={{ minWidth: 120 }} value={opFor(st)} disabled={full} onChange={e => setOp(st.key, e.target.value)}>
                        <option value="">— operator —</option>
                        {lineOperators.map(o => <option key={o.id} value={o.id}>{o.name} · {o.grade}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn sm" disabled={full && !running}
                        style={{ minWidth: 76, background: running ? '#dc2626' : full ? undefined : '#16a34a', color: running || !full ? '#fff' : undefined, borderColor: running ? '#dc2626' : full ? undefined : '#16a34a' }}
                        onClick={() => toggleTimer(st.key)} title={running ? 'Stop & record' : full ? 'All 5 captured — delete a cycle to re-time' : 'Start timing this cycle'}>
                        {running ? `■ ${secs}s` : full ? '✓ 5/5' : '▶ Start'}
                      </button>
                    </td>
                    {[0, 1, 2, 3, 4].map(i => (
                      <td key={i} className="num">
                        {Number(reads[i]) > 0
                          ? <span className="ct-read-done">{reads[i]}<button className="ct-read-x" title="Delete this cycle — you'll re-measure it" onClick={() => clearRead(st.key, i)}>✕</button></span>
                          : <input className="inp ct-read" type="number" step="0.01" value={reads[i] ?? ''} onChange={e => setRead(st.key, i, e.target.value)} />}
                      </td>
                    ))}
                    <td className="num mono" style={{ fontWeight: 700 }}>{st.avg || '—'}</td>
                    <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{st.cap || '—'}</td>
                    <td>{st.avg <= 0 ? <span className="muted">—</span> : !pitch ? '—' : within ? <Badge tone="green">In control</Badge> : st.avg > pitch + pBand ? <Badge tone="red">Bottleneck</Badge> : <Badge tone="blue">Fast</Badge>}</td>
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
