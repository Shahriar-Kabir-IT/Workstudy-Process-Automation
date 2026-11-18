import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Card, KV, Badge, Note, Stat } from '../components/ui.jsx'
import { ObTable, ObVersionList, ObDiff } from '../components/ObReview.jsx'
import { computeOB, round } from '../engine/calc.js'
import { can } from '../data/seed.js'
import { appendVersion, prevApprovedOps } from '../engine/obdiff.js'

export default function OBApproval({ style }) {
  const nav = useNavigate()
  const { user, updateStyle } = useStore()
  const canApprove = can('obApprove', user.role)
  const ob = style.ops.length ? computeOB(style.ops, style.manpower) : null
  const prev = prevApprovedOps(style)                       // previously approved version's ops
  const isRevision = (style.obVersion || 1) > 1 && prev

  // only the nominated approver can edit SMV and set the allowance (CR OB-Approval)
  const allowance = Number(style.obAllowance) || 0          // % added to SMV
  const setAllowance = (v) => updateStyle(style.id, { obAllowance: Math.max(0, Number(v) || 0) })
  const setSmv = (sl, v) => updateStyle(style.id, { ops: style.ops.map(o => o.sl === sl ? { ...o, smv: Math.max(0, Number(v) || 0) } : o) })
  const allowedTotal = ob ? round(ob.totalSMV * (1 + allowance / 100), 2) : 0

  const approve = () => updateStyle(style.id, {
    obApproved: true, approvedBy: user.name, step: Math.max(style.step, 5), status: 'Line Layout',
    obRejected: null, changeRequest: null, obHistory: appendVersion(style, user.name),
  })
  const reject = () => updateStyle(style.id, { obApproved: false, step: 3, status: 'Operation Breakdown', obRejected: { by: user.name } })

  return (
    <div>
      <div className="page-head">
        <div><h1>4 · Approval of Operation Breakdown 🚦</h1></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/layout`)} disabled={!style.obApproved}>Next: Line Layout →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-2">
        <Card title="Approval Status">
          <KV k="OB Prepared By" v={style.preparedBy || '—'} />
          <KV k="Version" v={<Badge tone={style.obApproved ? 'green' : 'amber'}>v{style.obVersion || 1}{style.obApproved ? ' · Approved' : ' · Draft'}</Badge>} />
          <KV k="Status" v={style.obApproved ? <Badge tone="green">Approved ✓</Badge> : <Badge tone="amber">Awaiting approval</Badge>} />
          <KV k="Approved By" v={style.approvedBy || '—'} />
          {ob ? <KV k="Total SMV" v={`${ob.totalSMV} min`} /> : null}
          {ob && allowance > 0 ? <KV k={`Total SMV +${allowance}%`} v={<b>{allowedTotal} min</b>} /> : null}
          <div style={{ marginTop: 16 }}>
            {canApprove ? (
              <>
                <div className="flex" style={{ gap: 8 }}>
                  <button className="btn primary" disabled={style.obApproved || !ob} onClick={approve}>{style.obApproved ? 'Approved ✓' : '✓ Approve OB'}</button>
                  {!style.obApproved ? <button className="btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} disabled={!ob} onClick={reject}>✕ Reject</button> : null}
                  {style.obApproved ? <button className="btn" onClick={() => nav(`/style/${style.id}/layout`)}>Go to Line Layout →</button> : null}
                </div>
                {style.obRejected ? <div style={{ marginTop: 10 }}><Note tone="">Previously rejected by {style.obRejected.by}. The WSE revised and resubmitted.</Note></div> : null}
              </>
            ) : (
              <Note>Your role (<b>{user.roleLabel}</b>) can view this OB but cannot approve it.</Note>
            )}
          </div>
        </Card>
        <Card title="Version History">
          <ObVersionList style={style} />
        </Card>
      </div>

      {isRevision ? (
        <div className="card mt">
          <div className="card-head"><h3>🔁 Changes vs approved v{style.obVersion - 1}</h3><span className="hint">what this revision changes</span></div>
          <div className="card-pad"><ObDiff prev={prev} next={style.ops} prevLabel={`v${style.obVersion - 1}`} nextLabel={`v${style.obVersion}`} /></div>
        </div>
      ) : null}

      {ob && canApprove && !style.obApproved ? (
        <div className="card mt">
          <div className="card-head"><h3>✎ Approver adjustments</h3><span className="hint">only you (the approver) can edit SMV &amp; allowance</span></div>
          <div className="card-pad">
            <div className="flex wrap" style={{ gap: 16, alignItems: 'end', marginBottom: 12 }}>
              <div className="field" style={{ width: 160 }}><label>Allowance on SMV (%)</label>
                <input className="inp" type="number" min="0" step="0.5" value={allowance} onChange={e => setAllowance(e.target.value)} />
              </div>
              <div><div className="muted" style={{ fontSize: 12 }}>Total SMV incl. allowance</div><div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{allowedTotal} min</div></div>
            </div>
            <div className="table-wrap" style={{ border: '1px solid var(--line)', maxHeight: 320 }}>
              <table>
                <thead><tr><th>#</th><th>Process</th><th>Machine</th><th className="num">Base SMV</th><th className="num">+Allow</th></tr></thead>
                <tbody>
                  {style.ops.map(o => (
                    <tr key={o.sl}>
                      <td className="mono">{o.sl}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{o.name}</td>
                      <td><Badge tone="blue">{o.machine}</Badge></td>
                      <td className="num"><input className="inp" type="number" step="0.01" min="0" value={o.smv} onChange={e => setSmv(o.sl, e.target.value)} style={{ width: 72, height: 28, textAlign: 'right', padding: '2px 4px' }} /></td>
                      <td className="num mono muted">{round((Number(o.smv) || 0) * (1 + allowance / 100), 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {ob ? (
        <div className="card mt">
          <div className="card-head"><h3>Operation Breakdown — v{style.obVersion || 1}</h3><span className="hint">review before approving · read-only</span></div>
          <div className="grid cols-4" style={{ padding: '14px 20px' }}>
            <Stat label="Total SMV" value={ob.totalSMV} unit="min" accent="#2563eb" />
            <Stat label="Pitch Time" value={ob.pitchTime} unit="min" />
            <Stat label="Target @100%" value={ob.target100} unit="pcs/hr" accent="#16a34a" />
            <Stat label="Operations" value={style.ops.length} />
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}><ObTable ob={ob} /></div>
        </div>
      ) : null}
    </div>
  )
}
