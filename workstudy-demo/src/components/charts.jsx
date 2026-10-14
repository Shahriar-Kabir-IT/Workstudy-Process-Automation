// Lightweight inline-SVG charts (no external deps)

export function BarChart({ data, target, targetLabel = 'Pitch target', height = 260, color = '#2563eb' }) {
  const w = Math.max(data.length * 46, 520)
  const pad = { l: 44, r: 16, t: 16, b: 54 }
  const ih = height - pad.t - pad.b
  const max = Math.max(target || 0, ...data.map(d => d.value)) * 1.12 || 1
  const bw = (w - pad.l - pad.r) / data.length
  const y = (v) => pad.t + ih - (v / max) * ih
  const ticks = 4
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" style={{ minWidth: w > 760 ? w : '100%', display: 'block' }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (max / ticks) * i
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#eef2f7" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v)}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18
          const bar = bw * 0.64
          const over = target && d.value > target
          return (
            <g key={i}>
              <rect x={x} y={y(d.value)} width={bar} height={pad.t + ih - y(d.value)} rx="3"
                fill={over ? '#f59e0b' : color} opacity={over ? 0.95 : 0.9} />
              <text x={x + bar / 2} y={y(d.value) - 5} textAnchor="middle" fontSize="9.5" fill="#475569">{Math.round(d.value)}</text>
              <text x={x + bar / 2} y={height - 36} textAnchor="middle" fontSize="9" fill="#64748b"
                transform={`rotate(40 ${x + bar / 2} ${height - 36})`}>{d.label}</text>
            </g>
          )
        })}
        {target ? (
          <g>
            <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#dc2626" strokeDasharray="5 4" strokeWidth="1.5" />
            <text x={w - pad.r} y={y(target) - 5} textAnchor="end" fontSize="10" fill="#dc2626" fontWeight="600">{targetLabel} {Math.round(target)}</text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

export function LineChart({ points, ucl, lcl, mean, height = 280, color = '#2563eb' }) {
  const w = Math.max(points.length * 40, 520)
  const pad = { l: 44, r: 16, t: 18, b: 58 }
  const ih = height - pad.t - pad.b
  const vals = points.map(p => p.value)
  const max = Math.max(ucl || 0, ...vals) * 1.1 || 1
  const min = 0
  const step = (w - pad.l - pad.r) / Math.max(points.length - 1, 1)
  const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih
  const x = (i) => pad.l + i * step
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" style={{ minWidth: w > 760 ? w : '100%', display: 'block' }}>
        {/* control band */}
        {ucl && lcl ? (
          <rect x={pad.l} y={y(ucl)} width={w - pad.l - pad.r} height={Math.max(y(lcl) - y(ucl), 0)} fill="#dbeafe" opacity="0.5" />
        ) : null}
        {[['UCL', ucl, '#dc2626'], ['Mean', mean, '#16a34a'], ['LCL', lcl, '#dc2626']].map(([lbl, v, c], k) =>
          v ? (
            <g key={k}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={c} strokeDasharray={lbl === 'Mean' ? '6 4' : '3 3'} strokeWidth="1.3" />
              <text x={pad.l + 2} y={y(v) - 4} fontSize="9.5" fill={c} fontWeight="600">{lbl} {v}</text>
            </g>
          ) : null
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />
            <text x={x(i)} y={height - 40} textAnchor="middle" fontSize="8.5" fill="#64748b"
              transform={`rotate(42 ${x(i)} ${height - 40})`}>{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function Donut({ value, label, sub, color = '#2563eb', size = 128 }) {
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth="11" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="11"
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="48%" textAnchor="middle" fontSize="23" fontWeight="800" fill="#0f172a">{value}%</text>
        <text x="50%" y="63%" textAnchor="middle" fontSize="10" fill="#64748b">{label}</text>
      </svg>
      {sub ? <div className="muted" style={{ fontSize: 12 }}>{sub}</div> : null}
    </div>
  )
}
