import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { Topbar } from '../components/Shell.jsx'
import { Stat, Badge } from '../components/ui.jsx'
import { Navigate } from 'react-router-dom'
import { STEPS, getFactory } from '../data/seed.js'
import { totalSMV, MATRIX_MIN_PER_HOUR } from '../engine/calc.js'

export default function Dashboard() {
  const { user, stylesForUser } = useStore()
  const nav = useNavigate()
  if (user.role === 'SYSADMIN') return <Navigate to="/sysadmin/system" />
  if (user.role === 'ADMIN') return <Navigate to="/admin/overview" />
  const styles = stylesForUser(user)
  const fac = getFactory(user.factory)

  const active = styles.length
  const pendingApprovals = styles.filter(s => !s.obApproved || !s.layoutVerified).length
  const avgEff = styles.length ? 78.4 : '—'

  const stepLabel = (n) => STEPS.find(s => s.n === n)?.label || ''
  const tone = (s) => s.step >= 9 ? 'green' : s.step >= 5 ? 'blue' : s.step >= 3 ? 'cyan' : 'amber'

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="main">
        <Topbar crumbs={<><b>Dashboard</b> · {user.crossFactory ? 'All Factories' : (fac?.name || user.factory || '—')}</>} />
        <div className="content">
          <div className="page-head">
            <div>
              <h1>Welcome, {user.name.split(' ')[0]} 👋</h1>
              <div className="sub">{user.roleLabel} · {user.crossFactory ? 'Access to all factories' : (fac ? fac.name + ' (' + fac.code + ')' : (user.factory || '—'))}</div>
            </div>
            <div className="flex" style={{ gap: 10 }}>
              <button className="btn" onClick={() => nav('/operators')}>👷 Operators</button>
              <button className="btn primary" onClick={() => nav('/new-order')}>➕ New Order</button>
            </div>
          </div>

          <div className="grid cols-4" style={{ marginBottom: 18 }}>
            <Stat label="Active Styles" value={active} foot="in the pipeline" accent="#2563eb" />
            <Stat label="Pending Approvals" value={pendingApprovals} foot="OB / layout gates" accent="#d97706" />
            <Stat label="Avg Line Efficiency" value={avgEff} unit="%" foot={`effective hour = ${MATRIX_MIN_PER_HOUR} min`} accent="#16a34a" />
            <Stat label="Factories" value={user.crossFactory ? 3 : 1} foot={user.crossFactory ? 'AGL · AJL · ABM' : fac.code} accent="#0891b2" />
          </div>

          <div className="card">
            <div className="card-head"><h3>Styles</h3><span className="hint">Click a style to open its 10-step flow</span></div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Style</th><th>Item</th><th>Buyer</th><th>Factory</th><th>Floor / Line</th>
                    <th>Shape</th><th className="num">SMV</th><th className="num">MP</th><th>Current Step</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {styles.length === 0 ? (
                    <tr><td colSpan={11}>
                      <div className="center muted" style={{ padding: '38px 0' }}>
                        No styles yet. Click <b>➕ New Order</b> to create your first order.
                      </div>
                    </td></tr>
                  ) : null}
                  {styles.map(s => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/style/${s.id}/${STEPS.find(x => x.n === s.step).key}`)}>
                      <td><b>{s.styleNo}</b> {s.isNew ? <Badge tone="green">New</Badge> : null}</td>
                      <td>{s.item}</td>
                      <td>{s.buyer}</td>
                      <td><Badge tone="gray">{s.factory}</Badge></td>
                      <td>{s.line ? `${s.floor} · L${s.line}` : <span className="muted">—</span>}</td>
                      <td>{s.lineShape ? <Badge tone={s.lineShape === 'U' ? 'cyan' : 'blue'}>{s.lineShape}-shape</Badge> : <span className="muted">—</span>}</td>
                      <td className="num mono">{s.ops.length ? totalSMV(s.ops) : s.smv}</td>
                      <td className="num mono">{s.manpower}</td>
                      <td><span className="muted">Step {s.step}:</span> {stepLabel(s.step)}</td>
                      <td><Badge tone={tone(s)}>{s.status}</Badge></td>
                      <td className="right"><span className="btn sm">Open →</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
