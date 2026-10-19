import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { STEPS, getFactory } from '../data/seed.js'
import logo from '../assets/logo.png'

export function Topbar({ crumbs }) {
  const { user, logout } = useStore()
  const nav = useNavigate()
  const fac = getFactory(user.factory)
  return (
    <div className="topbar">
      <div className="crumbs">{crumbs}</div>
      <div className="spacer" />
      <span className="fac-pill">🏭 {user.crossFactory ? 'All Factories' : (fac ? `${fac.code} · ${fac.name}` : (user.factory || '—'))}</span>
      <div className="user-chip">
        <div className="av" style={{ background: user.color }}>{user.initials}</div>
        <div className="meta"><b>{user.name}</b><span>{user.roleLabel}</span></div>
      </div>
      <button className="logout" onClick={() => { logout(); nav('/login') }}>Logout</button>
    </div>
  )
}

export function StepSidebar({ style, activeKey }) {
  const nav = useNavigate()
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo"><img src={logo} alt="Ananta" /></div>
        <div><b>Work Study Process</b><span>Automation</span></div>
      </div>

      <div className="sb-section">Style</div>
      <div className="nav-item" style={{ cursor: 'default', background: 'rgba(255,255,255,.05)' }}>
        <div className="step-no">#</div>
        <div><b style={{ color: '#fff' }}>{style.styleNo}</b><span style={{ color: '#7f9cc4', fontSize: 11, display: 'block' }}>{style.item}</span></div>
      </div>
      <div className="nav-item" onClick={() => nav('/dashboard')} style={{ marginTop: 6 }}>
        ← Back to Dashboard
      </div>

      <div className="sb-section">Process Flow</div>
      {STEPS.map(s => {
        const done = style.step > s.n
        const active = s.key === activeKey
        return (
          <div key={s.n} className={`nav-item ${active ? 'active' : ''}`} onClick={() => nav(`/style/${style.id}/${s.key}`)}>
            <div className="step-no">{done ? '✓' : s.n}</div>
            <span>{s.label}</span>
            {s.gate ? <span className="gate" title="Approval gate">🚦</span> : null}
            {s.low ? <span className="gate" title="Lower priority">·</span> : null}
          </div>
        )
      })}
    </aside>
  )
}

export function ProgressRail({ step }) {
  return (
    <div className="progress-rail">
      {STEPS.map(s => {
        const cls = step > s.n ? 'done' : step === s.n ? 'current' : ''
        return <span key={s.n} className={`pr-step ${cls}`}><span className="d" />{s.n}. {s.label}</span>
      })}
    </div>
  )
}
