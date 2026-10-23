import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { computeOB } from '../engine/calc.js'
import { can, NNVA_LIBRARY } from '../data/seed.js'
import ObLibraryPicker from '../components/ObLibraryPicker.jsx'

export default function OperationBreakdown({ style }) {
  const nav = useNavigate()
  const { updateStyle, user } = useStore()
  const ops = style.ops || []
  const cr = style.changeRequest
  const canPrepare = can('obPrepare', user.role)
  const canRequest = can('changeRequest', user.role)
  const canDecide = can('changeDecide', user.role)
  const requestChange = () => updateStyle(style.id, { changeRequest: { by: user.name, status: 'pending' } })
  const decideRequest = (ok) => updateStyle(style.id, { changeRequest: { ...cr, status: ok ? 'approved' : 'rejected', decidedBy: user.name } })

  const push = (op) => updateStyle(style.id, { ops: [...ops, { ...op, sl: ops.length + 1 }] })
  const addFromLibrary = (row) => {
    const m = row.machine || 'SNLS'
    push({ name: row.name, machine: m, smv: row.smv, aml: row.aml || 1, section: row.section, manual: m === 'Manual' || m === 'HP', fromLibrary: true })
  }
  const addQC = () => push({ name: 'Quality Inspection', machine: 'QC', smv: 0, aml: 1, section: 'QUALITY', qc: true })
  const addNNVA = (name) => { if (name) push({ name, machine: 'HP', smv: 0, aml: 1, section: 'NNVA', nnva: true }) }
  const [nnvaSel, setNnvaSel] = useState('')
  const removeOp = (sl) => updateStyle(style.id, { ops: ops.filter(o => o.sl !== sl).map((o, i) => ({ ...o, sl: i + 1 })) })
  const submit = () => { updateStyle(style.id, { step: Math.max(style.step, 4), status: 'OB Approval' }); nav(`/style/${style.id}/approval`) }
  const createNewOB = () => updateStyle(style.id, { obApproved: false, approvedBy: null, obVersion: (style.obVersion || 1) + 1, step: 3, status: 'Operation Breakdown', layoutVerified: false, changeRequest: null, obRejected: null })

  const ob = ops.length ? computeOB(ops, style.manpower) : null
  const locked = !!style.obApproved

  return (
    <div>
      <div className="page-head">
        <div><h1>3 · Operation Breakdown</h1></div>
        {canPrepare && !locked && ops.length ? <button className="btn primary" onClick={submit}>Submit for Approval →</button>
          : canPrepare && locked && cr?.status === 'approved' ? <button className="btn primary" onClick={createNewOB}>✚ Create New OB</button>
          : null}
      </div>
      {!canPrepare ? <Note tone="blue">👁️ View only — your role ({user.roleLabel}) reviews the OB.</Note> : null}
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      {/* Change-request workflow for an approved (locked) OB */}
      {locked ? (
        <div className="card card-pad" style={{ marginBottom: 16, borderLeft: '4px solid #16a34a' }}>
          {!cr ? (
            <div className="flex wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
              <span>🔒 <b>Approved OB — locked.</b> To change it, a change request must be submitted and approved {canRequest ? '' : '(by the WSE)'}.</span>
              {canRequest ? <button className="btn" onClick={requestChange}>✎ Request Change</button> : null}
            </div>
          ) : cr.status === 'pending' ? (
            <div className="flex wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
              <span>🟡 <b>Change request pending</b> — raised by {cr.by}.</span>
              {canDecide
                ? <span className="flex" style={{ gap: 8 }}><button className="btn primary" onClick={() => decideRequest(true)}>✓ Approve request</button><button className="btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => decideRequest(false)}>✕ Reject</button></span>
                : <Badge tone="amber">awaiting approver</Badge>}
            </div>
          ) : cr.status === 'approved' ? (
            <div className="flex wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
              <span>🟢 <b>Change approved</b> by {cr.decidedBy}. You may now create a new OB version to edit.</span>
            </div>
          ) : (
            <div className="flex wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
              <span>🔴 <b>Change request rejected</b> by {cr.decidedBy}. The OB stays locked.</span>
              {canRequest ? <button className="btn" onClick={requestChange}>Request again</button> : null}
            </div>
          )}
        </div>
      ) : null}
      {!locked && style.obRejected ? <Note>↩︎ This OB was <b>rejected by {style.obRejected.by}</b> — revise and re-submit for approval.</Note> : null}

      {ob ? (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <Stat label="Total SMV" value={ob.totalSMV} unit="min" accent="#2563eb" />
          <Stat label="Pitch Time" value={ob.pitchTime} unit="min" foot={`Total SMV ÷ ${style.manpower} MP`} />
          <Stat label="Target @100%" value={ob.target100} unit="pcs/hr" accent="#16a34a" />
          <Stat label="Operations" value={ops.length} foot="in this OB" accent="#0891b2" />
        </div>
      ) : (
        <Note><span>No operations yet — add them from the <b>OB Library</b> below.</span></Note>
      )}

      {/* Add from the OB library (PostgreSQL) */}
      {!locked && canPrepare ? (
        <div className="card mt">
          <div className="card-head"><h3>Add Operation</h3></div>
          <div className="card-pad">
            {/* quick add: non-value-added & quality steps (no SMV) */}
            <div className="ob-quickadd">
              <div className="field" style={{ minWidth: 260, flex: 1, maxWidth: 360 }}>
                <label>➕ NNVA process <span className="muted">· necessary non-value-added (SMV 0)</span></label>
                <select className="inp" value={nnvaSel} onChange={e => { addNNVA(e.target.value); setNnvaSel('') }} title="Add a Necessary Non-Value-Added process">
                  <option value="">Select an NNVA process to add…</option>
                  {NNVA_LIBRARY.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="field" style={{ minWidth: 150 }}>
                <label>Quality step</label>
                <button className="btn" onClick={addQC} title="Add a Quality Inspection process (no SMV)" style={{ height: 38 }}>🔍 + Quality Inspection</button>
              </div>
            </div>
            <div className="ob-quickadd-sep"><span>or pick a value-added process from the library</span></div>
            <ObLibraryPicker onAdd={addFromLibrary} existing={ops} />
          </div>
        </div>
      ) : null}

      {ob ? (
        <div className="card mt">
          <div className="card-head"><h3>Operations ({ob.rows.length})</h3></div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 440 }}>
            <table>
              <thead><tr><th>#</th><th>Process</th><th>Section</th><th>Machine</th><th className="num">SMV</th><th className="num">TML</th><th className="num">AML</th><th className="num">Target/hr</th><th></th></tr></thead>
              <tbody>
                {ob.rows.map(r => (
                  <tr key={r.sl}>
                    <td className="mono">{r.sl}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td><span className="muted" style={{ fontSize: 11.5 }}>{r.section || '—'}</span></td>
                    <td><Badge tone={r.machine === 'Manual' ? 'gray' : 'blue'}>{r.machine}</Badge></td>
                    <td className="num mono">{r.smv.toFixed(2)}</td>
                    <td className="num mono" style={{ color: '#2563eb', fontWeight: 600 }}>{r.tml.toFixed(2)}</td>
                    <td className="num mono">{r.aml}</td>
                    <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{r.target}</td>
                    <td className="right">{locked || !canPrepare ? null : <button className="btn sm" onClick={() => removeOp(r.sl)} title="Remove">×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
