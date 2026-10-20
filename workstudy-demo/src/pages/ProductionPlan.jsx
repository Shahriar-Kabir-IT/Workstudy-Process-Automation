import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge } from '../components/ui.jsx'
import { computeOB, round } from '../engine/calc.js'

const iso = (d) => d.toISOString().slice(0, 10)
const fmtDay = (s) => new Date(s + 'T00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
const wkday = (s) => new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' })
const isFriday = (s) => new Date(s + 'T00:00').getDay() === 5

// compact combined chart: daily output bars + cumulative line (single scale)
function PlanChart({ rows, color, title, max }) {
  const W = 330, H = 160, pad = { l: 36, r: 10, t: 14, b: 22 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const n = rows.length || 1
  const bw = iw / n
  const y = (v) => pad.t + ih - (max > 0 ? (v / max) * ih : 0)
  const linePts = rows.map((r, i) => `${(pad.l + i * bw + bw / 2).toFixed(1)},${y(r.cum).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map(f => ({ v: Math.round(max * f), yy: y(max * f) }))
  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{title}</span>
        <span className="mono" style={{ fontSize: 11, color }}>{rows.length ? rows[rows.length - 1].cum.toLocaleString() : 0} pcs</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={t.yy} x2={W - pad.r} y2={t.yy} stroke="#eef2f7" />
            <text x={pad.l - 4} y={t.yy + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{t.v}</text>
          </g>
        ))}
        {rows.map((r, i) => r.day > 0 ? (
          <rect key={i} x={pad.l + i * bw + bw * 0.2} y={y(r.day)} width={bw * 0.6} height={Math.max(0, pad.t + ih - y(r.day))} rx="1.5" fill={color} opacity="0.3" />
        ) : null)}
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {rows.map((r, i) => <circle key={i} cx={pad.l + i * bw + bw / 2} cy={y(r.cum)} r="2" fill={color} />)}
        {rows.map((r, i) => (i % Math.ceil(n / 7) === 0) ? (
          <text key={i} x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="7.5" fill="#94a3b8">{r.label}</text>
        ) : null)}
      </svg>
    </div>
  )
}

export default function ProductionPlan({ style }) {
  const nav = useNavigate()
  const { updateStyle } = useStore()
  const tSMV = style.ops?.length ? computeOB(style.ops, style.manpower).totalSMV : (style.smv || 0)
  const pp = style.productionPlan || {}
  const [workingHours, setWorkingHours] = useState(pp.workingHours || 10)
  const [startDate, setStartDate] = useState(pp.startDate || iso(new Date()))
  const [numDays, setNumDays] = useState(pp.numDays || 14)
  const [entries, setEntries] = useState(pp.entries || {})

  const persist = (patch) => updateStyle(style.id, { productionPlan: { workingHours, startDate, numDays, entries, ...patch } })
  const setHours = (v) => { const n = Number(v) || 0; setWorkingHours(n); persist({ workingHours: n }) }
  const setStart = (v) => { setStartDate(v); persist({ startDate: v }) }
  const setN = (v) => { const n = Math.max(1, Math.min(60, Number(v) || 1)); setNumDays(n); persist({ numDays: n }) }
  const setEntry = (date, field, val) => {
    const next = { ...entries, [date]: { ...(entries[date] || {}), [field]: val } }
    setEntries(next); persist({ entries: next })
  }

  // dates
  const dates = []
  const d0 = new Date(startDate + 'T00:00')
  for (let i = 0; i < numDays; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); dates.push(iso(d)) }

  const availMin = style.manpower * workingHours * 60
  const eff = (out) => (availMin > 0 && out > 0 ? round((out * tSMV) / availMin * 100, 1) : 0)

  let pc = 0, ac = 0
  const rows = dates.map(dt => {
    const e = entries[dt] || {}
    const plan = Number(e.plan) || 0, act = Number(e.actual) || 0
    pc += plan; ac += act
    return { dt, raw: e, plan, act, planCum: pc, actCum: ac, planEff: eff(plan), actEff: eff(act), fri: isFriday(dt) }
  })
  const maxCum = Math.max(...rows.map(r => r.planCum), ...rows.map(r => r.actCum), 1)
  const planChart = rows.map(r => ({ label: fmtDay(r.dt), day: r.plan, cum: r.planCum }))
  const actChart = rows.map(r => ({ label: fmtDay(r.dt), day: r.act, cum: r.actCum }))
  const totPlan = pc, totAct = ac
  const achv = totPlan > 0 ? round(totAct / totPlan * 100, 1) : 0

  const Info = ({ k, v, auto = true }) => (
    <div className="pp-info"><span>{k}</span><b>{v}{auto ? null : null}</b></div>
  )

  return (
    <div>
      <div className="page-head">
        <div><h1>7 · Production Plan &amp; Actual</h1></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/changeover`)}>Next: Change Over →</button>
      </div>
      <div style={{ marginBottom: 14 }}><ProgressRail step={style.step} /></div>

      {/* header info strip — fields come from the style; working hours is manual */}
      <div className="card card-pad pp-head">
        <Info k="Buyer" v={style.buyer || '—'} />
        <Info k="Style No" v={style.styleNo} />
        <Info k="Product" v={style.item} />
        <Info k="Ord. Qty" v={(style.order || 0).toLocaleString()} />
        <Info k="S.M.V." v={tSMV} />
        <Info k="Manpower" v={style.manpower} />
        <Info k="Line" v={style.layoutLine?.name || style.line || '—'} />
        <div className="pp-info"><span>Working Hours</span>
          <input className="inp" type="number" min="1" max="24" value={workingHours} onChange={e => setHours(e.target.value)} style={{ height: 28, width: 64, padding: '2px 6px' }} />
        </div>
      </div>

      {/* controls */}
      <div className="flex wrap" style={{ gap: 12, margin: '12px 0', alignItems: 'end' }}>
        <div className="field" style={{ width: 160 }}><label>Plan start date</label><input className="inp" type="date" value={startDate} onChange={e => setStart(e.target.value)} /></div>
        <div className="field" style={{ width: 90 }}><label>Days</label><input className="inp" type="number" min="1" max="60" value={numDays} onChange={e => setN(e.target.value)} /></div>
        <div className="flex" style={{ gap: 14, marginLeft: 'auto', fontSize: 12.5 }}>
          <span className="muted">Planned <b style={{ color: '#2563eb' }}>{totPlan.toLocaleString()}</b></span>
          <span className="muted">Actual <b style={{ color: '#16a34a' }}>{totAct.toLocaleString()}</b></span>
          <span className="muted">Achievement <b style={{ color: achv >= 100 ? '#16a34a' : '#d97706' }}>{achv}%</b></span>
        </div>
      </div>

      {/* split: data entry (left) + graphs (right) */}
      <div className="pp-split">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head"><h3>Daywise Plan &amp; Actual</h3><span className="hint">enter Day Output &amp; Remarks · the rest auto-calculates</span></div>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Date</th>
                  <th colSpan={3} style={{ background: '#eff4f8', color: '#2563eb' }}>Plan</th>
                  <th colSpan={3} style={{ background: '#eefbf3', color: '#16a34a' }}>Actual</th>
                  <th rowSpan={2}>Remarks</th>
                </tr>
                <tr>
                  <th className="num">Day</th><th className="num">Cum.</th><th className="num">Eff%</th>
                  <th className="num">Day</th><th className="num">Cum.</th><th className="num">Eff%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.dt} style={r.fri ? { background: '#fafbfc' } : null}>
                    <td style={{ whiteSpace: 'nowrap' }}><b>{fmtDay(r.dt)}</b> <span className="muted" style={{ fontSize: 10 }}>{wkday(r.dt)}</span></td>
                    <td><input className="pp-in" type="number" value={r.raw.plan ?? ''} onChange={e => setEntry(r.dt, 'plan', e.target.value)} /></td>
                    <td className="num mono muted">{r.planCum || ''}</td>
                    <td className="num mono" style={{ color: '#2563eb' }}>{r.planEff || ''}</td>
                    <td><input className="pp-in" type="number" value={r.raw.actual ?? ''} onChange={e => setEntry(r.dt, 'actual', e.target.value)} /></td>
                    <td className="num mono muted">{r.actCum || ''}</td>
                    <td className="num mono" style={{ color: '#16a34a' }}>{r.actEff || ''}</td>
                    <td><input className="pp-in pp-rem" value={r.raw.remarks ?? (r.fri ? 'Friday - Weekly Holiday' : '')} placeholder={r.fri ? 'Friday - Weekly Holiday' : '—'} onChange={e => setEntry(r.dt, 'remarks', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pp-charts">
          <div className="card card-pad"><PlanChart rows={planChart} color="#2563eb" title="📘 Planned (daily + cumulative)" max={maxCum} /></div>
          <div className="card card-pad"><PlanChart rows={actChart} color="#16a34a" title="📗 Actual (daily + cumulative)" max={maxCum} /></div>
        </div>
      </div>
    </div>
  )
}
