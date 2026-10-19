import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Card, KV, Badge, Note } from '../components/ui.jsx'
import { can } from '../data/seed.js'

export default function LayoutVerification({ style }) {
  const nav = useNavigate()
  const { user, updateStyle } = useStore()
  const canVerify = can('layoutVerify', user.role)
  const verify = () => updateStyle(style.id, { layoutVerified: true, step: Math.max(style.step, 9), status: 'Cycle Time' })

  return (
    <div>
      <div className="page-head">
        <div><h1>6 · Layout Verification 🚦</h1><div className="sub">Responsible: Sr. Exec. / Asst. Mgr. / Mgr.</div></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/cycle`)} disabled={!style.layoutVerified}>Next: Cycle Time →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-2">
        <Card title="Verification">
          <KV k="Floor / Line" v={style.line ? `${style.floor} · Line ${style.line}` : <span className="muted">not assigned</span>} />
          <KV k="Line Shape" v={style.lineShape ? <Badge tone={style.lineShape === 'U' ? 'cyan' : 'blue'}>{style.lineShape}-shape</Badge> : <span className="muted">—</span>} />
          <KV k="Status" v={style.layoutVerified ? <Badge tone="green">Verified ✓</Badge> : <Badge tone="amber">Pending</Badge>} />
          <div style={{ marginTop: 14 }}>
            {canVerify ? (
              <div className="flex">
                <button className="btn primary" disabled={style.layoutVerified} onClick={verify}>{style.layoutVerified ? 'Verified ✓' : 'Verify layout'}</button>
                {style.layoutVerified ? <button className="btn" onClick={() => nav(`/style/${style.id}/cycle`)}>Go to Cycle Time →</button> : null}
              </div>
            ) : (
              <Note>Your role (<b>{user.roleLabel}</b>) cannot verify. Only <b>Sr. Exec. / Asst. Mgr. / Mgr.</b> may verify a layout.</Note>
            )}
          </div>
        </Card>
        <Card title="Rules">
          <Note tone="blue">The verifier may re-order the <b>operation sequence</b> but <b>cannot add new operations</b>.</Note>
          <KV k="Unlocks" v="Step 9 · Cycle Time" />
        </Card>
      </div>
    </div>
  )
}
