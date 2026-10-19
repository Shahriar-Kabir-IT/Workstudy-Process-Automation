import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import logo from '../assets/logo.png'

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await login(username.trim(), password)
      nav('/dashboard')
    } catch (ex) {
      setErr(ex.message === 'Failed to fetch' ? 'Cannot reach the server. Is the API running?' : (ex.message || 'Login failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="login-screen">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo-tile"><img src={logo} alt="Ananta" /></div>
          <h1>Work Study Process Automation</h1>
          <p className="login-tag">Ananta Companies · Industrial Engineering. One system from approved sample through operation breakdown, line layout, cycle time and skill matrix.</p>
          <div className="login-brand-foot">AGL · AJL · ABM</div>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <img className="login-form-logo" src={logo} alt="Ananta" />
          <h2>Sign in</h2>
          <p className="login-form-sub">Enter your work account to continue.</p>
          <div className="field"><label>Username</label>
            <input className="inp" autoFocus autoComplete="username" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="e.g. agl.wse" />
          </div>
          <div className="field" style={{ marginTop: 14 }}><label>Password</label>
            <input className="inp" type="password" autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {err ? <div className="login-err">⚠ {err}</div> : null}
          <button type="submit" className="btn primary login-submit" disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="login-foot">Access is role-based · contact the administrator for an account</div>
        </form>
      </div>
    </div>
  )
}
