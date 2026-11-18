import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { computeOB, round } from '../engine/calc.js'
import { can, NNVA_LIBRARY } from '../data/seed.js'
import ObLibraryPicker from '../components/ObLibraryPicker.jsx'

// Special operations priced per point (SMV = points × rate)
const SPECIAL_OPS = [
  { name: 'Bartack', machine: 'BTK', rate: 0.05 },
  { name: 'Eyelet', machine: 'EYELET', rate: 0.12 },
  { name: 'Button Hole', machine: 'BH', rate: 0.10 },
  { name: 'Button Stitch', machine: 'BS', rate: 0.10 },
  { name: 'Rivet Attach', machine: 'RIVET', rate: 0.09 },
  { name: 'Sank Button', machine: 'SNAP', rate: 0.10 },
  { name: 'Snap Button', machine: 'SNAP', rate: 0.11 },
  { name: 'Snap Punch', machine: 'SNAP', rate: 0.04 },
  { name: 'Waist Belt Decoration Stitch', machine: 'SNLS', rate: 0.15 },
  { name: 'Hook', machine: 'HOOK', rate: 0.10 },
  { name: 'Bar', machine: 'BAR', rate: 0.10 },
  { name: 'Grommet Attach', machine: 'GROMMET', rate: 0.10 },
  { name: 'Reinforcement', machine: 'SNLS', rate: 0.05 },
]

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
  const [splSel, setSplSel] = useState('')
  const [splPts, setSplPts] = useState(1)
  const addSpecial = () => {
    const op = SPECIAL_OPS.find(x => x.name === splSel); if (!op) return
    const pts = Math.max(1, Number(splPts) || 1)
    push({ name: `${op.name} (${pts} pt)`, machine: op.machine, smv: round(pts * op.rate, 2), aml: 1, section: 'FINISHING', special: true })
    setSplSel(''); setSplPts(1)
  }
  const removeOp = (sl) => updateStyle(style.id, { ops: ops.filter(o => o.sl !== sl).map((o, i) => ({ ...o, sl: i + 1 })) })
  const setAml = (sl, v) => updateStyle(style.id, { ops: ops.map(o => o.sl === sl ? { ...o, aml: Math.max(0, Number(v) || 0) } : o) })
  const moveOp = (sl, dir) => {
    const i = ops.findIndex(o => o.sl === sl); const j = i + dir
    if (i < 0 || j < 0 || j >= ops.length) return
    const arr = [...ops];[arr[i], arr[j]] = [arr[j], arr[i]]
    updateStyle(style.id, { ops: arr.map((o, k) => ({ ...o, sl: k + 1 })) })
  }
  // drag-and-drop reorder
  const [dragSl, setDragSl] = useState(null)
  const [overSl, setOverSl] = useState(null)
  const dropOp = (fromSl, toSl) => {
    if (fromSl == null || fromSl === toSl) return
    const arr = [...ops]
    const [moved] = arr.splice(arr.findIndex(o => o.sl === fromSl), 1)
    arr.splice(arr.findIndex(o => o.sl === toSl), 0, moved)
    updateStyle(style.id, { ops: arr.map((o, k) => ({ ...o, sl: k + 1 })) })
  }

  const FAC = { AGL: 'ANANTA GARMENTS LTD', AJL: 'ANANTA JEANSWEAR LTD', ASL: 'ANANTA SPORTSWEAR LTD', ABM: 'ABM FASHIONS LTD' }
  const printOB = () => {
    if (!ob) return
    const o2 = computeOB(ops, style.manpower)
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n')
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const kv = (rows) => rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="c">:</td><td class="v">${v ?? ''}</td></tr>`).join('')
    const info = kv([['Style No / Name', style.styleNo], ['Item', style.item], ['Buyer', style.buyer], ['Product Category', style.category], ['Size', style.sizeBreakdown], ['Fabric Type (Composition)', style.fabricComposition], ['OB Prepared On', dateStr]])
    const smvb = kv([['Machine SMV', o2.machineSMV], ['Manual SMV', o2.manualSMV], ['Total SMV', o2.totalSMV], ['MANPOWER', style.manpower], ['OB Prepared By', style.preparedBy], ['OB Approved By', style.approvedBy]])
    const rowsHtml = o2.rows.map(r => `<tr><td class="num">${r.sl}</td><td class="l">${r.name}</td><td>${r.section || ''}</td><td>${r.machine}</td><td class="num">${r.smv.toFixed(2)}</td><td class="num">${r.tml.toFixed(2)}</td><td class="num">${r.aml}</td><td class="num">${r.target}</td></tr>`).join('')
    const totalAml = o2.rows.reduce((s, r) => s + (Number(r.aml) || 0), 0)
    const css = `@page{margin:10mm}body{margin:0;background:#fff;color:#14303f;font-family:Arial,Helvetica,sans-serif}.no-print{display:none!important}
      .ob-title{text-align:center;margin-bottom:16px}.ob-title h1{margin:0;font-size:22px}.ob-title h2{margin:2px 0 0;font-size:15px;color:#334155}
      .ob-blocks{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
      .kv{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #cbd5e1}.kv td{padding:5px 8px}.kv .k{background:#eef2f7;font-weight:700;width:46%}.kv .c{width:10px}.kv .v{font-weight:600}
      .ops{width:100%;border-collapse:collapse;font-size:11.5px}.ops th,.ops td{border:1px solid #cbd5e1;padding:4px 7px}.ops th{background:#f1f5f9;text-align:left}.ops .num{text-align:right;font-variant-numeric:tabular-nums}.ops .l{white-space:nowrap}.ops tr:nth-child(even) td{background:#fafbfc}.ops .tot td{font-weight:800;background:#eef2f7}
      @media print{.ops tr{break-inside:avoid}}`
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Operation Breakdown — ${style.styleNo || ''}</title>${styles}<style>${css}</style></head><body>
      <div class="ob-title"><h1>${FAC[style.factory] || 'ANANTA COMPANIES'}</h1><h2>Operation Breakdown</h2></div>
      <div class="ob-blocks"><table class="kv">${info}</table><table class="kv">${smvb}</table></div>
      <table class="ops"><thead><tr><th class="num">#</th><th>Process</th><th>Section</th><th>Machine</th><th class="num">SMV</th><th class="num">TML</th><th class="num">AML</th><th class="num">TGT/HR</th></tr></thead>
      <tbody>${rowsHtml}<tr class="tot"><td colspan="4">TOTAL</td><td class="num">${o2.totalSMV.toFixed(2)}</td><td></td><td class="num">${totalAml}</td><td></td></tr></tbody></table>
      </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }
  const submit = () => { updateStyle(style.id, { step: Math.max(style.step, 4), status: 'OB Approval' }); nav(`/style/${style.id}/approval`) }
  const createNewOB = () => updateStyle(style.id, { obApproved: false, approvedBy: null, obVersion: (style.obVersion || 1) + 1, step: 3, status: 'Operation Breakdown', layoutVerified: false, changeRequest: null, obRejected: null })

  const ob = ops.length ? computeOB(ops, style.manpower) : null
  const locked = !!style.obApproved

  return (
    <div>
      <div className="page-head">
        <div><h1>3 · Operation Breakdown</h1></div>
        <div className="flex" style={{ gap: 8 }}>
          {ob ? <button className="btn" onClick={printOB} title="Print the Operation Breakdown">🖨 Print OB</button> : null}
          {canPrepare && !locked && ops.length ? <button className="btn primary" onClick={submit}>Submit for Approval →</button>
            : canPrepare && locked && cr?.status === 'approved' ? <button className="btn primary" onClick={createNewOB}>✚ Create New OB</button>
            : null}
        </div>
      </div>
      {!canPrepare ? <Note tone="blue">👁️ View only — your role ({user.roleLabel}) reviews the OB.</Note> : null}
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="card card-pad flex wrap" style={{ gap: 20, marginBottom: 16, fontSize: 13 }}>
        <span><span className="muted">Buyer</span> <b>{style.buyer || '—'}</b></span>
        <span><span className="muted">Style</span> <b>{style.styleNo}</b></span>
        <span><span className="muted">Product Category</span> <b>{style.category || '—'}</b></span>
      </div>

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
          <Stat label="Machine SMV" value={ob.machineSMV} unit="min" accent="#2563eb" />
          <Stat label="Manual SMV" value={ob.manualSMV} unit="min" foot="Helper + Ironman" accent="#0891b2" />
          <Stat label="Total SMV" value={ob.totalSMV} unit="min" accent="#14303f" />
          <Stat label="Pitch Time" value={ob.pitchTime} unit="min" foot={`Total SMV ÷ ${style.manpower} MP`} />
          <Stat label="Target @100%" value={ob.target100} unit="pcs/hr" accent="#16a34a" />
          <Stat label="Target @80%" value={ob.target80} unit="pcs/hr" accent="#65a30d" />
          <Stat label="Target @70%" value={ob.target70} unit="pcs/hr" accent="#d97706" />
          <Stat label="Operations" value={ops.length} foot="in this OB" accent="#7c3aed" />
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
              <div className="field" style={{ minWidth: 320, flex: 1 }}>
                <label>➕ Special op <span className="muted">· SMV = points × rate</span></label>
                <div className="flex" style={{ gap: 6 }}>
                  <select className="inp" value={splSel} onChange={e => setSplSel(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select special op…</option>
                    {SPECIAL_OPS.map(x => <option key={x.name} value={x.name}>{x.name} ({x.rate}/pt)</option>)}
                  </select>
                  <input className="inp" type="number" min="1" value={splPts} onChange={e => setSplPts(e.target.value)} style={{ width: 64 }} title="Number of points" />
                  <button className="btn" onClick={addSpecial} disabled={!splSel} style={{ height: 38 }}>+ Add</button>
                </div>
              </div>
            </div>
            <div className="ob-quickadd-sep"><span>or pick a value-added process from the library</span></div>
            <ObLibraryPicker onAdd={addFromLibrary} existing={ops} />
          </div>
        </div>
      ) : null}

      {ob ? (
        <div className="card mt">
          <div className="card-head"><h3>Operations ({ob.rows.length})</h3>{!locked && canPrepare ? <span className="hint">⠿ drag a row to reorder</span> : null}</div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 440 }}>
            <table>
              <thead><tr><th>#</th><th>Process</th><th>Section</th><th>Machine</th><th className="num">SMV</th><th className="num">TML</th><th className="num">AML</th><th className="num">Target/hr</th><th></th></tr></thead>
              <tbody>
                {ob.rows.map(r => (
                  <tr key={r.sl} draggable={!locked && canPrepare}
                    onDragStart={() => setDragSl(r.sl)}
                    onDragOver={e => { if (dragSl != null) { e.preventDefault(); if (overSl !== r.sl) setOverSl(r.sl) } }}
                    onDragLeave={() => setOverSl(o => (o === r.sl ? null : o))}
                    onDrop={() => { dropOp(dragSl, r.sl); setDragSl(null); setOverSl(null) }}
                    onDragEnd={() => { setDragSl(null); setOverSl(null) }}
                    style={{ cursor: !locked && canPrepare ? 'grab' : undefined, opacity: dragSl === r.sl ? 0.4 : 1, boxShadow: overSl === r.sl && dragSl != null && dragSl !== r.sl ? 'inset 0 2px 0 #2563eb' : undefined }}>
                    <td className="mono">{r.sl}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td><span className="muted" style={{ fontSize: 11.5 }}>{r.section || '—'}</span></td>
                    <td><Badge tone={r.machine === 'Manual' ? 'gray' : 'blue'}>{r.machine}</Badge></td>
                    <td className="num mono">{r.smv.toFixed(2)}</td>
                    <td className="num mono" style={{ color: '#2563eb', fontWeight: 600 }}>{r.tml.toFixed(2)}</td>
                    <td className="num">{locked || !canPrepare
                      ? <span className="mono">{r.aml}</span>
                      : <input className="inp" type="number" step="0.5" min="0" value={r.aml} onChange={e => setAml(r.sl, e.target.value)} style={{ width: 58, height: 28, textAlign: 'right', padding: '2px 4px' }} />}</td>
                    <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{r.target}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>{locked || !canPrepare ? null : <>
                      <span title="Drag the row to reorder" style={{ cursor: 'grab', color: '#94a3b8', fontSize: 15, marginRight: 8, userSelect: 'none' }}>⠿</span>
                      <button className="btn sm" onClick={() => removeOp(r.sl)} title="Remove">×</button>
                    </>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, borderTop: '2px solid var(--line)', background: '#f8fafc' }}>
                  <td colSpan={4} className="right">TOTAL</td>
                  <td className="num mono" style={{ color: '#14303f' }}>{ob.totalSMV.toFixed(2)}</td>
                  <td></td>
                  <td className="num mono" title="Total Manpower = Σ AML">{ob.rows.reduce((s, r) => s + (Number(r.aml) || 0), 0)}</td>
                  <td></td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
