import { useState } from 'react'
import { NavLink, useParams, Navigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { Topbar } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { BarChart } from '../components/charts.jsx'
import { FACTORIES, floorsForFactory, lineCount, STEPS, linesOf } from '../data/seed.js'
import { computeOB } from '../engine/calc.js'
import { ObTable, ObVersionList, ObDiff } from '../components/ObReview.jsx'
import { appendVersion, prevApprovedOps } from '../engine/obdiff.js'

const U_COLOR = '#16a34a', I_COLOR = '#eab308'   // vivid green (U) / vivid yellow (I)
const onFill = (shape) => (shape === 'U' ? '#ffffff' : '#1f2937')   // dark text on yellow
const TABS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'approvals', label: '✅ Approvals' },
  { key: 'styles', label: '🧵 Styles' },
  { key: 'lines', label: '🏭 Lines' },
]

export default function AdminLayout() {
  const { user, allStyles, updateStyle, photos } = useStore()
  const { section = 'overview' } = useParams()
  const [act, setAct] = useState(null)
  const [detail, setDetail] = useState(null)
  if (!TABS.some(t => t.key === section)) return <Navigate to="/admin/overview" />

  // pending approvals
  const actions = []
  allStyles.forEach(s => {
    if (!s.sampleApproved) actions.push({ s, label: 'Approve sample', tone: 'amber', type: 'sample' })
    if (s.changeRequest?.status === 'pending') actions.push({ s, label: 'OB change request', tone: 'amber', type: 'change' })
    else if (s.ops?.length && !s.obApproved) actions.push({ s, label: 'Approve / reject OB', tone: 'blue', type: 'ob' })
    if (s.obApproved && !s.layoutVerified && linesOf(s).length) actions.push({ s, label: 'Verify layout', tone: 'cyan', type: 'verify' })
  })
  const decide = (a, ok) => {
    const s = a.s, by = user.name
    if (a.type === 'sample') updateStyle(s.id, ok ? { sampleApproved: true, sampleRejected: null, step: Math.max(s.step, 3) } : { sampleApproved: false, sampleRejected: { by }, step: 2 })
    else if (a.type === 'ob') updateStyle(s.id, ok ? { obApproved: true, approvedBy: by, step: Math.max(s.step, 5), status: 'Line Layout', obRejected: null, changeRequest: null, obHistory: appendVersion(s, by) } : { obApproved: false, step: 3, status: 'Operation Breakdown', obRejected: { by } })
    else if (a.type === 'change') updateStyle(s.id, { changeRequest: { ...s.changeRequest, status: ok ? 'approved' : 'rejected', decidedBy: by } })
    else if (a.type === 'verify') updateStyle(s.id, ok ? { layoutVerified: true, step: Math.max(s.step, 9), status: 'Cycle Time' } : { layoutVerified: false, step: 5, status: 'Line Layout' })
    setAct(null)
  }

  // occupancy
  const occ = {}
  FACTORIES.forEach(f => { occ[f.code] = {} })
  allStyles.forEach(s => linesOf(s).forEach(l => { occ[s.factory][l.no] = s }))

  const kpis = {
    total: allStyles.length,
    inProduction: allStyles.filter(s => s.step >= 5).length,
    pending: actions.length,
    runningLines: FACTORIES.reduce((n, f) => n + Object.keys(occ[f.code]).length, 0),
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="main">
        <Topbar crumbs={<><b>Admin</b> · {TABS.find(t => t.key === section)?.label.replace(/^\S+\s/, '')}</>} />
        <nav className="admin-nav">
          {TABS.map(t => <NavLink key={t.key} to={`/admin/${t.key}`} className={({ isActive }) => isActive ? 'active' : ''}>{t.label}</NavLink>)}
        </nav>
        <div className="content">
          {section === 'overview' && <Overview user={user} kpis={kpis} allStyles={allStyles} />}
          {section === 'approvals' && <Approvals actions={actions} onOpen={setAct} />}
          {section === 'styles' && <Styles allStyles={allStyles} onOpen={setDetail} />}
          {section === 'lines' && <Lines occ={occ} />}
        </div>
      </div>

      {act ? <ApprovalModal act={act} photos={photos} onDecide={decide} onClose={() => setAct(null)} /> : null}
      {detail ? <StyleDetailModal s={detail} photos={photos} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}

/* ---------------- sections ---------------- */

function Overview({ user, kpis, allStyles }) {
  const perFactory = FACTORIES.map(f => ({ label: f.code, value: allStyles.filter(s => s.factory === f.code).length }))
  const byStep = STEPS.map(st => ({ label: String(st.n), value: allStyles.filter(s => s.step === st.n).length }))
  return (
    <>
      <div className="page-head">
        <div><h1>Executive Overview 📊</h1><div className="sub">{user.name} · {user.roleLabel} · across AGL · AJL · ABM</div></div>
      </div>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Total Styles" value={kpis.total} foot="all factories" accent="#2563eb" />
        <Stat label="In Production" value={kpis.inProduction} foot="step 5+" accent="#16a34a" />
        <Stat label="Pending Approvals" value={kpis.pending} foot="awaiting you" accent="#d97706" />
        <Stat label="Lines Running" value={kpis.runningLines} foot="across factories" accent="#0891b2" />
      </div>
      <div className="grid cols-2">
        <div className="card"><div className="card-head"><h3>Styles per Factory</h3></div><div className="card-pad"><BarChart data={perFactory} color="#2563eb" height={240} /></div></div>
        <div className="card"><div className="card-head"><h3>Styles by Current Step</h3></div><div className="card-pad"><BarChart data={byStep} color="#0891b2" height={240} /></div></div>
      </div>
    </>
  )
}

function Approvals({ actions, onOpen }) {
  return (
    <>
      <div className="page-head"><div><h1>✅ Pending Approvals</h1><div className="sub">review the details, then approve or reject</div></div></div>
      <div className="card">
        <div className="card-head"><h3>Queue</h3><span className="hint">{actions.length} item{actions.length === 1 ? '' : 's'}</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead><tr><th>Style</th><th>Factory</th><th>Action needed</th><th></th></tr></thead>
            <tbody>
              {actions.length === 0 ? <tr><td colSpan={4}><div className="center muted" style={{ padding: '34px 0' }}>Nothing pending 🎉</div></td></tr> : null}
              {actions.map((a, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onOpen(a)}>
                  <td><b>{a.s.styleNo}</b> · {a.s.item}</td>
                  <td><Badge tone="gray">{a.s.factory}</Badge></td>
                  <td><Badge tone={a.tone}>{a.label}</Badge></td>
                  <td className="right"><span className="btn sm">Review →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Styles({ allStyles, onOpen }) {
  return (
    <>
      <div className="page-head"><div><h1>🧵 All Styles</h1><div className="sub">{allStyles.length} total · click any order for full details</div></div></div>
      <div className="card">
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead><tr><th>Style</th><th>Item</th><th>Buyer</th><th>Factory</th><th>Lines</th><th>Step</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {allStyles.length === 0 ? <tr><td colSpan={8}><div className="center muted" style={{ padding: '34px 0' }}>No styles yet.</div></td></tr> : null}
              {allStyles.map(s => {
                const ls = linesOf(s)
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(s)}>
                    <td><b>{s.styleNo}</b></td><td>{s.item}</td><td>{s.buyer}</td>
                    <td><Badge tone="gray">{s.factory}</Badge></td>
                    <td>{ls.length ? (ls.length === 1 ? `L${ls[0].no}` : `${ls.length} lines`) : <span className="muted">—</span>}</td>
                    <td><span className="muted">{s.step}.</span> {STEPS.find(x => x.n === s.step)?.label}</td>
                    <td><Badge tone={s.step >= 9 ? 'green' : s.step >= 5 ? 'blue' : 'amber'}>{s.status}</Badge></td>
                    <td className="right"><span className="btn sm">Details →</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Lines({ occ }) {
  return (
    <>
      <div className="page-head"><div><h1>🏭 Line Board</h1><div className="sub">which style runs on which line, per factory</div></div></div>
      {FACTORIES.map(f => {
        const floors = floorsForFactory(f.code)
        const running = Object.keys(occ[f.code]).length
        return (
          <div key={f.code} className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>{f.code} — {f.name}</h3><span className="hint">{running} / {lineCount(f.code)} lines running</span></div>
            <div className="card-pad grid" style={{ gap: 12 }}>
              {floors.map(fl => (
                <div key={fl.name}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{fl.name}</div>
                  <div className="flex wrap" style={{ gap: 7 }}>
                    {fl.lines.map(l => {
                      const s = occ[f.code][l.no]
                      const c = l.shape === 'U' ? U_COLOR : I_COLOR
                      const fg = s ? onFill(l.shape) : 'var(--muted)'
                      const lineOps = s ? (s.ops || []).filter(o => (s.opLine || {})[o.sl] === l.no) : []
                      const proc = s ? (lineOps.length ? (lineOps.length === 1 ? lineOps[0].name : `${lineOps[0].name} +${lineOps.length - 1}`) : (s.obName || '—')) : null
                      return (
                        <div key={l.no} title={s ? `Line ${l.no} · ${s.styleNo} — ${s.item}${proc ? ' · ' + proc : ''} · ${s.buyer} (${s.status})` : `Line ${l.no} · free`}
                          style={{ width: 150, borderRadius: 8, padding: '7px 9px', border: `1px solid ${s ? c : 'var(--line)'}`, background: s ? c : '#fff', color: fg }}>
                          <div className="flex" style={{ justifyContent: 'space-between' }}>
                            <b style={{ fontSize: 11.5 }}>L{l.no}</b>
                            <span style={{ fontSize: 8.5, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: s ? 'rgba(0,0,0,.14)' : c, color: s ? fg : onFill(l.shape) }}>{l.shape}</span>
                          </div>
                          {s ? (
                            <>
                              <div style={{ fontSize: 10.5, marginTop: 3, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.item}</div>
                              <div style={{ fontSize: 9.5, opacity: .85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.styleNo}</div>
                              <div style={{ fontSize: 9.5, marginTop: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📋 {proc}</div>
                            </>
                          ) : <div style={{ fontSize: 10, marginTop: 3 }}>free</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

/* ---------------- modals ---------------- */

function Row({ k, v }) { return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div> }

function ApprovalModal({ act, photos, onDecide, onClose }) {
  const s = act.s
  const ob = s.ops?.length ? computeOB(s.ops, s.manpower) : null
  const pics = photos[s.id] || []
  const title = { sample: 'Approve Sample', ob: 'Approve Operation Breakdown', change: 'OB Change Request', verify: 'Verify Line Layout' }[act.type]
  const lines = linesOf(s)
  const prev = prevApprovedOps(s)
  const isRevision = (s.obVersion || 1) > 1 && prev
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,23,.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 'min(920px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="card-head"><h3>{title}</h3><span className="hint">{s.styleNo} · {s.item} · {s.buyer} · {s.factory}</span></div>
        <div className="card-pad">
          {act.type === 'sample' ? (pics.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
              {pics.map((src, i) => <img key={i} src={src} alt={'sample ' + i} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 9, border: '1px solid var(--line)' }} />)}
            </div>) : <Note>No sample photos uploaded.</Note>) : null}
          {act.type === 'change' ? <Note tone="blue">WSE <b>{s.changeRequest?.by}</b> requested to change the approved OB (v{s.obVersion || 1}). Approving unlocks a new editable version for re-approval.</Note> : null}
          {(act.type === 'ob' || act.type === 'change') && ob ? (
            <>
              <div className="grid cols-4" style={{ margin: '12px 0' }}>
                <Stat label="Total SMV" value={ob.totalSMV} unit="min" accent="#2563eb" /><Stat label="Pitch" value={ob.pitchTime} unit="min" />
                <Stat label="Target@100%" value={ob.target100} unit="pcs/hr" accent="#16a34a" /><Stat label="Version" value={`v${s.obVersion || 1}`} />
              </div>
              {isRevision ? (
                <div style={{ marginBottom: 14 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>🔁 CHANGES vs APPROVED v{s.obVersion - 1}</div>
                  <ObDiff prev={prev} next={s.ops} prevLabel={`v${s.obVersion - 1}`} nextLabel={`v${s.obVersion}`} />
                </div>
              ) : null}
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>OPERATION BREAKDOWN · v{s.obVersion || 1}</div>
              <ObTable ob={ob} maxHeight={320} />
              {(s.obHistory || []).length ? (
                <div style={{ marginTop: 14 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>VERSION HISTORY</div>
                  <ObVersionList style={s} />
                </div>
              ) : null}
            </>) : null}
          {act.type === 'verify' ? (
            <>
              <div className="grid cols-3" style={{ marginBottom: 12 }}>
                <Stat label="Lines" value={lines.length} foot={lines.map(l => 'L' + l.no).join(', ')} />
                <Stat label="Assigned ops" value={(s.ops || []).filter(o => lines.some(l => l.no === (s.opLine || {})[o.sl])).length} />
                <Stat label="Total SMV" value={ob ? ob.totalSMV : '—'} unit="min" />
              </div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 8px' }}>LAYOUT — operations per line</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10 }}>
                {lines.map(l => {
                  const list = (s.ops || []).filter(o => (s.opLine || {})[o.sl] === l.no)
                  const c = l.shape === 'U' ? '#16a34a' : '#eab308'
                  return (
                    <div key={l.no} style={{ border: `2px solid ${c}`, borderRadius: 11, overflow: 'hidden' }}>
                      <div style={{ background: c, color: l.shape === 'U' ? '#fff' : '#1f2937', padding: '7px 11px', fontWeight: 700, fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{l.floor} · L{l.no} ({l.shape})</span><span>{list.length} op</span>
                      </div>
                      <div style={{ padding: 9 }}>
                        {list.length ? list.map((o, i) => (
                          <div key={o.sl} className="flex" style={{ gap: 7, padding: '4px 0' }}>
                            <span style={{ width: 17, height: 17, borderRadius: 5, background: c, color: l.shape === 'U' ? '#fff' : '#1f2937', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 800 }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{o.name}</span>
                            <span className="mono muted" style={{ fontSize: 11 }}>{o.smv.toFixed(2)}</span>
                          </div>
                        )) : <div className="center muted" style={{ fontSize: 11.5, padding: '10px 0' }}>no operations</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>) : null}
        </div>
        <div className="card-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => onDecide(act, false)}>✕ Reject</button>
          <button className="btn primary" onClick={() => onDecide(act, true)}>✓ {act.type === 'verify' ? 'Verify' : 'Approve'}</button>
        </div>
      </div>
    </div>
  )
}

function StyleDetailModal({ s, photos, onClose }) {
  const ob = s.ops?.length ? computeOB(s.ops, s.manpower) : null
  const pics = photos[s.id] || []
  const ls = linesOf(s)
  const placedCount = (s.ops || []).filter(o => (s.opLine || {})[o.sl] != null).length
  const stepLabel = STEPS.find(x => x.n === s.step)?.label
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,23,.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 'min(900px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="card-head"><h3>{s.styleNo} · {s.item}</h3><span className="hint">{s.buyer} · {s.factory} · Step {s.step}: {stepLabel}</span></div>
        <div className="card-pad">
          <div className="grid cols-2">
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>ORDER</div>
              <Row k="Buyer" v={s.buyer} /><Row k="Style No." v={s.styleNo} /><Row k="Item" v={s.item} />
              {s.obName ? <Row k="OB Name" v={s.obName} /> : null}
              <Row k="Category" v={s.category} /><Row k="Order Qty" v={(s.order || 0).toLocaleString() + ' pcs'} />
              <Row k="Manpower" v={s.manpower} /><Row k="Prepared By" v={s.preparedBy || '—'} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>STATUS</div>
              <Row k="Current Step" v={`${s.step} · ${stepLabel}`} />
              <Row k="Sample" v={s.sampleApproved ? <Badge tone="green">Approved</Badge> : s.sampleRejected ? <Badge tone="red">Rejected</Badge> : <Badge tone="amber">Pending</Badge>} />
              <Row k="OB" v={s.obApproved ? <Badge tone="green">Approved v{s.obVersion || 1}</Badge> : <Badge tone="amber">Draft v{s.obVersion || 1}</Badge>} />
              <Row k="Approved By" v={s.approvedBy || '—'} />
              <Row k="Change Request" v={s.changeRequest ? <Badge tone={s.changeRequest.status === 'approved' ? 'green' : s.changeRequest.status === 'rejected' ? 'red' : 'amber'}>{s.changeRequest.status}</Badge> : '—'} />
              <Row k="Layout" v={s.layoutVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="gray">—</Badge>} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>LINE ASSIGNMENT{ls.length ? ` · ${ls.length} line${ls.length > 1 ? 's' : ''}` : ''}</div>
            {ls.length ? (
              <div className="flex wrap" style={{ gap: 8 }}>
                {ls.map(l => <span key={l.no} style={{ background: l.shape === 'U' ? '#dcfce7' : '#fef9c3', color: l.shape === 'U' ? '#166534' : '#854d0e', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{l.floor} · L{l.no} ({l.shape})</span>)}
                <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>· {placedCount} stations placed</span>
              </div>) : <span className="muted" style={{ fontSize: 13 }}>Not assigned to any line yet.</span>}
          </div>
          {pics.length ? (
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>SAMPLE PHOTOS ({pics.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8 }}>
                {pics.map((src, i) => <img key={i} src={src} alt={'s' + i} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />)}
              </div>
            </div>) : null}
          {ob ? (
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>OPERATION BREAKDOWN · {s.ops.length} ops · Total SMV {ob.totalSMV} · Target@100% {ob.target100} pcs/hr</div>
              <div className="table-wrap" style={{ border: 'none', maxHeight: 280 }}>
                <table style={{ minWidth: 680 }}>
                  <thead><tr><th>#</th><th>Process</th><th>Machine</th><th className="num">SMV</th><th className="num">TML</th><th className="num">AML</th><th className="num">Tgt/hr</th><th>Needle</th><th>Thread</th></tr></thead>
                  <tbody>{ob.rows.map(r => <tr key={r.sl}><td className="mono">{r.sl}</td><td style={{ whiteSpace: 'nowrap' }}>{r.name}</td><td><Badge tone={r.machine === 'Manual' ? 'gray' : 'blue'}>{r.machine}</Badge></td><td className="num mono">{r.smv.toFixed(2)}</td><td className="num mono">{r.tml.toFixed(2)}</td><td className="num mono">{r.aml}</td><td className="num mono">{r.target}</td><td className="mono">{r.needleType || '—'}</td><td className="mono">{r.threadNeedle ? `${r.threadNeedle}/${r.threadBobbin}` : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>) : <Note tone="blue" >No operations added to the OB yet.</Note>}
          {s.cycle?.length ? <div style={{ marginTop: 16 }}><div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>CYCLE TIME · round {s.cycleRound || 1} · {s.cycle.length} observations</div></div> : null}
        </div>
        <div className="card-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
