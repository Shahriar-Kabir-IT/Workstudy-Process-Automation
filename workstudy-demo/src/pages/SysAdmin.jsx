import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { api } from '../api.js'
import { Badge, Note } from '../components/ui.jsx'
import logo from '../assets/logo.png'

/* ---------- helpers ---------- */
const fmtUptime = (s) => {
  if (s == null) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${m}m`; if (m) return `${m}m ${sec}s`; return `${sec}s`
}
const barColor = (pct) => (pct >= 85 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#3b82f6')
const roleTone = (role) => ({ ADMIN: 'red', SYSADMIN: 'violet', WSE: 'blue', ASST_MGR_CENTRAL: 'violet', SR_MGR: 'green' }[role] || 'gray')

function Bar({ pct }) {
  return (
    <div style={{ height: 8, borderRadius: 6, background: '#eef2f7', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(pct || 0, 100)}%`, height: '100%', background: barColor(pct), transition: 'width .3s' }} />
    </div>
  )
}
const Field = ({ label, children }) => (
  <div><div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
    <div style={{ marginTop: 3, fontSize: 14, color: '#1e293b' }}>{children}</div></div>
)
const Metric = ({ label, value, sub, color }) => (
  <div><div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
    <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
    {sub ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div> : null}</div>
)
const Section = ({ icon, title, right, children }) => (
  <div className="card" style={{ marginBottom: 18 }}>
    <div className="card-head"><h3>{icon} {title}</h3>{right}</div>
    <div className="card-pad">{children}</div>
  </div>
)

/* ---------- System health ---------- */
function SystemHealth() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    setLoading(true); setErr('')
    api.admin.system().then(setD).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-head">
        <div><h1>☁️ System Admin</h1><div className="sub">Server, Database, Network, API &amp; Data Management</div></div>
        <button className="btn" onClick={load} disabled={loading}>⟳ {loading ? 'Refreshing…' : 'Refresh All'}</button>
      </div>
      {err ? <Note tone="">{err}</Note> : null}
      {!d ? <Note tone="blue">{loading ? 'Loading system metrics…' : 'No data.'}</Note> : (
        <>
          <Section icon="🩺" title="System Overview">
            <div className="grid cols-4">
              <Metric label="Status" value={<span style={{ color: '#16a34a' }}>✔ {d.overview.status}</span>} />
              <Metric label="DB Latency" value={`${d.overview.dbLatencyMs} ms`} />
              <Metric label="Uptime" value={`⏱ ${fmtUptime(d.overview.uptimeSec)}`} />
              <Metric label="Heap Memory" value={`${d.overview.heapMb} MB`} />
            </div>
            <div style={{ marginTop: 14, fontSize: 12.5, color: '#64748b' }}>
              DB: {d.overview.db} &nbsp;·&nbsp; Node: {d.overview.node} &nbsp;·&nbsp; Last check: {new Date(d.overview.lastCheck).toLocaleTimeString()}
            </div>
          </Section>

          <Section icon="🖥️" title="App Server Details">
            <div className="grid cols-3" style={{ rowGap: 20 }}>
              <Field label="Hostname"><b>{d.server.hostname}</b></Field>
              <Field label="Platform / Arch">{d.server.platform} / {d.server.arch}</Field>
              <Field label="OS Release">{d.server.osRelease}</Field>
              <Field label="CPU">{d.server.cpu} <Badge tone="gray">{d.server.cores} Cores</Badge></Field>
              <div style={{ gridColumn: 'span 2' }}><Field label="Load Average">
                <span className="flex" style={{ gap: 8 }}>
                  {d.server.loadAvg.map((v, i) => <Badge key={i} tone="gray">{v} ({['1m', '5m', '15m'][i]})</Badge>)}
                </span></Field></div>
              <Field label={`RAM Usage · ${d.server.ramUsedGb} / ${d.server.ramTotalGb} GB`}>
                <Bar pct={d.server.ramPct} /><span style={{ fontSize: 12, color: '#64748b' }}>{d.server.ramPct}%</span></Field>
              <Field label={`Disk Usage · ${d.server.disk.usedGb} / ${d.server.disk.totalGb} GB`}>
                <Bar pct={d.server.disk.pct} /><span style={{ fontSize: 12, color: '#64748b' }}>{d.server.disk.pct}%</span></Field>
              <Field label="Node.js Process">PID: <b>{d.server.pid}</b><div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>RSS: {d.server.rssMb} MB | Heap: {d.server.heapUsedMb}/{d.server.heapTotalMb} MB</div></Field>
            </div>
            <div style={{ marginTop: 16, fontSize: 12.5, color: '#64748b' }}>
              Node: {d.server.node} &nbsp;·&nbsp; Env: <Badge tone={d.server.env === 'production' ? 'green' : 'amber'}>{d.server.env}</Badge>
            </div>
          </Section>

          <Section icon="🗄️" title="Database Details">
            <div className="grid cols-4">
              <Metric label="DB Size" value={`${d.database.sizeMb} MB`} />
              <Metric label="Connections" value={`${d.database.connections} / ${d.database.maxConnections}`} />
              <Metric label="Active Queries" value={d.database.activeQueries} color="#2563eb" />
              <Metric label="Cache Hit Ratio" value={d.database.cacheHitRatio != null ? `${d.database.cacheHitRatio} %` : '—'} color="#16a34a" />
            </div>
            <div className="grid cols-2" style={{ marginTop: 16 }}>
              <Field label="PostgreSQL Version"><span style={{ fontSize: 12.5 }}>{d.database.version}</span></Field>
              <Field label="Connection Info"><Badge tone="blue">{d.database.host}:{d.database.port}</Badge> {d.database.database}</Field>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

/* ---------- User management ---------- */
const emptyForm = { name: '', username: '', password: '', role: 'WSE', factory: '', crossFactory: false, lines: '', active: true }

function UserModal({ meta, initial, onClose, onSaved }) {
  const editing = !!initial?.id
  const [f, setF] = useState(initial ? { ...emptyForm, ...initial, factory: initial.factory || '', password: '' } : emptyForm)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [changePw, setChangePw] = useState(!editing)   // edit: only touch password when explicitly asked
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      const body = { name: f.name, username: f.username, role: f.role, factory: f.factory || null, crossFactory: f.crossFactory, lines: f.lines, active: f.active }
      // only ever send a password when the admin explicitly set one (never on a plain edit)
      if ((!editing || changePw) && f.password) body.password = f.password
      if (editing) await api.admin.updateUser(initial.id, body)
      else { if (!f.password) throw new Error('Password is required'); await api.admin.createUser(body) }
      onSaved()
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,23,.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 24 }}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%', background: '#fff' }}>
        <div className="card-head"><h3>{editing ? 'Edit User' : 'Create User'}</h3><button className="btn sm" onClick={onClose}>✕</button></div>
        <div className="card-pad">
          <div className="grid cols-2">
            <div className="field"><label>Full Name</label><input className="inp" value={f.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="field"><label>Username</label><input className="inp" value={f.username} onChange={e => set('username', e.target.value)} placeholder="e.g. agl.wse" /></div>
            <div className="field"><label>Password</label>
              {editing && !changePw ? (
                <button type="button" className="btn" style={{ height: 38 }} onClick={() => setChangePw(true)}>🔑 Set a new password</button>
              ) : (
                <input className="inp" type="password" autoComplete="new-password" name="new-password-field"
                  value={f.password} onChange={e => set('password', e.target.value)}
                  placeholder={editing ? 'enter a new password' : ''} autoFocus={editing} />
              )}
            </div>
            <div className="field"><label>Role</label>
              <select className="inp" value={f.role} onChange={e => set('role', e.target.value)}>
                {meta.roles.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Factory</label>
              <select className="inp" value={f.factory} onChange={e => set('factory', e.target.value)}>
                <option value="">— none —</option>
                {meta.factories.map(x => <option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Lines (optional)</label><input className="inp" value={f.lines || ''} onChange={e => set('lines', e.target.value)} placeholder="e.g. 1-10" /></div>
          </div>
          <div className="flex" style={{ gap: 18, marginTop: 10 }}>
            <label className="flex" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.crossFactory} onChange={e => set('crossFactory', e.target.checked)} /> All factories (cross-factory)</label>
            <label className="flex" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> Active</label>
          </div>
          {err ? <div style={{ marginTop: 12, color: '#dc2626', fontSize: 13 }}>⚠ {err}</div> : null}
          <div className="flex" style={{ gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={busy || !f.username}>{busy ? 'Saving…' : (editing ? 'Save Changes' : 'Create User')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UserManagement() {
  const { user } = useStore()
  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState({ roles: [], factories: [] })
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(null)   // null | {} (new) | user (edit)

  const load = useCallback(() => {
    Promise.all([api.admin.users(), api.admin.meta()])
      .then(([u, m]) => { setUsers(u); setMeta(m) })
      .catch(e => setErr(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const del = async (u) => {
    if (!confirm(`Delete user "${u.name}" (${u.username})? This cannot be undone.`)) return
    try { await api.admin.deleteUser(u.id); load() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>👥 User Management</h1></div>
        <button className="btn primary" onClick={() => setModal({})}>+ Create User</button>
      </div>
      {err ? <Note tone="">{err}</Note> : null}
      <div className="card">
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Facility</th><th>Lines</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td className="mono muted">{u.username}</td>
                  <td><Badge tone={roleTone(u.role)}>{u.roleLabel}</Badge></td>
                  <td>{u.crossFactory ? <Badge tone="gray">All</Badge> : (u.factory || '—')}</td>
                  <td>{u.lines || '—'}</td>
                  <td>{u.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Disabled</Badge>}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className="flex" style={{ gap: 8 }}>
                      <button className="btn sm" onClick={() => setModal(u)}>✎ Edit</button>
                      <button className="btn sm" style={{ color: '#dc2626', borderColor: '#fecaca' }} disabled={u.id === user.id} onClick={() => del(u)}>🗑 Delete</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal != null ? <UserModal meta={meta} initial={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} /> : null}
    </div>
  )
}

/* ---------- Layout ---------- */
export default function SysAdminLayout() {
  const { section } = useParams()
  const nav = useNavigate()
  const { user, logout } = useStore()
  const active = section || 'system'
  const NavItem = ({ id, icon, label }) => (
    <button className={`sa-nav ${active === id ? 'on' : ''}`} onClick={() => nav(`/sysadmin/${id}`)}>{icon} {label}</button>
  )
  return (
    <div className="sa-shell">
      <aside className="sa-side">
        <div className="sa-brand">
          <div className="sa-logo"><img src={logo} alt="Ananta" /></div>
          <div><b>Work Study Process Automation</b><span>System Administration</span></div>
        </div>
        <nav className="sa-nav-list">
          <NavItem id="system" icon="⚙️" label="System Admin" />
          <NavItem id="users" icon="👥" label="User Management" />
        </nav>
        <div className="sa-side-foot">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11.5, opacity: .7 }}>{user.roleLabel}</div>
          <button className="btn sm" style={{ marginTop: 10, width: '100%' }} onClick={() => { logout(); nav('/login') }}>Logout</button>
        </div>
      </aside>
      <main className="sa-main"><div className="content" style={{ maxWidth: 1100 }}>
        {active === 'users' ? <UserManagement /> : <SystemHealth />}
      </div></main>
    </div>
  )
}
