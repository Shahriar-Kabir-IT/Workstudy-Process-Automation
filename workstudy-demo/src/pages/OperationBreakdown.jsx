import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Stat, Badge, Note } from '../components/ui.jsx'
import { computeOB } from '../engine/calc.js'
import { MACHINE_LEGEND, OB_LIBRARY, OB_FIELDS, narrowFor } from '../data/seed.js'

const MACHINES = Object.keys(MACHINE_LEGEND)
const first = (a) => (a && a.length ? a[0] : '')

// build a spec object from a narrow-map, defaulting each field to its first option
function defaultSpec(machine, full = false) {
  const n = full ? OB_FIELDS : narrowFor(machine)
  return {
    needleType: first(n.needleType), needleSize: first(n.needleSize),
    threadNeedle: first(n.threadNeedle), threadBobbin: first(n.threadBobbin),
    gauge: first(n.gauge), foot: first(n.foot), pressure: first(n.pressure),
    folder: '',
  }
}

export default function OperationBreakdown({ style }) {
  const nav = useNavigate()
  const { updateStyle } = useStore()
  const ops = style.ops || []

  const [mode, setMode] = useState('library')
  const [libName, setLibName] = useState('')
  const [aml, setAml] = useState(1)
  const [manName, setManName] = useState('')
  const [manMachine, setManMachine] = useState('SNLS')
  const [manSmv, setManSmv] = useState('')
  const [spec, setSpec] = useState(defaultSpec('SNLS'))
  const [err, setErr] = useState('')

  const match = OB_LIBRARY.find(o => o.name.toLowerCase() === libName.trim().toLowerCase())
  const machine = mode === 'library' ? (match ? match.machine : '') : manMachine
  const smv = mode === 'library' ? (match ? match.smv : null) : Number(manSmv)

  // options for each dropdown — narrowed by the current machine
  const opts = useMemo(() => (machine ? narrowFor(machine) : OB_FIELDS), [machine])

  // when the selected process/machine changes, reset spec defaults to the narrowed set
  const onPick = (val) => {
    setLibName(val)
    const m = OB_LIBRARY.find(o => o.name.toLowerCase() === val.trim().toLowerCase())
    if (m) setSpec(defaultSpec(m.machine))
  }
  const onManMachine = (m) => { setManMachine(m); setSpec(defaultSpec(m)) }
  const setS = (k, v) => setSpec(s => ({ ...s, [k]: v }))

  const push = (op) => updateStyle(style.id, { ops: [...ops, { ...op, sl: ops.length + 1 }] })
  const add = (e) => {
    e.preventDefault()
    const name = mode === 'library' ? (match && match.name) : manName.trim()
    if (!name) { setErr(mode === 'library' ? 'Pick a process from the library.' : 'Process name is required.'); return }
    if (!smv || smv <= 0) { setErr('SMV must be greater than 0.'); return }
    setErr('')
    push({ name, machine, smv, aml: Number(aml) || 1, manual: machine === 'Manual', fromLibrary: mode === 'library', ...spec })
    if (mode === 'library') { setLibName(''); setAml(1); setSpec(defaultSpec('SNLS')) }
    else { setManName(''); setManSmv(''); setAml(1); setSpec(defaultSpec(manMachine)) }
  }
  const removeOp = (sl) => updateStyle(style.id, { ops: ops.filter(o => o.sl !== sl).map((o, i) => ({ ...o, sl: i + 1 })) })
  const submit = () => { updateStyle(style.id, { step: Math.max(style.step, 4), status: 'OB Approval' }); nav(`/style/${style.id}/approval`) }

  const ob = ops.length ? computeOB(ops, style.manpower) : null
  const t100 = smv ? Math.round(60 / smv) : null

  // a narrowed select field
  const Sel = ({ label, k }) => (
    <div className="field" style={{ minWidth: 92 }}>
      <label>{label}</label>
      <select className="inp" value={spec[k]} onChange={e => setS(k, e.target.value)}>
        {(opts[k] || ['N/A']).map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <div className="page-head">
        <div><h1>3 · Operation Breakdown</h1><div className="sub">Responsible: WSE · pick a process — every field's options narrow to that machine</div></div>
        {ops.length ? <button className="btn primary" onClick={submit}>Submit for Approval →</button> : null}
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      {ob ? (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <Stat label="Total SMV" value={ob.totalSMV} unit="min" accent="#2563eb" foot={`Machine ${ob.machineSMV} + Manual ${ob.manualSMV}`} />
          <Stat label="Pitch Time" value={ob.pitchTime} unit="min" foot={`Total SMV ÷ ${style.manpower} MP`} />
          <Stat label="Target @100%" value={ob.target100} unit="pcs/hr" accent="#16a34a" />
          <Stat label="Operations" value={ops.length} foot={`of ${OB_LIBRARY.length} in library`} accent="#0891b2" />
        </div>
      ) : (
        <Note><span>No operations yet. Pick from the <b>OB Library</b> (fields auto-narrow to the machine) or switch to <b>Manual Entry</b>.</span></Note>
      )}

      {/* Add Operation */}
      <div className="card mt">
        <div className="card-head">
          <h3>Add Operation</h3>
          <div className="seg" style={{ marginLeft: 'auto' }}>
            <button className={mode === 'library' ? 'on' : ''} onClick={() => { setMode('library'); setSpec(defaultSpec(match ? match.machine : 'SNLS')) }}>📚 From Library</button>
            <button className={mode === 'manual' ? 'on' : ''} onClick={() => { setMode('manual'); setSpec(defaultSpec(manMachine)) }}>✎ Manual Entry</button>
          </div>
        </div>
        <form onSubmit={add} className="card-pad">
          {/* row 1: identity */}
          <div className="grid" style={{ gridTemplateColumns: mode === 'library' ? '2.4fr 0.8fr 0.6fr auto' : '1.8fr 1fr 0.8fr 0.6fr auto', gap: 10, alignItems: 'end' }}>
            {mode === 'library' ? (
              <div className="field"><label>Process (search library)</label>
                <input className="inp" list="ob-lib" value={libName} onChange={e => onPick(e.target.value)} placeholder="Type to search… e.g. Side Seam Join" />
                <datalist id="ob-lib">{OB_LIBRARY.filter(o => !ops.some(x => x.name === o.name)).map(o => <option key={o.name} value={o.name} />)}</datalist>
              </div>
            ) : (
              <>
                <div className="field"><label>Process name</label><input className="inp" value={manName} onChange={e => setManName(e.target.value)} placeholder="e.g. Special Tack" /></div>
                <div className="field"><label>Machine</label><select className="inp" value={manMachine} onChange={e => onManMachine(e.target.value)}>{MACHINES.map(m => <option key={m}>{m}</option>)}</select></div>
              </>
            )}
            {mode === 'library' ? (
              <div className="field"><label>Machine (auto)</label><input className="inp" value={machine || ''} disabled placeholder="—" /></div>
            ) : null}
            <div className="field"><label>{mode === 'library' ? 'SMV (auto)' : 'SMV (min)'}</label>
              {mode === 'library'
                ? <input className="inp" value={smv != null ? smv.toFixed(2) : ''} disabled placeholder="—" />
                : <input className="inp" type="number" step="0.01" value={manSmv} onChange={e => setManSmv(e.target.value)} placeholder="0.35" />}
            </div>
            <div className="field"><label>AML</label><input className="inp" type="number" step="0.5" value={aml} onChange={e => setAml(e.target.value)} /></div>
            <button type="submit" className="btn primary" style={{ height: 38 }} disabled={mode === 'library' && !match}>+ Add</button>
          </div>

          {/* row 2: narrowed spec dropdowns */}
          <div className="flex wrap" style={{ gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
            <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{machine ? `Narrowed for ${machine} →` : 'Select a process →'}</span>
            <Sel label="Needle Type" k="needleType" />
            <Sel label="Needle Size" k="needleSize" />
            <Sel label="Thread (Ndl)" k="threadNeedle" />
            <Sel label="Thread (Bob)" k="threadBobbin" />
            <Sel label="Gauge" k="gauge" />
            <Sel label="Foot" k="foot" />
            <Sel label="Pressure" k="pressure" />
            <div className="field" style={{ minWidth: 120 }}><label>Folder / Measure</label><input className="inp" value={spec.folder} onChange={e => setS('folder', e.target.value)} placeholder="e.g. 41 mm" /></div>
          </div>
          {t100 ? <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Target @100%: <b>{t100}</b> · @65%: <b>{Math.round(t100 * 0.65)}</b> pcs/hr</div> : null}
          {err ? <div style={{ marginTop: 10 }}><Note tone="">{err}</Note></div> : null}
        </form>
      </div>

      {ob ? (
        <div className="card mt">
          <div className="card-head"><h3>Operations ({ob.rows.length})</h3><span className="hint">scroll → for all fields</span></div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
            <table style={{ minWidth: 980 }}>
              <thead><tr>
                <th>#</th><th>Process</th><th>Machine</th><th className="num">SMV</th><th className="num">TML</th><th className="num">AML</th><th className="num">Tgt/hr</th>
                <th>Needle</th><th>Size</th><th>Thread</th><th>Gauge</th><th>Foot</th><th>Pressure</th><th>Folder</th><th></th>
              </tr></thead>
              <tbody>
                {ob.rows.map(r => (
                  <tr key={r.sl}>
                    <td className="mono">{r.sl}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td><Badge tone={r.machine === 'Manual' ? 'gray' : 'blue'}>{r.machine}</Badge></td>
                    <td className="num mono">{r.smv.toFixed(2)}</td>
                    <td className="num mono" style={{ color: '#2563eb', fontWeight: 600 }}>{r.tml.toFixed(2)}</td>
                    <td className="num mono">{r.aml}</td>
                    <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{r.target}</td>
                    <td className="mono">{r.needleType || '—'}</td>
                    <td className="mono">{r.needleSize || '—'}</td>
                    <td className="mono">{r.threadNeedle ? `${r.threadNeedle}/${r.threadBobbin}` : '—'}</td>
                    <td className="mono">{r.gauge || '—'}</td>
                    <td className="mono">{r.foot || '—'}</td>
                    <td className="mono">{r.pressure || '—'}</td>
                    <td className="mono">{r.folder || '—'}</td>
                    <td className="right"><button className="btn sm" onClick={() => removeOp(r.sl)} title="Remove">×</button></td>
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
