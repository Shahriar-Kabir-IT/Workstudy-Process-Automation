import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { floorsForFactory, linesOf } from '../data/seed.js'
import { computeOB, round } from '../engine/calc.js'

const U_ACCENT = '#0d9488', I_ACCENT = '#4f46e5'
const accent = (s) => (s === 'U' ? U_ACCENT : I_ACCENT)
const BAND = 0.05

export default function LineLayout({ style }) {
  const nav = useNavigate()
  const { updateStyle, allStyles } = useStore()
  const ops = style.ops || []
  const groups = floorsForFactory(style.factory)        // [{name:'U-Shape', lines:[{no,shape,machines}]}, ...]

  const [line, setLine] = useState(() => style.layoutLine || null)
  const [mops, setMops] = useState(() => style.machineOps || {})   // { machineNo: [sl,...] }
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [picked, setPicked] = useState(null)   // click-to-place: sl currently held
  const [hover, setHover] = useState(null)      // { m, x, y } — machine hovered (details popover)
  const [section, setSection] = useState('')    // process section filter ('' = all)

  if (!ops.length) {
    return (
      <div>
        <div className="page-head"><div><h1>5 · Make Line Layout</h1></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>No approved OB operations to lay out yet. Build and approve the OB first.</Note>
      </div>
    )
  }

  const ob = computeOB(ops, style.manpower)
  const pitch = ob.pitchTime
  const opBySl = Object.fromEntries(ops.map(o => [o.sl, o]))
  const sections = [...new Set(ops.map(o => (o.section || '').trim()).filter(Boolean))]
  const poolOps = section ? ops.filter(o => (o.section || '').trim() === section) : ops

  // lines taken by other styles
  const taken = {}
  allStyles.filter(s => s.factory === style.factory && s.id !== style.id)
    .forEach(s => linesOf(s).forEach(l => { taken[l.no] = s }))

  const persist = (nextLine, nextMops) => updateStyle(style.id, {
    layoutLine: nextLine, machineOps: nextMops, status: 'Line Layout',
    lines: nextLine ? [{ no: nextLine.name, shape: nextLine.shape, machines: nextLine.machines }] : [],
    line: nextLine?.name ?? null, lineShape: nextLine?.shape ?? null,
  })

  const selectLine = (l) => {
    if (taken[l.no]) return
    const nl = { name: l.no, shape: l.shape, machines: l.machines }
    const same = line && line.name === nl.name
    const nm = same ? mops : {}
    setLine(nl); setMops(nm); persist(nl, nm)
  }

  const setMachine = (m, list) => {
    const next = { ...mops }
    if (list && list.length) next[m] = list; else delete next[m]
    setMops(next); updateStyle(style.id, { machineOps: next })
  }
  const addToMachine = (sl, m) => { const cur = mops[m] || []; if (!cur.includes(sl)) setMachine(m, [...cur, sl]) }
  const removeFromMachine = (sl, m) => setMachine(m, (mops[m] || []).filter(x => x !== sl))

  const machinesOf = (sl) => Object.entries(mops).filter(([, list]) => list.includes(sl)).map(([m]) => m)
  // a process assigned to K machines is SHARED: each machine carries SMV/K of it
  const shareOf = (sl) => (opBySl[sl]?.smv || 0) / (machinesOf(sl).length || 1)
  const loadOf = (m) => (mops[m] || []).reduce((s, sl) => s + shareOf(sl), 0)
  // band-aware machine count: a process is "balanced" when each machine it's on is within
  // pitch ± BAND. That gives a RANGE — min machines so none is over pitch, up to where they go under.
  const machineRange = (o) => {
    if (!(pitch > 0) || !(o.smv > 0)) return { min: 1, max: Infinity }
    return { min: Math.max(1, Math.ceil(o.smv / (pitch + BAND))), max: Math.max(1, Math.floor(o.smv / Math.max(pitch - BAND, 1e-6))) }
  }
  const placed = ops.filter(o => machinesOf(o.sl).length > 0).length
  const progress = Math.round((placed / ops.length) * 100)
  const progColor = progress === 0 ? '#dc2626' : progress < 100 ? '#d97706' : '#16a34a'

  const loadColor = (load) => load === 0 ? '#cbd5e1'
    : load > pitch + BAND ? '#dc2626'
      : load < pitch - BAND ? '#d97706' : '#16a34a'

  const onDropMachine = (m) => { if (drag != null) addToMachine(drag, m); setDrag(null); setOver(null) }
  const clickMachine = (m) => { if (picked != null) addToMachine(picked, m) }

  // ---- process pool card ----
  const poolCard = (o) => {
    const on = machinesOf(o.sl)
    const { min, max } = machineRange(o)
    const isPicked = picked === o.sl
    const under = on.length > 0 && on.length < min   // some machine still OVER pitch
    const overSpread = on.length > max               // machines gone UNDER pitch (wasteful)
    const tone = on.length === 0 ? 'gray' : (under || overSpread) ? 'amber' : 'green'
    const label = on.length === 0 ? `0/${min}` : under ? `${on.length}/${min}` : overSpread ? `${on.length} ↓` : `${on.length} ✓`
    const title = on.length === 0
      ? `needs ${min}${max > min && Number.isFinite(max) ? `–${max}` : ''} machine${min > 1 ? 's' : ''} to balance`
      : `on machines ${on.join(', ')} · balanced range ${min}${max > min && Number.isFinite(max) ? `–${max}` : ''}`
    return (
      <div key={o.sl} draggable onDragStart={() => setDrag(o.sl)} onDragEnd={() => { setDrag(null); setOver(null) }}
        onClick={() => setPicked(p => (p === o.sl ? null : o.sl))}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', marginBottom: 6, background: isPicked ? '#eef6fb' : '#fff', border: `${isPicked ? 2 : 1}px solid ${isPicked ? '#387090' : 'var(--line)'}`, borderRadius: 9, cursor: 'pointer', boxShadow: drag === o.sl ? '0 8px 18px rgba(56,112,144,.25)' : 'var(--shadow)', opacity: drag === o.sl ? 0.5 : 1 }}>
        <span className="mono muted" style={{ fontSize: 11, width: 16 }}>{o.sl}</span>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span>
        <Badge tone={o.machine === 'QC' ? 'violet' : o.machine === 'Manual' || o.machine === 'HP' ? 'gray' : 'blue'}>{o.machine}</Badge>
        <span className="mono" style={{ fontSize: 11 }}>{o.smv.toFixed(2)}</span>
        <span className={`badge ${tone}`} title={title}>{label}</span>
      </div>
    )
  }

  // ---- one machine station ----
  const station = (m) => {
    const list = mops[m] || []
    const load = loadOf(m)
    const remaining = round(pitch - load, 2)
    const col = loadColor(load)
    const isOver = over === m
    const fillPct = pitch ? Math.min((load / (pitch + BAND)) * 100, 100) : 0
    const hv = {
      onMouseEnter: (e) => setHover({ m, x: e.clientX, y: e.clientY }),
      onMouseMove: (e) => setHover(h => (h && h.m === m ? { m, x: e.clientX, y: e.clientY } : h)),
      onMouseLeave: () => setHover(h => (h && h.m === m ? null : h)),
    }
    return (
      <div key={m} className="ll-station" {...hv} onDragOver={e => { e.preventDefault(); setOver(m) }} onDragLeave={() => setOver(o => o === m ? null : o)} onDrop={() => onDropMachine(m)}
        onClick={() => clickMachine(m)}
        style={{ border: `2px solid ${isOver ? col : list.length ? col + '99' : picked != null ? '#38709055' : 'var(--line)'}`, borderRadius: 9, background: isOver ? '#f0fbff' : '#fff', minHeight: 58, display: 'flex', flexDirection: 'column', cursor: picked != null ? 'copy' : 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderBottom: list.length ? '1px solid #f1f5f9' : 'none' }}>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>W{m}</span>
          {list.length ? <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: col }}>{load.toFixed(2)}</span> : null}
        </div>
        {list.length ? (
          <>
            <div style={{ padding: '4px 5px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {list.map(sl => {
                const o = opBySl[sl]
                return (
                  <div key={sl} draggable onDragStart={() => setDrag(sl)} title={o?.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: col + '18', borderRadius: 5, padding: '2px 4px', cursor: 'grab' }}>
                    <span style={{ flex: 1, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o?.name}</span>
                    <span className="mono" style={{ fontSize: 9, color: '#64748b' }} title={`share of SMV ${o?.smv?.toFixed(2)} across ${machinesOf(sl).length} m/c`}>{shareOf(sl).toFixed(2)}</span>
                    <button onClick={() => removeFromMachine(sl, m)} title="Remove" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
            <div style={{ height: 3, background: '#eef2f7', margin: '0 5px 2px', borderRadius: 999 }}>
              <div style={{ height: '100%', width: fillPct + '%', background: col, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, textAlign: 'right', padding: '0 6px 4px' }}>
              {remaining > 0.004 ? <span style={{ color: '#2563eb' }}>+{remaining.toFixed(2)} free</span>
                : remaining < -0.004 ? <span style={{ color: '#dc2626' }}>{remaining.toFixed(2)} over</span>
                  : <span style={{ color: '#16a34a' }}>✓ full</span>}
            </div>
          </>
        ) : <div style={{ flex: 1, minHeight: 22 }} />}
      </div>
    )
  }

  // ---- machine details popover (follows the cursor on hover) ----
  const renderHoverPopover = () => {
    if (!hover) return null
    const m = hover.m
    const list = mops[m] || []
    const load = loadOf(m)
    const remaining = round(pitch - load, 2)
    const left = Math.min(hover.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250)
    return (
      <div style={{ position: 'fixed', left, top: hover.y + 16, zIndex: 90, pointerEvents: 'none', width: 230, background: '#0f172a', color: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 14px 34px rgba(2,8,23,.4)', fontSize: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 7 }}>W{m}</div>
        {list.length ? list.map(sl => {
          const o = opBySl[sl]
          return (
            <div key={sl} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: .9 }}>{o?.name}</span>
              <span className="mono" style={{ opacity: .7 }}>{shareOf(sl).toFixed(2)}</span>
            </div>
          )
        }) : <div style={{ opacity: .6 }}>Empty — no process yet</div>}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.16)', marginTop: 7, paddingTop: 7, display: 'flex', justifyContent: 'space-between', opacity: .85 }}>
          <span>Load / pitch</span><span className="mono">{load.toFixed(2)} / {pitch.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 2, color: remaining > BAND ? '#86efac' : remaining < -BAND ? '#fca5a5' : '#fde68a' }}>
          <span>{remaining >= 0 ? 'Remaining pitch' : 'Over pitch by'}</span><span className="mono">{Math.abs(remaining).toFixed(2)} min</span>
        </div>
      </div>
    )
  }

  // render highest machine number first so W1 ends up at the BOTTOM (line flows bottom → top)
  const stationGrid = (from, to, cols) => (
    <div className="grid" style={{ gridTemplateColumns: cols ? `repeat(${cols},minmax(0,1fr))` : 'repeat(auto-fill,minmax(96px,1fr))', gap: 6, alignContent: 'start' }}>
      {Array.from({ length: to - from + 1 }, (_, i) => station(to - i))}
    </div>
  )

  // print ONLY the layout design — clone it into an isolated window (nothing else from the page)
  const printLayout = () => {
    const node = document.querySelector('.ll-print-area')
    if (!node) return
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n')
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Line Layout — ${style.styleNo || ''}</title>${styles}<style>
      @page { margin: 12mm; }
      body { margin: 0; padding: 0; background: #fff; }
      .no-print { display: none !important; }
      .ll-print-head { display: block !important; margin-bottom: 12px; }
      .ll-print-box { max-height: none !important; overflow: visible !important; border: none !important; padding: 0 !important; background: #fff !important; }
      .ll-station { break-inside: avoid; page-break-inside: avoid; }
    </style></head><body>${node.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 350)
  }

  const renderLayout = () => {
    if (!line) return null
    const N = line.machines
    if (line.shape === 'U') {
      // U-shape: 2 machine columns · road · 2 machine columns
      const half = Math.ceil(N / 2)
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 10, alignItems: 'stretch' }}>
          <div>{stationGrid(1, half, 2)}</div>
          <div style={{ display: 'grid', placeItems: 'center', background: 'repeating-linear-gradient(0deg,#e2e8f0 0 10px,transparent 10px 20px)', borderRadius: 8 }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 800, letterSpacing: 3, color: '#94a3b8' }}>ROAD</span>
          </div>
          <div>{stationGrid(half + 1, N, 2)}</div>
        </div>
      )
    }
    // I-shape = one straight serial column (M1 on top, M2 under it, …)
    return <div style={{ maxWidth: 320, margin: '0 auto' }}>{stationGrid(1, N, 1)}</div>
  }

  return (
    <div>
      <div className="page-head no-print">
        <div><h1>5 · Make Line Layout</h1></div>
        <div className="flex" style={{ gap: 8 }}>
          {line ? <button className="btn" onClick={printLayout} title="Print only the line layout design">🖨 Print layout</button> : null}
          <button className="btn primary" disabled={!line || !placed}
            onClick={() => { updateStyle(style.id, { step: Math.max(style.step, 6), status: 'Layout Verification', layoutLine: line, machineOps: mops }); nav(`/style/${style.id}/verify`) }}>Next: Layout Verification →</button>
        </div>
      </div>
      <div className="no-print" style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      {/* STEP 1 — pick ONE line */}
      <div className="card no-print">
        <div className="card-head">
          <h3><span style={{ background: line ? '#16a34a' : '#387090', color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: 13, marginRight: 8 }}>1</span>Select a line</h3>
          {line ? <Badge tone="green">{line.name} · {line.shape}-Shape · {line.machines} machines</Badge> : <span className="hint">pick the line this OB will run on</span>}
        </div>
        <div className="card-pad grid" style={{ gap: 14 }}>
          {groups.map(g => (
            <div key={g.name}>
              <div className="flex" style={{ gap: 8, marginBottom: 8 }}><b>{g.name}</b><span className="muted" style={{ fontSize: 12 }}>{g.lines.length} lines · {g.lines[0]?.machines} machines each</span></div>
              <div className="flex wrap" style={{ gap: 7 }}>
                {g.lines.map(l => {
                  const mine = line && line.name === l.no
                  const tk = taken[l.no]
                  const a = accent(l.shape)
                  return (
                    <button key={l.no} disabled={!!tk} onClick={() => selectLine(l)} title={tk ? `${tk.styleNo} — ${tk.item}` : `${l.machines} machines`}
                      style={{ minWidth: 64, textAlign: 'center', borderRadius: 9, padding: '7px 10px', cursor: tk ? 'not-allowed' : 'pointer', border: `2px solid ${mine ? '#16a34a' : tk ? '#fecaca' : 'var(--line)'}`, background: mine ? '#16a34a' : tk ? '#fef2f2' : '#fff', color: mine ? '#fff' : tk ? '#dc2626' : 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
                      {!mine && !tk ? <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: a }} /> : null}
                      <b style={{ fontSize: 13 }}>{l.no}</b>
                      <div style={{ fontSize: 9.5, marginTop: 2, fontWeight: 600 }}>{mine ? '✓ selected' : tk ? '● ' + tk.styleNo : l.shape}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 2 — drag processes onto machines */}
      <div className="card mt">
        <div className="card-head no-print">
          <h3><span style={{ background: line ? '#387090' : '#cbd5e1', color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: 13, marginRight: 8 }}>2</span>Assign processes to machines</h3>
          {line ? <span className="hint">Pitch time <b style={{ color: '#387090' }}>{pitch.toFixed(2)} min</b> (Total SMV ÷ {style.manpower} MP) · band ±{BAND}</span> : null}
        </div>
        {!line ? (
          <div className="card-pad"><Note tone="blue">👆 Select a line above. Its machine stations will appear here to drag processes onto.</Note></div>
        ) : (
          <div className="card-pad">
            <div className="flex no-print" style={{ gap: 10, marginBottom: 14 }}>
              <div className="bar-track" style={{ flex: 1 }}><div style={{ height: '100%', borderRadius: 999, width: progress + '%', background: progColor, transition: '.2s' }} /></div>
              <span style={{ fontSize: 12, fontWeight: 700, color: progColor }}>{placed}/{ops.length} processes placed</span>
            </div>
            <div className="layout-split">
              {/* process pool */}
              <div className="no-print" style={{ alignSelf: 'start' }}>
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>🗂️ OB Processes ({poolOps.length}{section ? ` of ${ops.length}` : ''})</span>
                  <select className="inp" value={section} onChange={e => setSection(e.target.value)} style={{ height: 30, width: 150, padding: '2px 8px', fontSize: 12 }}>
                    <option value="">All sections</option>
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Pick a section, then click a process and click machine(s) — or drag it.</div>
                <div style={{ maxHeight: 520, overflow: 'auto', paddingRight: 4 }}>{poolOps.length ? poolOps.map(poolCard) : <div className="center muted" style={{ fontSize: 12.5, padding: '26px 0' }}>No processes in this section.</div>}</div>
                <div className="flex wrap" style={{ gap: 10, marginTop: 10, fontSize: 11 }}>
                  <span className="flex" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#16a34a' }} /> balanced</span>
                  <span className="flex" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#d97706' }} /> under pitch</span>
                  <span className="flex" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#dc2626' }} /> over pitch</span>
                </div>
              </div>
              {/* machine layout */}
              <div className="ll-print-area">
                {/* print-only header */}
                <div className="ll-print-head">
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Line Layout — {style.styleNo}</div>
                  <div style={{ fontSize: 12 }}>{style.buyer || ''} · {style.item || ''} · Line {line.name} · {line.shape}-Shape · {line.machines} machines · Pitch {pitch.toFixed(2)} min · {new Date().toLocaleDateString()}</div>
                </div>
                <div className="flex no-print" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>🏭 {line.name} · {line.shape}-Shape · {line.machines} machines</div>
                  {picked != null
                    ? <span className="badge blue" style={{ cursor: 'pointer' }} onClick={() => setPicked(null)}>📌 Placing: {opBySl[picked]?.name} — click machines · ✕</span>
                    : <Badge tone={line.shape === 'U' ? 'green' : 'violet'}>{line.shape}-Shape</Badge>}
                </div>
                <div className="ll-print-box" style={{ maxHeight: 560, overflow: 'auto', border: `2px solid ${accent(line.shape)}33`, borderRadius: 12, padding: 10, background: '#fbfcfe' }}>
                  {renderLayout()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {renderHoverPopover()}
    </div>
  )
}
