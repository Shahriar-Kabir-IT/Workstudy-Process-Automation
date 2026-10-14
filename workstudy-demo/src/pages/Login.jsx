import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { USERS, getFactory } from '../data/seed.js'

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const go = (u) => { login(u); nav('/dashboard') }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-row">
          <div className="brand-logo">W</div>
          <div>
            <h2 style={{ fontSize: 19 }}>Work Study Automation</h2>
            <div style={{ color: '#64748b', fontSize: 12 }}>Ananta Companies · AGL · AJL · ABM</div>
          </div>
        </div>
        <p className="login-sub">Sign in — you'll be taken to your assigned factory dashboard.</p>
        {USERS.map(u => {
          const fac = getFactory(u.factory)
          return (
            <button key={u.id} className="acct" onClick={() => go(u)}>
              <div className="av" style={{ background: u.color }}>{u.initials}</div>
              <div className="meta">
                <b>{u.name}</b>
                <span>{u.roleLabel} · {u.crossFactory ? 'All factories' : fac.code}</span>
              </div>
              <span className="badge blue">Sign in →</span>
            </button>
          )
        })}
        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 14, textAlign: 'center' }}>
          Demo accounts · click any role to explore its access
        </div>
      </div>
    </div>
  )
}
