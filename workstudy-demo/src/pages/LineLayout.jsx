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
    // multiple styles may share a line (each keeps its own layout) — no blocking
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

  // ---- lock / unlock the completed layout ----
  // read-only when manually locked OR an OB change request is pending (layout must wait for the approved OB)
  const obPending = style.changeRequest?.status === 'pending'
  const locked = !!style.layoutLocked || obPending
  const setLocked = (v) => updateStyle(style.id, { layoutLocked: v })
  const allPlaced = ops.length > 0 && placed === ops.length

  // ---- manpower & machine summary (CR Line Layout 8–15) ----
  const classify = (mc) => { const u = (mc || '').toUpperCase(); if (/IRON|^IM$|^PS$|PRESS/.test(u)) return 'ironer'; if (u === 'MANUAL' || u === 'HP' || u === 'HELPER') return 'helper'; if (u === 'QC') return 'quality'; return 'operator' }
  const stationMachine = (m) => ((mops[m] || []).map(sl => opBySl[sl]?.machine).filter(Boolean)[0]) || '—'
  const staffedStations = Object.keys(mops).filter(m => (mops[m] || []).length)
  const manCount = { operator: 0, helper: 0, ironer: 0, quality: 0 }
  staffedStations.forEach(m => { manCount[classify(stationMachine(m))]++ })
  const totalManpower = staffedStations.length
  const lineTgt100 = ob.totalSMV > 0 ? Math.round((totalManpower * 60) / ob.totalSMV) : 0
  const lineTgt80 = Math.round(lineTgt100 * 0.8)
  const machineSummary = (() => { const c = {}; staffedStations.forEach(m => { const t = stationMachine(m); c[t] = (c[t] || 0) + 1 }); return Object.entries(c).sort((a, b) => b[1] - a[1]) })()
  const capOf = (m) => { const l = loadOf(m); return l > 0 ? Math.floor(60 / l) : 0 }

  // add a Quality Inspection process to the pool (moved here from the OB per CR)
  const addQC = () => updateStyle(style.id, { ops: [...ops, { name: 'Quality Inspection', machine: 'QC', smv: 0, aml: 1, section: 'QUALITY', qc: true, sl: ops.length + 1 }] })

  const onDropMachine = (m) => { if (locked) return; if (drag != null) addToMachine(drag, m); setDrag(null); setOver(null) }
  const clickMachine = (m) => { if (locked) return; if (picked != null) addToMachine(picked, m) }

  // ---- process pool card ----
  const poolCard = (o) => {
    const on = machinesOf(o.sl)
    const { min, max } = machineRange(o)
    const exact = (pitch > 0 && o.smv > 0) ? round(o.smv / pitch, 1) : 0   // exact machines needed (not rounded up)
    const isPicked = picked === o.sl
    const under = on.length > 0 && on.length < min   // some machine still OVER pitch
    const overSpread = on.length > max               // machines gone UNDER pitch (wasteful)
    const tone = on.length === 0 ? 'gray' : (under || overSpread) ? 'amber' : 'green'
    const label = on.length === 0 ? `0/${exact}` : under ? `${on.length}/${exact}` : overSpread ? `${on.length} ↓` : `${on.length} ✓`
    const title = on.length === 0
      ? `needs exactly ${exact} machine${exact === 1 ? '' : 's'} (SMV ÷ pitch)`
      : `on machines ${on.join(', ')} · exact need ${exact}`
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
      <div key={m} className={'ll-station' + (list.length ? '' : ' ll-empty')} {...hv} onDragOver={e => { e.preventDefault(); setOver(m) }} onDragLeave={() => setOver(o => o === m ? null : o)} onDrop={() => onDropMachine(m)}
        onClick={() => clickMachine(m)}
        style={{ border: `2px solid ${isOver ? col : list.length ? col + '99' : picked != null ? '#38709055' : 'var(--line)'}`, borderRadius: 9, background: isOver ? '#f0fbff' : '#fff', minHeight: 58, display: 'flex', flexDirection: 'column', cursor: picked != null ? 'copy' : 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderBottom: list.length ? '1px solid #f1f5f9' : 'none' }}>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>W{m}{list.length ? <span style={{ color: '#2563eb' }}> · {stationMachine(m)}</span> : null}</span>
          {list.length ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: col }}>{load.toFixed(2)}</span> : null}
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
                    {locked ? null : <button onClick={() => removeFromMachine(sl, m)} title="Remove" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>}
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

  // W1|W2 at the BOTTOM, consecutive pairs side-by-side going up (W49|W50 …); odd blank sits at the top
  const stationGrid = (from, to, cols) => {
    const total = to - from + 1
    const c = cols || 1
    const rowsN = Math.ceil(total / c)
    const seq = []
    for (let r = rowsN - 1; r >= 0; r--) {          // top row first (highest), bottom row last (W1,W2)
      for (let col = 0; col < c; col++) {
        const idx = r * c + col                     // ascending within a row
        seq.push(idx < total ? from + idx : null)
      }
    }
    return (
      <div className="grid" style={{ gridTemplateColumns: `repeat(${c},minmax(0,1fr))`, gap: 6, alignContent: 'start' }}>
        {seq.map((m, k) => m == null ? <div key={'e' + k} /> : station(m))}
      </div>
    )
  }

  // print ONLY the layout design — clone it into an isolated window (nothing else from the page)
  const printLayout = () => {
    // same card look as on screen; allocated machines only, paired by number (W67|W68, W69|W70), W1|W2 at bottom
    const alloc = (m) => (mops[m] || []).length > 0
    const card = (m) => {
      const load = loadOf(m), col = loadColor(load), rem = round(pitch - load, 2)
      const procs = (mops[m] || []).map(sl => `<div class="llc-p"><span>${opBySl[sl]?.name || ''}</span><span class="llc-s">${shareOf(sl).toFixed(2)}</span></div>`).join('')
      const foot = rem > 0.004 ? `<span style="color:#2563eb">+${rem.toFixed(2)} free</span>` : rem < -0.004 ? `<span style="color:#dc2626">${rem.toFixed(2)} over</span>` : `<span style="color:#16a34a">✓ full</span>`
      return `<div class="llc" style="border-color:${col}"><div class="llc-h"><b>W${m} · <span style="color:#2563eb">${stationMachine(m)}</span></b><span style="color:${col}">${load.toFixed(2)}</span></div>${procs}<div class="llc-f">${foot}</div></div>`
    }
    const blank = '<div class="llc-blank"></div>'
    const pairGrid = (from, to) => {
      const rowsHtml = []
      for (let m = from; m <= to; m += 2) {
        const a = alloc(m), b = m + 1 <= to && alloc(m + 1)
        if (a || b) rowsHtml.push((a ? card(m) : blank) + (b ? card(m + 1) : blank))
      }
      rowsHtml.reverse()   // lowest pair (W1|W2) at the bottom
      return `<div class="llc-grid">${rowsHtml.join('')}</div>`
    }
    let gridHtml
    if (line.shape === 'U') {
      const half = Math.ceil(line.machines / 2)
      gridHtml = `<div class="llc-u">${pairGrid(1, half)}<div class="llc-road"><span>ROAD</span></div>${pairGrid(half + 1, line.machines)}</div>`
    } else gridHtml = pairGrid(1, line.machines)
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n')
    const FAC = { AGL: 'ANANTA GARMENTS LTD', AJL: 'ANANTA JEANSWEAR LTD', ASL: 'ANANTA SPORTSWEAR LTD', ABM: 'ABM FASHIONS LTD' }
    const fac = FAC[style.factory] || 'ANANTA COMPANIES'
    const mp = style.manpower || 0
    const ct100 = ob.totalSMV > 0 ? Math.round((mp * 60) / ob.totalSMV) : 0
    const ct80 = Math.round(ct100 * 0.8)
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const kv = (rows) => rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="c">${k ? ':' : ''}</td><td class="v">${v}</td></tr>`).join('')
    const coverRows = kv([['DATE', dateStr], ['BUYER', style.buyer || ''], ['STYLE NO', style.styleNo || ''], ['STYLE DESCRIPTION', style.item || ''], ['LINE NO', line.name || ''], ['ORDER QTY', (style.order || 0).toLocaleString() + ' Pcs'], ['', ''], ['TOTAL S.M.V', ob.totalSMV], ['NO OF MANPOWER', mp], ['100% TARGETS PER HOURS', ct100], ['80% TARGETS PER HOURS', ct80]])
    const sign = (a, b, c) => `<div class="pl-sign"><div><div class="pl-line"></div>${a}</div><div><div class="pl-line"></div>${b}</div><div><div class="pl-line"></div>${c}</div></div>`
    const cover = `<div class="pl-cover"><div class="pl-frame"><div class="pl-title"><h1>${fac}</h1><h2>Line Layout</h2></div><table class="pl-info">${coverRows}</table><div style="margin-top:90px">${sign('Prepared By', 'Verified By', 'Line Chief')}</div><div style="margin-top:60px">${sign('Production Manager', 'Workstudy Manager', 'GM')}</div></div></div>`
    const machRows = machineSummary.map(([t, c]) => `<tr><td>${t}</td><td class="num">${c}</td></tr>`).join('') + `<tr class="tot"><td>TOTAL</td><td class="num">${machineSummary.reduce((s, [, c]) => s + c, 0)}</td></tr>`
    const panelRows = kv2([['Machine Operator’s', manCount.operator], ['Helper’s', manCount.helper], ['Ironer’s', manCount.ironer], ['Total Manpower', totalManpower], ['SMV', ob.totalSMV], ['Pitch Time', round(ob.totalSMV / (totalManpower || 1), 2)], ['Line TGT @100% Efficiency', lineTgt100], ['Line TGT @80% Efficiency', lineTgt80], ['Prepared On', dateStr], ['Prepared By', ''], ['Approved By', '']])
    const summary = `<div class="pl-page"><div class="pl-title2"><b>${fac}</b> &middot; Line Layout</div><div class="pl-sum-grid"><div><table class="pl-tbl"><tr><td class="k">Style No / Name</td><td>${style.styleNo || ''}</td></tr><tr><td class="k">Style Description</td><td>${style.item || ''}</td></tr><tr><td class="k">Buyer</td><td>${style.buyer || ''}</td></tr></table><table class="pl-tbl" style="margin-top:10px"><thead><tr><th>Machine Type</th><th>No of Machines</th></tr></thead><tbody>${machRows}</tbody></table></div><div><table class="pl-tbl">${panelRows}</table></div></div></div>`
    const css = `@page{margin:10mm}body{margin:0;background:#fff;color:#14303f}.no-print{display:none!important}
      .pl-cover{page-break-after:always;font-family:Georgia,'Times New Roman',serif}
      .pl-frame{border:3px double #0f2a3f;border-radius:36px;padding:40px 54px;min-height:90vh}
      .pl-title{text-align:center;margin-bottom:28px}.pl-title h1{margin:0;font-size:25px;text-decoration:underline}.pl-title h2{margin:4px 0 0;font-size:17px}
      .pl-info{margin:0 auto;border-collapse:collapse;font-size:15px;font-weight:bold}.pl-info td{padding:5px 4px}.pl-info .k{padding-right:26px}.pl-info .c{padding-right:8px}.pl-info .v{color:#1d3a8a}
      .pl-sign{display:flex;justify-content:space-around;text-align:center;font-size:13px}.pl-sign>div{width:30%}.pl-line{border-top:1px solid #1d3a8a;margin-bottom:4px}
      .pl-page{page-break-before:always;font-family:Arial,Helvetica,sans-serif;color:#0f172a}.pl-title2{font-size:15px;margin-bottom:12px}
      .pl-sum-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
      .pl-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.pl-tbl td,.pl-tbl th{border:1px solid #94a3b8;padding:4px 8px}.pl-tbl th{background:#f1f5f9;text-align:left}.pl-tbl .k{background:#f8fafc;font-weight:700;width:60%}.pl-tbl .num{text-align:right;font-variant-numeric:tabular-nums}.pl-tbl .tot{font-weight:800;background:#f1f5f9}
      .llc-u{display:grid;grid-template-columns:1fr 26px 1fr;gap:10px;align-items:start}
      .llc-road{display:grid;place-items:center;background:repeating-linear-gradient(0deg,#e2e8f0 0 7px,transparent 7px 14px);border-radius:4px}.llc-road span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;font-weight:800;letter-spacing:2px;color:#94a3b8}
      .llc-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;align-content:start}
      .llc,.llc-blank{break-inside:avoid}
      .llc{border:1px solid #cbd5e1;border-radius:5px;padding:3px 6px;font-size:7.5px;font-family:Arial,sans-serif;line-height:1.3}
      .llc-h{display:flex;justify-content:space-between;gap:4px;border-bottom:1px solid #f1f5f9;padding-bottom:2px;margin-bottom:2px}.llc-h b{font-size:8.5px;color:#334155;white-space:nowrap}
      .llc-p{display:flex;justify-content:space-between;gap:4px}.llc-p span:first-child{overflow:hidden}.llc-s{color:#64748b;white-space:nowrap}
      .llc-f{text-align:right;font-weight:700;font-size:6.5px}`
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Line Layout — ${style.styleNo || ''}</title>${styles}<style>${css}</style></head><body>${cover}${summary}<div class="pl-page">${gridHtml}</div></body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }
  const kv2 = (rows) => rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="num">${v}</td></tr>`).join('')

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
    // I-shape = two rows of machines (CR Line Layout 1)
    return <div style={{ maxWidth: 420, margin: '0 auto' }}>{stationGrid(1, N, 2)}</div>
  }

  return (
    <div>
      <div className="page-head no-print">
        <div><h1>5 · Make Line Layout</h1></div>
        <div className="flex" style={{ gap: 8 }}>
          {line ? <button className="btn" onClick={printLayout} title="Print only the line layout design">🖨 Print layout</button> : null}
          {line && placed && !obPending ? <button className="btn" onClick={() => setLocked(!style.layoutLocked)} style={style.layoutLocked ? { color: '#16a34a', borderColor: '#bbf7d0' } : {}} title={style.layoutLocked ? 'Unlock to edit the layout' : 'Lock the completed layout'}>{style.layoutLocked ? '🔒 Locked — Unlock' : '🔓 Lock layout'}</button> : null}
          <button className="btn primary" disabled={!line || !allPlaced} title={!line ? 'Select a line' : !allPlaced ? `Place all ${ops.length} processes first (${placed}/${ops.length} done)` : ''}
            onClick={() => { updateStyle(style.id, { step: Math.max(style.step, 6), status: 'Layout Verification', layoutLine: line, machineOps: mops }); nav(`/style/${style.id}/verify`) }}>Next: Layout Verification →</button>
        </div>
      </div>
      <div className="no-print" style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="card card-pad flex wrap no-print" style={{ gap: 20, marginBottom: 14, fontSize: 13 }}>
        <span><span className="muted">Buyer</span> <b>{style.buyer || '—'}</b></span>
        <span><span className="muted">Style No</span> <b>{style.styleNo}</b></span>
        <span><span className="muted">Style Description</span> <b>{style.item || '—'}</b></span>
        <span><span className="muted">Total SMV</span> <b>{ob.totalSMV}</b></span>
        <span><span className="muted">Manpower</span> <b>{style.manpower}</b></span>
      </div>

      {obPending ? <Note tone="">🔒 An OB change request is <b>pending approval</b> — the layout is read-only and stays on the last approved OB until the change is approved.</Note> : null}
      {line && !allPlaced ? <Note tone="">⚠️ {placed}/{ops.length} processes placed — place <b>all processes</b> before moving to Layout Verification.</Note> : null}

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
                    <button key={l.no} onClick={() => selectLine(l)} title={tk ? `Also planned: ${tk.styleNo} — ${tk.item}` : `${l.machines} machines`}
                      style={{ minWidth: 64, textAlign: 'center', borderRadius: 9, padding: '7px 10px', cursor: 'pointer', border: `2px solid ${mine ? '#16a34a' : tk ? '#fcd34d' : 'var(--line)'}`, background: mine ? '#16a34a' : tk ? '#fffbeb' : '#fff', color: mine ? '#fff' : tk ? '#92400e' : 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
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
          {line ? <span className="hint">Pitch time <b style={{ color: '#387090' }}>{pitch.toFixed(2)} min</b> (Total SMV ÷ {ob.opCount} ops) · band ±{BAND}</span> : null}
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
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <span className="muted" style={{ fontSize: 11 }}>Pick a section, then click a process and click machine(s) — or drag it.</span>
                  {locked ? null : <button className="btn sm" onClick={addQC} title="Add a Quality Inspection process to place on the line">🔍 + Quality Inspection</button>}
                </div>
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

      {line && placed ? (
        <div className="card mt no-print">
          <div className="card-head"><h3>Manpower &amp; Machine Summary</h3><span className="hint">from the placed processes</span></div>
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <table className="pp-table" style={{ width: '100%' }}>
                <tbody>
                  <tr><td>Machine Operators</td><td className="num"><b>{manCount.operator}</b></td></tr>
                  <tr><td>Helpers</td><td className="num"><b>{manCount.helper}</b></td></tr>
                  <tr><td>Ironers</td><td className="num"><b>{manCount.ironer}</b></td></tr>
                  {manCount.quality ? <tr><td>Quality</td><td className="num"><b>{manCount.quality}</b></td></tr> : null}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}><td>Total Manpower</td><td className="num">{totalManpower}</td></tr>
                  <tr><td>Total SMV</td><td className="num mono">{ob.totalSMV}</td></tr>
                  <tr><td>Pitch Time</td><td className="num mono">{round(ob.totalSMV / (totalManpower || 1), 3)}</td></tr>
                  <tr><td>Line Target @100% /hr</td><td className="num mono" style={{ color: '#16a34a', fontWeight: 700 }}>{lineTgt100}</td></tr>
                  <tr><td>Line Target @80% /hr</td><td className="num mono" style={{ color: '#65a30d', fontWeight: 700 }}>{lineTgt80}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Machine Summary</div>
              <table className="pp-table" style={{ width: '100%' }}>
                <thead><tr><th>Machine Type</th><th className="num">No of Machines</th></tr></thead>
                <tbody>
                  {machineSummary.map(([t, c]) => <tr key={t}><td>{t}</td><td className="num mono">{c}</td></tr>)}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}><td>TOTAL</td><td className="num">{machineSummary.reduce((s, [, c]) => s + c, 0)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}><span className="muted" style={{ fontSize: 11 }}>Operator/Helper/Ironer are inferred from each station's machine type — adjust the classification if your categories differ.</span></div>
        </div>
      ) : null}
      {renderHoverPopover()}
    </div>
  )
}
