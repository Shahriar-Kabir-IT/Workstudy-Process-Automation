import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Card, KV, Badge, Note } from '../components/ui.jsx'
import { computeOB } from '../engine/calc.js'

export default function OBApproval({ style }) {
  const nav = useNavigate()
  const { user, updateStyle } = useStore()
  const canApprove = user.role === 'ASST_MGR_CENTRAL' || user.role === 'ADMIN'
  const ob = style.ops.length ? computeOB(style.ops, style.manpower) : null
  const approve = () => updateStyle(style.id, { obApproved: true, approvedBy: user.name, step: Math.max(style.step, 5), status: 'Line Layout' })

  return (
    <div>
      <div className="page-head">
        <div><h1>4 · Approval of Operation Breakdown 🚦</h1><div className="sub">Responsible: Asst. Mgr. (Central) · Read &amp; Write across all factories</div></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/layout`)} disabled={!style.obApproved}>Next: Line Layout →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-2">
        <Card title="Approval Status">
          <KV k="OB Prepared By" v={style.preparedBy || '—'} />
          <KV k="Status" v={style.obApproved ? <Badge tone="green">Approved ✓</Badge> : <Badge tone="amber">Awaiting approval</Badge>} />
          <KV k="Approved By" v={style.approvedBy || '—'} />
          {ob ? <KV k="Total SMV" v={`${ob.totalSMV} min`} /> : null}
          <div style={{ marginTop: 16 }}>
            {canApprove ? (
              <div className="flex">
                <button className="btn primary" disabled={style.obApproved || !ob} onClick={approve}>{style.obApproved ? 'Approved ✓' : 'Approve OB'}</button>
                {style.obApproved ? <button className="btn" onClick={() => nav(`/style/${style.id}/layout`)}>Go to Line Layout →</button> : null}
              </div>
            ) : (
              <Note>Your role (<b>{user.roleLabel}</b>) can view this OB but cannot approve it. Only <b>Asst. Mgr. (Central)</b> approves.</Note>
            )}
          </div>
        </Card>
        <Card title="Version Control">
          <Note tone="blue">Every OB modification keeps an <b>immutable copy of the original</b>. The same OB can be revised multiple times before approval.</Note>
          <div style={{ marginTop: 12 }}>
            <KV k="v3 — current" v={<Badge tone="green">Approved</Badge>} />
            <KV k="v2 — machine change" v={<span className="muted">archived</span>} />
            <KV k="v1 — initial" v={<span className="muted">archived</span>} />
          </div>
          <Note tone="" >Only an <b>Approved OB</b> flows to Line Layout. Adding a new process later requires a <b>new OB + re-approval</b>.</Note>
        </Card>
      </div>
    </div>
  )
}
