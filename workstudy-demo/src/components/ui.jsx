export function Stat({ label, value, unit, foot, accent }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={accent ? { color: accent } : null}>
        {value}{unit ? <small> {unit}</small> : null}
      </div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  )
}

export function Card({ title, hint, children, pad = true }) {
  return (
    <div className="card">
      {title ? (
        <div className="card-head">
          <h3>{title}</h3>
          {hint ? <span className="hint">{hint}</span> : null}
        </div>
      ) : null}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </div>
  )
}

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Bar({ value, max, color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: pct + '%', background: color || undefined }} />
    </div>
  )
}

export function KV({ k, v }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>
}

export function Note({ children, tone }) {
  return <div className={`note ${tone || ''}`}>{children}</div>
}
