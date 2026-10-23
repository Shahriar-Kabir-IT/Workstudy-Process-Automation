import { Badge } from './ui.jsx'
import { computeOB } from '../engine/calc.js'

const U_ACCENT = '#0d9488', I_ACCENT = '#4f46e5'
const BAND = 0.05

// Read-only view of a style's machine layout (U/I) with each machine's processes + load vs pitch.
export function MachineLayoutView({ style, maxHeight = 480 }) {
  const line = style.layoutLine
  const ops = style.ops || []
  const mops = style.machineOps || {}
  if (!line) return <div className="muted" style={{ fontSize: 13 }}>No line layout yet.</div>

  const pitch = ops.length ? computeOB(ops, style.manpower).pitchTime : 0
  const opBySl = Object.fromEntries(ops.map(o => [o.sl, o]))
  const accent = line.shape === 'U' ? U_ACCENT : I_ACCENT
  const nMachines = (sl) => (Object.values(mops).filter(list => list.includes(sl)).length || 1)
  const loadOf = (m) => (mops[m] || []).reduce((s, sl) => s + (opBySl[sl]?.smv || 0) / nMachines(sl), 0)
  const loadColor = (load) => load === 0 ? '#cbd5e1' : load > pitch + BAND ? '#dc2626' : load < pitch - BAND ? '#d97706' : '#16a34a'

  const station = (m) => {
    const list = mops[m] || []
    const load = loadOf(m)
    const col = loadColor(load)
    return (
      <div key={m} style={{ border: `1.5px solid ${list.length ? col + '99' : 'var(--line)'}`, borderRadius: 8, background: '#fff', minHeight: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', borderBottom: list.length ? '1px solid #f1f5f9' : 'none' }}>
          <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>W{m}</span>
          {list.length ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: col }}>{load.toFixed(2)}</span> : null}
        </div>
        {list.length ? (
          <div style={{ padding: '3px 5px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {list.map(sl => <span key={sl} style={{ fontSize: 9.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opBySl[sl]?.name}</span>)}
          </div>
        ) : null}
      </div>
    )
  }

  const grid = (from, to, cols) => (
    <div className="grid" style={{ gridTemplateColumns: cols ? `repeat(${cols},minmax(0,1fr))` : 'repeat(auto-fill,minmax(90px,1fr))', gap: 5, alignContent: 'start' }}>
      {Array.from({ length: to - from + 1 }, (_, i) => station(from + i))}
    </div>
  )

  const N = line.machines
  const body = line.shape === 'U'
    ? (() => { const half = Math.ceil(N / 2); return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', gap: 8 }}>
          <div>{grid(1, half, 2)}</div>
          <div style={{ display: 'grid', placeItems: 'center', background: 'repeating-linear-gradient(0deg,#e2e8f0 0 10px,transparent 10px 20px)', borderRadius: 6 }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#94a3b8' }}>ROAD</span>
          </div>
          <div>{grid(half + 1, N, 2)}</div>
        </div>) })()
    : <div style={{ maxWidth: 300, margin: '0 auto' }}>{grid(1, N, 1)}</div>

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>🏭 Line {line.name} · {line.machines} machines · pitch {pitch.toFixed(2)}m</div>
        <Badge tone={line.shape === 'U' ? 'green' : 'violet'}>{line.shape}-Shape</Badge>
      </div>
      <div style={{ maxHeight, overflow: 'auto', border: `2px solid ${accent}33`, borderRadius: 10, padding: 9, background: '#fbfcfe' }}>{body}</div>
    </div>
  )
}
