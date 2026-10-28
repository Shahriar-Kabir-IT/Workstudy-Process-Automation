import { useState, useMemo } from 'react'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { gradeFromEff, round } from '../engine/calc.js'
import { useStore } from '../store.jsx'

const ALLOWANCE = 1.15   // 15% allowance added to observed average cycle time
const avgOf = (reads) => { const r = (reads || []).map(Number).filter(x => x > 0); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0 }
const effColor = (e) => e == null ? '#94a3b8' : e >= 90 ? '#16a34a' : e >= 75 ? '#65a30d' : e >= 60 ? '#d97706' : '#dc2626'
const gradeTone = (g) => g?.startsWith('A') ? 'green' : g === 'B' ? 'blue' : g === 'C' ? 'amber' : 'red'

// horizontal efficiency bars for the worker's top processes
function EffBars({ rows }) {
  if (!rows.length) return null
  const max = Math.max(100, ...rows.map(r => r.avgEff))
  return (
    <div className="sm-bars">
      {rows.map(r => (
        <div key={r.name} className="sm-bar-row">
          <div className="sm-bar-lbl" title={r.name}>{r.name}</div>
          <div className="sm-bar-track">
            <div className="sm-bar-fill" style={{ width: `${(r.avgEff / max) * 100}%`, background: effColor(r.avgEff) }} />
          </div>
          <div className="sm-bar-val" style={{ color: effColor(r.avgEff) }}>{r.avgEff}%</div>
        </div>
      ))}
    </div>
  )
}

export default function SkillMatrix({ style }) {
  const { allStyles, operatorsFor } = useStore()
  const roster = operatorsFor(style.factory)
  const [q, setQ] = useState('')
  const [workerId, setWorkerId] = useState('')

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return roster.filter(o => String(o.id).toLowerCase().includes(s) || (o.name || '').toLowerCase().includes(s)).slice(0, 8)
  }, [q, roster])

  const worker = roster.find(o => String(o.id) === String(workerId))

  // aggregate EVERY cycle-time study (across all styles of this factory) where this worker ran a station
  const history = useMemo(() => {
    if (!worker) return []
    const recs = []
    for (const st of allStyles) {
      if (st.factory !== style.factory) continue
      const ops = st.ops || []
      const mops = st.machineOps || {}
      const machineWorker = st.machineWorker || {}
      const opBySl = Object.fromEntries(ops.map(o => [o.sl, o]))
      const studies = st.cycleStudies || {}
      for (const [roundN, study] of Object.entries(studies)) {
        const obs = study?.obs || {}
        for (const [key, cell] of Object.entries(obs)) {
          const m = Number(String(key).replace(/^M/, ''))
          const assigned = cell?.op || machineWorker[m] || ''
          if (String(assigned) !== String(worker.id)) continue
          const avgRaw = avgOf(cell?.reads)
          if (avgRaw <= 0) continue
          const avg = round(avgRaw * ALLOWANCE, 3)   // average cycle time incl. 15% allowance
          const procs = (mops[m] || []).map(sl => opBySl[sl]).filter(Boolean)
          if (!procs.length) continue
          const smv = round(procs.reduce((s, p) => s + (p.smv || 0), 0), 3)
          const name = procs.map(p => p.name).join(' + ')
          const machine = [...new Set(procs.map(p => p.machine))].join('/')
          // efficiency = SMV ÷ average cycle time (incl. 15% allowance) × 100
          const eff = smv > 0 ? Math.round((smv / avg) * 100) : null
          recs.push({
            styleNo: st.styleNo, buyer: st.buyer, round: Number(roundN),
            name, machine, smv, avg, eff,
            cycles: (cell.reads || []).filter(x => Number(x) > 0).length,
            date: study?.header?.date || '', nnva: procs.some(p => p.nnva),
          })
        }
      }
    }
    return recs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.round - a.round)
  }, [worker, allStyles, style.factory])

  // per-process rollup
  const byProcess = useMemo(() => {
    const map = new Map()
    for (const r of history) {
      const g = map.get(r.name) || { name: r.name, machine: r.machine, times: 0, effs: [], smv: r.smv, bestCycle: Infinity, lastDate: '', nnva: r.nnva }
      g.times++
      if (r.eff != null) g.effs.push(r.eff)
      g.bestCycle = Math.min(g.bestCycle, r.avg)
      if ((r.date || '') > g.lastDate) g.lastDate = r.date || ''
      map.set(r.name, g)
    }
    return [...map.values()].map(g => ({
      ...g,
      avgEff: g.effs.length ? Math.round(g.effs.reduce((a, b) => a + b, 0) / g.effs.length) : null,
      bestEff: g.effs.length ? Math.max(...g.effs) : null,
      bestCycle: g.bestCycle === Infinity ? null : round(g.bestCycle, 3),
    })).sort((a, b) => (b.avgEff ?? -1) - (a.avgEff ?? -1))
  }, [history])

  // KPIs
  const measured = history.filter(r => r.eff != null)
  const avgEff = measured.length ? Math.round(measured.reduce((s, r) => s + r.eff, 0) / measured.length) : null
  const best = measured.length ? measured.reduce((a, b) => (b.eff > a.eff ? b : a)) : null
  const bestProc = byProcess.filter(p => p.avgEff != null)[0] || null
  const machines = [...new Set(history.map(r => r.machine).filter(Boolean))]
  const stylesWorked = [...new Set(history.map(r => r.styleNo))]
  const totalCycles = history.reduce((s, r) => s + r.cycles, 0)
  const grade = avgEff != null ? gradeFromEff(avgEff) : '—'

  return (
    <div>
      <div className="page-head">
        <div><h1>10 · Skill Matrix</h1><div className="sub">Responsible: WSE · search a worker to see their lifetime process history &amp; KPIs</div></div>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      {/* search */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 420 }}>
          <label>🔎 Search worker (ID or name) · {roster.length} on {style.factory}</label>
          <input className="inp" value={q} placeholder="e.g. 10231 or Rahim" onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) { setWorkerId(matches[0].id); setQ('') } }} />
        </div>
        {matches.length ? (
          <div className="flex wrap" style={{ gap: 8, marginTop: 10 }}>
            {matches.map(o => (
              <button key={o.id} className="btn sm" onClick={() => { setWorkerId(o.id); setQ('') }}
                style={{ borderColor: String(o.id) === String(workerId) ? '#2563eb' : undefined }}>
                <b className="mono">{o.id}</b> · {o.name} <span className="muted">· {o.machine || '—'} · L{o.line}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!worker ? (
        <Note tone="blue">Search a worker by their <b>ID or name</b> above. The matrix pulls every cycle-time study they appear in — across all styles of {style.factory} — and ranks their processes by efficiency.</Note>
      ) : (
        <>
          {/* worker identity */}
          <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="sm-avatar">{(worker.name || '?').slice(0, 1)}</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{worker.name}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>ID <b className="mono">{worker.id}</b> · {worker.machine || '—'} · Line {worker.line} · {worker.factory}</div>
            </div>
            <Badge tone={gradeTone(grade)}>Grade {grade}</Badge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: effColor(avgEff) }}>{avgEff != null ? avgEff + '%' : '—'}</div>
              <div className="ct-l">avg efficiency</div>
            </div>
          </div>

          {!history.length ? (
            <Note>No cycle-time studies recorded for <b>{worker.name}</b> yet. Their KPIs appear here once they are timed on a station (step 9 · Cycle Time).</Note>
          ) : (
            <>
              <div className="grid cols-4" style={{ marginBottom: 16 }}>
                <Stat label="Processes done" value={byProcess.length} foot={`${history.length} studies`} accent="#2563eb" />
                <Stat label="Machines operated" value={machines.length} foot={machines.slice(0, 4).join(', ')} accent="#0891b2" />
                <Stat label="Styles worked" value={stylesWorked.length} foot={`${totalCycles} cycles timed`} accent="#7c3aed" />
                <Stat label="Best efficiency" value={best ? best.eff : '—'} unit={best ? '%' : ''} foot={best ? best.name.slice(0, 22) : ''} accent="#16a34a" />
              </div>

              {/* most efficient process hero */}
              {bestProc ? (
                <div className="card card-pad sm-hero" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="ct-l">⭐ Most efficient process</div>
                    <div style={{ fontSize: 17, fontWeight: 700, margin: '2px 0' }}>{bestProc.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{bestProc.machine} · SMV <b>{bestProc.smv ?? '—'}</b> · best cycle <b>{bestProc.bestCycle} min</b> · done {bestProc.times}×</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: effColor(bestProc.avgEff) }}>{bestProc.avgEff}%</div>
                    <div className="ct-l">avg · peak {bestProc.bestEff}%</div>
                  </div>
                </div>
              ) : null}

              <div className="sm-split">
                {/* per-process table */}
                <div className="card">
                  <div className="card-head"><h3>Processes performed</h3><span className="hint">ranked by avg efficiency · SMV ÷ avg cycle time</span></div>
                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
                    <table>
                      <thead><tr><th>Process</th><th>M/c</th><th className="num">Times</th><th className="num">SMV</th><th className="num">Best cyc</th><th className="num">Avg Eff</th><th className="num">Peak</th><th>Last</th></tr></thead>
                      <tbody>
                        {byProcess.map(p => (
                          <tr key={p.name}>
                            <td><b style={{ fontSize: 11.5 }}>{p.name}</b> {p.nnva ? <Badge tone="violet">NNVA</Badge> : null}</td>
                            <td><Badge tone="blue">{p.machine}</Badge></td>
                            <td className="num mono">{p.times}</td>
                            <td className="num mono muted">{p.smv ?? '—'}</td>
                            <td className="num mono">{p.bestCycle ?? '—'}</td>
                            <td className="num mono" style={{ fontWeight: 700, color: effColor(p.avgEff) }}>{p.avgEff != null ? p.avgEff + '%' : '—'}</td>
                            <td className="num mono" style={{ color: effColor(p.bestEff) }}>{p.bestEff != null ? p.bestEff + '%' : '—'}</td>
                            <td className="muted mono" style={{ fontSize: 11 }}>{p.lastDate || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* efficiency bars */}
                <div className="card card-pad">
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Efficiency by process</div>
                  <EffBars rows={byProcess.filter(p => p.avgEff != null).slice(0, 10)} />
                </div>
              </div>

              {/* history log */}
              <div className="card mt">
                <div className="card-head"><h3>Study history</h3><span className="hint">{history.length} records · newest first · cycle time incl. 15% allowance</span></div>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 360 }}>
                  <table>
                    <thead><tr><th>Date</th><th>Style</th><th>Buyer</th><th className="num">Rnd</th><th>Process</th><th>M/c</th><th className="num">SMV</th><th className="num">Avg cyc (+15%)</th><th className="num">Cap/hr</th><th className="num">Eff</th></tr></thead>
                    <tbody>
                      {history.map((r, i) => (
                        <tr key={i}>
                          <td className="mono muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                          <td className="mono"><b>{r.styleNo}</b></td>
                          <td className="muted" style={{ fontSize: 11.5 }}>{r.buyer || '—'}</td>
                          <td className="num mono">{r.round}</td>
                          <td><span style={{ fontSize: 11.5 }}>{r.name}</span></td>
                          <td><Badge tone="blue">{r.machine}</Badge></td>
                          <td className="num mono">{r.smv || '—'}</td>
                          <td className="num mono">{r.avg}</td>
                          <td className="num mono" style={{ color: '#16a34a' }}>{r.avg > 0 ? Math.floor(60 / r.avg) : '—'}</td>
                          <td className="num mono" style={{ fontWeight: 700, color: effColor(r.eff) }}>{r.eff != null ? r.eff + '%' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Note tone="blue">Efficiency = SMV ÷ average cycle time × 100, where the average cycle time already includes a <b>15% allowance</b> (observed average × 1.15). 100% = on standard. NNVA processes carry no SMV, so they show in history but not in the ranking.</Note>
            </>
          )}
        </>
      )}
    </div>
  )
}
