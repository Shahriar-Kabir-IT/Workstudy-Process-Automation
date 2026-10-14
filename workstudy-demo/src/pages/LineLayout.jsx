import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Badge, Note } from '../components/ui.jsx'
import { computeOB, round } from '../engine/calc.js'

export default function LineLayout({ style }) {
  const nav = useNavigate()
  const { updateStyle } = useStore()
  const ops = style.ops || []
  // assignment: sl -> 'U' | 'I' | 'pool'
  const [assign, setAssign] = useState(() => style.assign || Object.fromEntries(ops.map(o => [o.sl, 'pool'])))
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)

  if (!ops.length) {
    return (
      <div>
        <div className="page-head"><div><h1>5 · Make Line Layout</h1><div className="sub">Responsible: WSE</div></div></div>
        <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>
        <Note>No approved OB operations to lay out yet. Build and approve the OB first.</Note>
      </div>
    )
  }

  const where = (sl) => assign[sl] || 'pool'
  const place = (sl, zone) => {
    const next = { ...assign, [sl]: zone }
    setAssign(next)
    updateStyle(style.id, { assign: next })
  }
  const pool = ops.filter(o => where(o.sl) === 'pool')
  const lineU = ops.filter(o => where(o.sl) === 'U')
  const lineI = ops.filter(o => where(o.sl) === 'I')

  const sumSmv = (list) => round(list.reduce((s, o) => s + o.smv, 0), 2)
  const ob = computeOB(ops, style.manpower)

  const onDrop = (zone) => { if (drag != null) place(drag, zone); setDrag(null); setOver(null) }

  const opCard = (o, zone) => (
    <div key={o.sl} draggable
      onDragStart={() => setDrag(o.sl)} onDragEnd={() => { setDrag(null); setOver(null) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 7,
        background: '#fff', border: '1px solid var(--line)', borderRadius: 9, cursor: 'grab',
        boxShadow: drag === o.sl ? '0 8px 18px rgba(37,99,235,.25)' : 'var(--shadow)', opacity: drag === o.sl ? 0.6 : 1,
      }}>
      <span className="mono muted" style={{ fontSize: 11, width: 18 }}>{o.sl}</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{o.name}</span>
      <Badge tone={o.machine === 'Manual' ? 'gray' : 'blue'}>{o.machine}</Badge>
      <span className="mono" style={{ fontSize: 11.5 }}>{o.smv.toFixed(2)}</span>
      <span className="flex" style={{ gap: 3 }}>
        {zone !== 'U' ? <button className="btn sm" style={{ padding: '3px 7px' }} onClick={() => place(o.sl, 'U')} title="Move to U-line">U</button> : null}
        {zone !== 'I' ? <button className="btn sm" style={{ padding: '3px 7px' }} onClick={() => place(o.sl, 'I')} title="Move to I-line">I</button> : null}
        {zone !== 'pool' ? <button className="btn sm" style={{ padding: '3px 7px' }} onClick={() => place(o.sl, 'pool')} title="Back to pool">↩</button> : null}
      </span>
    </div>
  )

  const dropZone = (zone, label, color, ops_, hint) => (
    <div
      onDragOver={e => { e.preventDefault(); setOver(zone) }}
      onDragLeave={() => setOver(o => o === zone ? null : o)}
      onDrop={() => onDrop(zone)}
      style={{ border: `2px ${over === zone ? 'solid' : 'dashed'} ${over === zone ? color : '#cbd5e1'}`, borderRadius: 12, background: over === zone ? '#f0f9ff' : '#fbfcfe', padding: 12, minHeight: 240, transition: '.12s' }}>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="flex" style={{ gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{zone}</span>
          <b>{label}</b>
          <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
        </div>
        <div className="flex" style={{ gap: 10, fontSize: 12 }}>
          <span className="muted">{ops_.length} stn</span>
          <span><b className="mono">{sumSmv(ops_)}</b> min</span>
        </div>
      </div>
      {ops_.length ? ops_.map(o => opCard(o, zone))
        : <div className="center muted" style={{ padding: '46px 0', fontSize: 12.5 }}>Drag operations here (or use the U / I buttons)</div>}
    </div>
  )

  const assignedCount = lineU.length + lineI.length

  return (
    <div>
      <div className="page-head">
        <div><h1>5 · Make Line Layout</h1><div className="sub">Responsible: WSE · drag each operation into the U-shape or I-shape line</div></div>
        <button className="btn primary" onClick={() => { updateStyle(style.id, { step: Math.max(style.step, 6), status: 'Layout Verification', assign }); nav(`/style/${style.id}/verify`) }} disabled={!assignedCount}>Next: Layout Verification →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <Note tone="blue"><span>Total SMV <b>{ob.totalSMV}</b> · {ops.length} operations · {assignedCount} placed · {pool.length} in pool. Drag cards, or use the small <b>U</b>/<b>I</b> buttons.</span></Note>

      <div className="grid mt" style={{ gridTemplateColumns: '1fr 1.5fr', gap: 16, alignItems: 'start' }}>
        {/* OB pool */}
        <div className="card" style={{ position: 'sticky', top: 78 }}>
          <div className="card-head"><h3>OB Operations</h3><span className="hint">{pool.length} unplaced</span></div>
          <div className="card-pad" style={{ maxHeight: 560, overflow: 'auto' }}
            onDragOver={e => { e.preventDefault(); setOver('pool') }} onDragLeave={() => setOver(o => o === 'pool' ? null : o)} onDrop={() => onDrop('pool')}>
            {pool.length ? pool.map(o => opCard(o, 'pool'))
              : <div className="center muted" style={{ padding: '30px 0', fontSize: 12.5 }}>All operations placed 🎉</div>}
          </div>
        </div>

        {/* Line boxes */}
        <div className="grid" style={{ gap: 16 }}>
          {dropZone('U', 'U-Shape Line', '#0891b2', lineU, 'compact · shared center')}
          {dropZone('I', 'I-Shape Line', '#2563eb', lineI, 'straight · single flow')}
        </div>
      </div>
    </div>
  )
}
