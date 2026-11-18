import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { computeOB, round, uclCT, lclCT, cycleGap, effPct } from '../engine/calc.js'

const ROUNDS = [
  { n: 1, label: '1st · Non-Balance', when: 'Day 2–3' },
  { n: 2, label: '2nd · Balance', when: 'Day 4–5' },
  { n: 3, label: '3rd · Re-Balance', when: 'Day 7–8' },
  { n: 4, label: '4th · Re-Balance', when: 'Volume' },
  { n: 5, label: '5th · Re-Balance', when: 'Volume' },
]
const avgOf = (reads) => { const r = (reads || []).map(Number).filter(x => x > 0); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0 }

// self-contained running timer — re-renders only itself (so the table doesn't blink)
function RunSecs({ start }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 200); return () => clearInterval(id) }, [])
  return <>{((Date.now() - start) / 1000).toFixed(1)}</>
}
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
  const [timer, setTimer] = useState(null)        // { key, start } — running stopwatch (display handled by <RunSecs/>)
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
  // one row PER PROCESS — a machine with 2 processes is timed individually (W27 appears twice)
  const baseStations = Object.keys(mops).map(Number).filter(m => (mops[m] || []).length).sort((a, b) => a - b)
    .flatMap(m => {
      const procs = (mops[m] || []).map(sl => opBySl[sl]).filter(Boolean)
      return procs.map((o) => ({
        key: 'M' + m + '-' + o.sl, label: 'W' + m, m,
        name: o.name, machine: o.machine, smv: o.smv || 0, defaultOp: machineWorker[m], nnva: !!o.nnva,
      }))
    })
  // apply the user's custom order (move up/down); new stations append in default order
  const savedOrder = Array.isArray(study.order) ? study.order : []
  const stations = [...savedOrder.map(k => baseStations.find(s => s.key === k)).filter(Boolean), ...baseStations.filter(s => !savedOrder.includes(s.key))]
  const moveStation = (key, dir) => {
    const cur = stations.map(s => s.key); const i = cur.indexOf(key); const j = i + dir
    if (i < 0 || j < 0 || j >= cur.length) return
    const arr = [...cur];[arr[i], arr[j]] = [arr[j], arr[i]]; patch({ order: arr })
  }

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
  // Lap: first press starts; each press records the split and keeps timing the next cycle; auto-stops after the 5th
  const lapTimer = (key) => {
    if (!(timer && timer.key === key)) { setTimer({ key, start: Date.now() }); return }
    const empties = [0, 1, 2, 3, 4].filter(i => !(Number((study.obs?.[key]?.reads || [])[i]) > 0))
    recordRead(key, (Date.now() - timer.start) / 60000)
    if (empties.length <= 1) setTimer(null); else setTimer({ key, start: Date.now() })
  }

  // a round is complete only when EVERY station has all 5 readings; completing LOCKS it (read-only)
  const stDone = (key) => [0, 1, 2, 3, 4].every(i => Number(readsOf(key)[i]) > 0)
  const doneCount = stations.filter(st => stDone(st.key)).length
  const allComplete = stations.length > 0 && doneCount === stations.length
  const allOp = stations.length > 0 && stations.every(st => opFor(st))   // every station needs an operator (EMP ID + name)
  const locked = allComplete
  // sequential: only the first not-yet-complete station is active; everything after it is locked
  const activeIdx = stations.findIndex(st => !stDone(st.key))   // -1 when all done

  // ---- calculations ----
  const ALLOWANCE = 1.15   // 15% allowance added to the observed average cycle time
  const rows = stations.map(st => { const a = round(avgOf(readsOf(st.key)) * ALLOWANCE, 3); return { ...st, avg: a, cap: a > 0 ? Math.floor(60 / a) : 0 } })
  // rowspan for the merged Station cell: >0 = first row of a machine group (span N), 0 = continuation
  const machineSpan = rows.map((st, i) => {
    if (i > 0 && rows[i - 1].m === st.m) return 0
    let s = 1; for (let j = i + 1; j < rows.length && rows[j].m === st.m; j++) s++
    return s
  })
  const observed = rows.filter(r => r.avg > 0)
  const totalTime = round(observed.reduce((s, r) => s + r.avg, 0), 2)
  const workers = new Set(stations.map(s => s.m)).size   // distinct machines = operators (a machine may hold 2 processes)
  // SMV of the processes actually placed on the line (the stations being studied)
  const placedSls = new Set(Object.values(mops).flat())
  const smv = round([...placedSls].reduce((s, sl) => s + (opBySl[sl]?.smv || 0), 0), 2)
  // auto Total Machine / Non-Machine time (CR Cycle 4): machine processes vs Manual/HP/QC
  const macTime = round([...placedSls].reduce((s, sl) => { const o = opBySl[sl]; return s + (o && !/^(MANUAL|HP|QC)$/i.test(o.machine || '') ? (o.smv || 0) : 0) }, 0), 2)
  const nonMacTime = round(smv - macTime, 2)
  // pitch time (takt) = Total SMV ÷ manpower — the per-station balancing target the layout was built on
  const pitch = style.manpower > 0 ? round(computeOB(ops, style.manpower).pitchTime, 3) : 0
  const pBand = round(pitch * 0.1, 3)   // ±10% balance window around pitch
  const b = workers && totalTime ? round(totalTime / workers, 4) : 0
  const U = b ? uclCT(b) : 0, L = b ? lclCT(b) : 0
  const potential = b ? Math.floor(60 / b) : 0
  const capHi = L ? Math.floor(60 / L) : 0   // fastest (LCL time → high capacity)
  const capLo = U ? Math.floor(60 / U) : 0   // slowest allowed (UCL time → low capacity); below = bottleneck
  const currentPcs = Number(study.currentPcs) || 0
  // worker performance = earned SMV ÷ allowed time (the 15% allowance is already in totalTime)
  const perf = totalTime ? round((smv / totalTime) * 100, 1) : 0
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

  const FAC = { AGL: 'ANANTA GARMENTS LTD', AJL: 'ANANTA JEANSWEAR LTD', ASL: 'ANANTA SPORTSWEAR LTD', ABM: 'ABM FASHIONS LTD' }
  const printCycle = () => {
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n')
    const chunk = 20, groups = []
    for (let i = 0; i < rows.length; i += chunk) groups.push({ off: i, list: rows.slice(i, i + chunk) })
    const grid = groups.map(g => {
      const sl = g.list.map((_, k) => `<td>${g.off + k + 1}</td>`).join('')
      const pr = g.list.map(st => `<td class="pn">${st.name || ''}</td>`).join('')
      const op = g.list.map(st => `<td>${(opById[opFor(st)]?.name) || ''}</td>`).join('')
      const cp = g.list.map(st => `<td class="cap">${st.avg > 0 ? st.cap : ''}</td>`).join('')
      return `<table class="ctg"><tr class="h"><td>SL</td>${sl}</tr><tr><td>Process</td>${pr}</tr><tr><td>O/P Name</td>${op}</tr><tr class="cp"><td>Cap/hr</td>${cp}</tr></table>`
    }).join('')
    const hdr = (pairs) => pairs.map(([k, v]) => `<tr><td class="k">${k}</td><td class="c">:</td><td class="v">${v ?? ''}</td></tr>`).join('')
    const left = hdr([['Date', H.date || ''], ['Style', style.styleNo], ['Buyer', style.buyer], ['Observer', H.observer || user.name]])
    const mid = hdr([['Factory', style.factory], ['Section', H.section || 'SEWING'], ['Line', line.name], ['Item', style.item]])
    const mc = hdr([['Total Obs Time', totalTime], ['Total M/c Cont. Time', macTime], ['Total Non-M/c Cont. Time', nonMacTime], ['Graph #', H.graph || `BALANCING-0${roundN}`]])
    const sum = [['Total Time', totalTime], ['Bpt', b], ['UCL', U], ['LCL', L], ['Workers', workers], ['Worker Potential /hr', potential], ['Worker Potential /10hr', potential * 10], ['Current Pcs/hr', currentPcs || '—'], ['Worker Perf %', perf + '%'], ['Productivity Gap %', gap + '%'], ['Planned Peak E %', peakEff + '%'], ['Planned Current E %', currentEff + '%']]
    const sumHtml = sum.map(([k, v]) => `<div class="s"><span>${k}</span><b>${v}</b></div>`).join('')
    const css = `@page{size:A4 landscape;margin:8mm}body{margin:0;background:#fff;color:#14303f;font-family:Arial,Helvetica,sans-serif;font-size:10px}.no-print{display:none!important}
      .ct-title{text-align:center;margin-bottom:8px}.ct-title h1{margin:0;font-size:18px}.ct-title h2{margin:2px 0 0;font-size:13px;color:#334155}
      .ct-smv{font-weight:800;font-size:12px;margin-bottom:6px}
      .ct-hdr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px}
      .kv{width:100%;border-collapse:collapse}.kv td{border:1px solid #cbd5e1;padding:3px 6px}.kv .k{background:#eef2f7;font-weight:700;width:42%}.kv .c{width:8px}.kv .v{font-weight:600}
      .ct-sum{display:flex;flex-wrap:wrap;gap:0;border:1px solid #cbd5e1;margin-bottom:10px}.ct-sum .s{flex:1 1 16%;min-width:110px;border:1px solid #e2e8f0;padding:4px 7px;display:flex;justify-content:space-between;gap:6px}.ct-sum .s span{color:#64748b}
      .ctg{border-collapse:collapse;width:100%;margin-bottom:8px;table-layout:fixed}.ctg td{border:1px solid #cbd5e1;padding:2px 3px;text-align:center;overflow:hidden;vertical-align:top}
      .ctg td:first-child{width:62px;background:#eef2f7;font-weight:700;text-align:left}
      .ctg .h td{background:#e2e8f0;font-weight:700}.ctg .pn{font-size:8px;line-height:1.1;height:46px}.ctg .cp td,.ctg tr.cp td{color:#dc2626;font-weight:700}
      @media print{.ctg{break-inside:avoid}}`
    const w = window.open('', '_blank', 'width=1200,height=800')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Cycle Time — ${style.styleNo || ''}</title>${styles}<style>${css}</style></head><body>
      <div class="ct-title"><h1>${FAC[style.factory] || 'ANANTA COMPANIES'}</h1><h2>Cycle Time — Line Balancing (${H.graph || `BALANCING-0${roundN}`})</h2></div>
      <div class="ct-smv">S.M.V : ${smv}</div>
      <div class="ct-hdr"><table class="kv">${left}</table><table class="kv">${mid}</table><table class="kv">${mc}</table></div>
      <div class="ct-sum">${sumHtml}</div>
      ${grid}
      </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => { w.print(); w.close() }, 450)
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>9 · Cycle Time</h1><div className="sub">Operator time study on the verified layout · 5 readings per station</div></div>
        <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={printCycle} title="Print the cycle-time balancing sheet">🖨 Print</button>
          <Badge tone={allComplete && allOp ? 'green' : 'amber'}>{!allComplete ? `${doneCount}/${stations.length} stations done` : !allOp ? 'assign an operator to every station' : '🔒 Complete & locked'}</Badge>
          <button className="btn primary" disabled={!allComplete || !allOp} title={!allComplete ? 'Capture all 5 cycles for every station first' : !allOp ? 'Every station needs an operator (EMP ID + name)' : ''}
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
        <Field k="Total M/c Cont. Time"><b className="mono" style={{ color: '#2563eb' }}>{macTime}</b> <span className="muted">min (auto)</span></Field>
        <Field k="Total Non-M/c Cont. Time"><b className="mono" style={{ color: '#0891b2' }}>{nonMacTime}</b> <span className="muted">min (auto)</span></Field>
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
          <span className="hint">{locked ? '🔒 Round complete & locked — delete a cycle (✕) to re-measure' : 'sequential: finish a station’s 5 cycles to unlock the next · ▲▼ reorder · Avg incl. 15% allowance'}{pitch > 0 ? ` · status vs pitch ${pitch} min` : ''}</span>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 460 }}>
          <table className="ct-table">
            <thead><tr><th>Station</th><th>Process</th><th>M/c</th><th>Operator</th><th>⏱ Timer</th><th className="num" colSpan={5}>5 Cycle Times (min)</th><th className="num">Avg +15%</th><th className="num">Cap/hr</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((st, idx) => {
                const reads = readsOf(st.key)
                // status vs PITCH TIME: within ±10% of pitch = balanced; above = bottleneck; below = fast
                const within = st.avg > 0 && pitch > 0 && st.avg <= pitch + pBand && st.avg >= pitch - pBand
                const running = timer && timer.key === st.key
                const full = stDone(st.key)
                // sequential: locked until every earlier station has its 5 cycles
                const seqLocked = activeIdx >= 0 && idx > activeIdx
                const mv = { fontSize: 8, lineHeight: 1, padding: '1px 3px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', borderRadius: 3 }
                return (
                  <tr key={st.key} style={st.nnva ? { background: '#faf7ff' } : seqLocked ? { background: '#f8fafc', opacity: 0.55 } : null}>
                    {machineSpan[idx] > 0 ? <td className="mono" rowSpan={machineSpan[idx]} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--line)', fontWeight: 700 }}>{st.label}</td> : null}
                    <td style={{ minWidth: 150 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {!locked ? <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
                          <button style={mv} title="Move up" onClick={() => moveStation(st.key, -1)} disabled={idx === 0}>▲</button>
                          <button style={mv} title="Move down" onClick={() => moveStation(st.key, 1)} disabled={idx === rows.length - 1}>▼</button>
                        </span> : null}
                        <b style={{ fontSize: 11.5 }}>{st.name}</b>
                      </span> {seqLocked ? <Badge tone="gray">🔒 locked</Badge> : null} {st.nnva ? <Badge tone="violet">NNVA</Badge> : null}</td>
                    <td><Badge tone="blue">{st.machine}</Badge></td>
                    <td>
                      <select className="inp ct-in" style={{ minWidth: 120 }} value={opFor(st)} disabled={full || seqLocked} onChange={e => setOp(st.key, e.target.value)}>
                        <option value="">— operator —</option>
                        {lineOperators.map(o => <option key={o.id} value={o.id}>{o.id} · {o.name}{o.grade ? ' · ' + o.grade : ''}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn sm" disabled={(full && !running) || seqLocked}
                        style={{ minWidth: 82, background: running ? '#2563eb' : full ? undefined : seqLocked ? undefined : '#16a34a', color: running || (!full && !seqLocked) ? '#fff' : undefined, borderColor: running ? '#2563eb' : full ? undefined : seqLocked ? undefined : '#16a34a' }}
                        onClick={() => lapTimer(st.key)} title={seqLocked ? 'Finish the earlier stations first' : running ? 'Lap — record this cycle & keep timing the next' : full ? 'All 5 captured — delete a cycle to re-time' : 'Start timing · then tap Lap each cycle'}>
                        {running ? <>⏱ Lap <RunSecs start={timer.start} />s</> : full ? '✓ 5/5' : seqLocked ? '🔒' : '▶ Start'}
                      </button>
                    </td>
                    {[0, 1, 2, 3, 4].map(i => (
                      <td key={i} className="num">
                        {Number(reads[i]) > 0
                          ? <span className="ct-read-done">{reads[i]}<button className="ct-read-x" title="Delete this cycle — you'll re-measure it" onClick={() => clearRead(st.key, i)}>✕</button></span>
                          : <input className="inp ct-read" type="number" step="0.01" disabled={seqLocked} value={reads[i] ?? ''} onChange={e => setRead(st.key, i, e.target.value)} />}
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
