import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { floorsForFactory, linesOf } from '../data/seed.js'
import { computeOB, round } from '../engine/calc.js'

const GREEN = '#16a34a', RED = '#dc2626', YELLOW = '#d97706'
const U_ACCENT = '#0d9488', I_ACCENT = '#4f46e5'
const accent = (s) => (s === 'U' ? U_ACCENT : I_ACCENT)

export default function LineLayout({ style }) {
  const nav = useNavigate()
  const { updateStyle, allStyles } = useStore()
  const ops = style.ops || []
  const floors = floorsForFactory(style.factory)
  const [opLine, setOpLine] = useState(() => style.opLine || {})
  const [drag, setDrag] = useState(null)   // sl being dragged
  const [over, setOver] = useState(null)   // drop target (lineNo | 'pool')

  if (!ops.length) {
    return (
      <div>
        <div className="page-head"><div><h1>5 · Make Line Layout</h1><div className="sub">Responsible: WSE</div></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>No approved OB operations to lay out yet. Build and approve the OB first.</Note>
      </div>
    )
  }

  const occupancy = {}
  allStyles.filter(s => s.factory === style.factory).forEach(s => linesOf(s).forEach(l => { occupancy[l.no] = s }))

  const myLines = style.lines || linesOf(style)
  const isMine = (no) => myLines.some(l => l.no === no)

  const saveLines = (next) => {
    // drop op assignments to lines no longer selected
    const valid = new Set(next.map(l => l.no))
    const cleaned = {}
    Object.entries(opLine).forEach(([sl, no]) => { if (valid.has(no)) cleaned[sl] = no })
    setOpLine(cleaned)
    updateStyle(style.id, { lines: next, opLine: cleaned, status: 'Line Layout', line: next[0]?.no ?? null, floor: next[0]?.floor ?? null, lineShape: next[0]?.shape ?? null })
  }
  const toggleLine = (floor, no, shape) =>
    saveLines(isMine(no) ? myLines.filter(l => l.no !== no) : [...myLines, { floor, no, shape }].sort((a, b) => a.no - b.no))

  const assign = (sl, no) => { const next = { ...opLine, [sl]: no }; if (no == null) delete next[sl]; setOpLine(next); updateStyle(style.id, { opLine: next }) }
  const spreadEvenly = () => {
    if (!myLines.length) return
    const next = {}
    ops.forEach((o, i) => { next[o.sl] = myLines[i % myLines.length].no })
    setOpLine(next); updateStyle(style.id, { opLine: next })
  }

  const opsOnLine = (no) => ops.filter(o => opLine[o.sl] === no)
  const pool = ops.filter(o => opLine[o.sl] == null || !isMine(opLine[o.sl]))
  const assignedCount = ops.filter(o => opLine[o.sl] != null && isMine(opLine[o.sl])).length
  const progress = Math.round((assignedCount / ops.length) * 100)
  const progColor = progress === 0 ? RED : progress < 100 ? YELLOW : GREEN
  const onDrop = (no) => { if (drag != null) assign(drag, no); setDrag(null); setOver(null) }

  const opCard = (o, placedNo) => (
    <div key={o.sl} draggable onDragStart={() => setDrag(o.sl)} onDragEnd={() => { setDrag(null); setOver(null) }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', marginBottom: 6, background: '#fff', border: '1px solid var(--line)', borderRadius: 9, cursor: 'grab', boxShadow: drag === o.sl ? '0 8px 18px rgba(37,99,235,.25)' : 'var(--shadow)', opacity: drag === o.sl ? 0.5 : 1 }}>
      <span className="mono muted" style={{ fontSize: 11, width: 16 }}>{o.sl}</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span>
      <Badge tone={o.machine === 'Manual' ? 'gray' : 'blue'}>{o.machine}</Badge>
      <span className="mono" style={{ fontSize: 11 }}>{o.smv.toFixed(2)}</span>
      {placedNo != null ? <button className="btn sm" style={{ padding: '2px 6px' }} onClick={() => assign(o.sl, null)} title="Back to pool">↩</button> : null}
    </div>
  )

  const lineCard = (floor, l) => {
    const run = occupancy[l.no]
    const mine = isMine(l.no)
    const taken = run && !mine && run.id !== style.id
    const a = accent(l.shape)
    return (
      <button key={l.no} disabled={taken} onClick={() => !taken && toggleLine(floor, l.no, l.shape)}
        title={run ? `${run.styleNo} — ${run.item}` : 'Free line'}
        style={{ width: 96, textAlign: 'left', borderRadius: 9, padding: '6px 8px', cursor: taken ? 'not-allowed' : 'pointer', border: `2px solid ${mine ? GREEN : taken ? '#fecaca' : 'var(--line)'}`, background: mine ? GREEN : taken ? '#fef2f2' : '#fff', color: mine ? '#fff' : taken ? RED : 'var(--ink)', position: 'relative', overflow: 'hidden', boxShadow: mine ? `0 5px 12px ${GREEN}44` : 'none' }}>
        {!mine && !taken ? <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: a }} /> : null}
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 12.5 }}>L{l.no}</b>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 5, background: mine ? 'rgba(255,255,255,.25)' : a, color: '#fff' }}>{l.shape}</span>
        </div>
        <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600 }}>{mine ? `✓ ${opsOnLine(l.no).length} op` : taken ? '● ' + run.styleNo : '＋ add'}</div>
      </button>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>5 · Make Line Layout</h1><div className="sub">Responsible: WSE · pick lines, then assign each operation to a line</div></div>
        <button className="btn primary" disabled={!myLines.length || !assignedCount}
          onClick={() => { updateStyle(style.id, { step: Math.max(style.step, 6), status: 'Layout Verification', opLine }); nav(`/style/${style.id}/verify`) }}>Next: Layout Verification →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      {/* STEP 1 — pick lines */}
      <div className="card">
        <div className="card-head">
          <h3><span style={{ background: myLines.length ? GREEN : '#2563eb', color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: 13, marginRight: 8 }}>1</span>Pick lines {myLines.length ? <Badge tone="green">{myLines.length} selected</Badge> : null}</h3>
          <span className="hint flex" style={{ gap: 12 }}>
            <span className="flex" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: GREEN }} /> Selected</span>
            <span className="flex" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: RED }} /> Taken</span>
          </span>
        </div>
        <div className="card-pad grid" style={{ gap: 16 }}>
          {floors.map(fl => (
            <div key={fl.name}>
              <div className="flex" style={{ gap: 10, marginBottom: 9 }}><b>{fl.name}</b><span className="muted" style={{ fontSize: 12 }}>{fl.lines.length} lines</span></div>
              <div className="flex wrap" style={{ gap: 7 }}>{fl.lines.map(l => lineCard(fl.name, l))}</div>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 2 — drag operations onto lines */}
      <div className="card mt">
        <div className="card-head">
          <h3><span style={{ background: myLines.length ? '#2563eb' : '#cbd5e1', color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: 13, marginRight: 8 }}>2</span>Drag each OB onto a line</h3>
          {myLines.length ? <button className="btn sm" onClick={spreadEvenly}>↔ Spread evenly across {myLines.length} line{myLines.length > 1 ? 's' : ''}</button> : null}
        </div>
        {!myLines.length ? (
          <div className="card-pad"><Note tone="blue">👆 Pick one or more lines above (any floor), then drag the operations onto them.</Note></div>
        ) : (
          <div className="card-pad">
            <div className="flex" style={{ gap: 10, marginBottom: 14 }}>
              <div className="bar-track" style={{ flex: 1 }}><div style={{ height: '100%', borderRadius: 999, width: progress + '%', background: progColor, transition: '.2s' }} /></div>
              <span style={{ fontSize: 12, fontWeight: 700, color: progColor }}>{assignedCount}/{ops.length} assigned</span>
            </div>
            <div className="layout-split">
              {/* pool */}
              <div onDragOver={e => { e.preventDefault(); setOver('pool') }} onDragLeave={() => setOver(o => o === 'pool' ? null : o)} onDrop={() => onDrop(null)}
                style={{ border: `2px ${over === 'pool' ? 'solid #2563eb' : 'dashed #cbd5e1'}`, borderRadius: 12, background: over === 'pool' ? '#eff6ff' : '#f8fafc', padding: 10, alignSelf: 'start' }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>🗂️ OB Operations ({pool.length} to place)</div>
                <div style={{ maxHeight: 460, overflow: 'auto' }}>
                  {pool.length ? pool.map(o => opCard(o, null)) : <div className="center muted" style={{ fontSize: 12.5, padding: '34px 0' }}>All operations placed 🎉</div>}
                </div>
              </div>
              {/* line drop zones */}
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
                {myLines.map(l => {
                  const list = opsOnLine(l.no)
                  const c = l.shape === 'U' ? '#16a34a' : '#eab308'
                  const isOver = over === l.no
                  return (
                    <div key={l.no} onDragOver={e => { e.preventDefault(); setOver(l.no) }} onDragLeave={() => setOver(o => o === l.no ? null : o)} onDrop={() => onDrop(l.no)}
                      style={{ border: `2px solid ${isOver ? c : c + '88'}`, borderRadius: 11, overflow: 'hidden', background: isOver ? (l.shape === 'U' ? '#f0fdf4' : '#fefce8') : '#fff', minHeight: 120 }}>
                      <div style={{ background: c, color: l.shape === 'U' ? '#fff' : '#1f2937', padding: '7px 11px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
                        <span>{l.floor} · Line {l.no} ({l.shape})</span><span>{list.length} op · {round(list.reduce((s, o) => s + o.smv, 0), 2)}m</span>
                      </div>
                      <div style={{ padding: 9, minHeight: 70 }}>
                        {list.length ? list.map(o => opCard(o, l.no)) : <div className="center muted" style={{ fontSize: 12, padding: '22px 0' }}>drop operations here</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
