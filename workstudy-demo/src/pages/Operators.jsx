import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useStore } from '../store.jsx'
import { Topbar } from '../components/Shell.jsx'
import { Card, Badge, Note } from '../components/ui.jsx'
import { FACTORIES, lineCount } from '../data/seed.js'

// find a value in a row object by fuzzy header match
const pick = (row, rx) => {
  const k = Object.keys(row).find(key => rx.test(key.toLowerCase().trim()))
  return k != null ? row[k] : undefined
}

export default function Operators() {
  const { user, operatorsFor, replaceFactoryOperators, appendOperators, clearFactoryOperators } = useStore()
  const nav = useNavigate()
  const fileRef = useRef(null)
  const facOptions = user.crossFactory ? FACTORIES : FACTORIES.filter(f => f.code === user.factory)
  const [factory, setFactory] = useState(facOptions[0].code)
  const [mode, setMode] = useState('replace') // replace | append
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState('')

  const list = operatorsFor(factory)

  const parseFile = (file) => {
    setErr(''); setMsg(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!rows.length) { setErr('No rows found in the file.'); return }
        const parsed = rows.map((r, i) => {
          const name = String(pick(r, /name|operator|worker/) ?? '').trim()
          const id = String(pick(r, /\bid\b|code|card|emp/) ?? '').trim() || `${factory}-${Date.now().toString(36)}-${i}`
          const grade = String(pick(r, /grade|skill/) ?? 'B').trim() || 'B'
          const floor = String(pick(r, /floor/) ?? '').trim()
          const line = String(pick(r, /line/) ?? '').trim()
          const machine = String(pick(r, /machine|m\/c/) ?? '').trim()
          return { id, name, grade, floor, line, machine, factory }
        }).filter(o => o.name)
        if (!parsed.length) { setErr('Could not find a Name column. Expected headers: ID, Name, Grade, Floor, Line, Machine.'); return }

        const save = mode === 'replace' ? replaceFactoryOperators(factory, parsed) : appendOperators(factory, parsed)
        save
          .then(() => setMsg(`${parsed.length} operators ${mode === 'replace' ? 'loaded (replaced ' + factory + ')' : 'appended to ' + factory}.`))
          .catch(ex2 => setErr(ex2.message || 'Could not save operators to the server.'))
      } catch (ex) {
        setErr('Could not read the file. Use .xlsx or .csv with headers: ID, Name, Grade, Line.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { ID: 'OP-501', Name: 'Operator Name', Grade: 'A', Floor: '4th Floor', Line: 25, Machine: 'SNLS' },
      { ID: 'OP-502', Name: 'Another Operator', Grade: 'B', Floor: '4th Floor', Line: 26, Machine: '4T O/L' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Operators')
    XLSX.writeFile(wb, `operator-list-template.xlsx`)
  }

  const clearFactory = () => { if (confirm(`Clear all operators for ${factory}?`)) clearFactoryOperators(factory).then(() => setMsg(`Cleared ${factory} operators.`)).catch(ex => setErr(ex.message)) }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="main">
        <Topbar crumbs={<><b>Operators</b> · master list</>} />
        <div className="content">
          <div className="page-head">
            <div><h1>👷 Operator List</h1><div className="sub">Upload and maintain the operator master list per factory — used in Cycle Time &amp; Skill Matrix</div></div>
            <button className="btn" onClick={() => nav('/dashboard')}>← Dashboard</button>
          </div>

          <div className="grid cols-2">
            <Card title="Upload Operator List">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { parseFile(e.target.files && e.target.files[0]); e.target.value = '' }} />

              <div className="field"><label>Factory</label>
                <select className="inp" value={factory} onChange={e => setFactory(e.target.value)} disabled={!user.crossFactory}>
                  {facOptions.map(f => <option key={f.code} value={f.code}>{f.code} — {f.name} ({lineCount(f.code)} lines)</option>)}
                </select>
              </div>

              <div className="field"><label>On upload</label>
                <div className="seg">
                  <button className={mode === 'replace' ? 'on' : ''} onClick={() => setMode('replace')}>Replace {factory}</button>
                  <button className={mode === 'append' ? 'on' : ''} onClick={() => setMode('append')}>Append</button>
                </div>
              </div>

              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); parseFile(e.dataTransfer.files && e.dataTransfer.files[0]) }}
                style={{ marginTop: 10, height: 150, borderRadius: 10, border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center', color: '#64748b' }}>
                <div>
                  <div style={{ fontSize: 30 }}>📤</div>
                  <div style={{ fontWeight: 600, marginTop: 4, color: '#334155' }}>Click to upload .xlsx / .csv</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>or drag &amp; drop · headers: ID, Name, Grade, Floor, Line, Machine</div>
                </div>
              </div>

              <div className="flex" style={{ marginTop: 12, gap: 10 }}>
                <button className="btn" onClick={downloadTemplate}>⬇ Download template</button>
                <button className="btn" onClick={clearFactory}>Clear {factory}</button>
              </div>
              {msg ? <div style={{ marginTop: 12 }}><Note tone="blue">{msg}</Note></div> : null}
              {err ? <div style={{ marginTop: 12 }}><Note tone="">{err}</Note></div> : null}
            </Card>

            <Card title={`Current Operators — ${factory}`} hint={`${list.length} total`}>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Floor</th><th>Line</th><th>Machine</th></tr></thead>
                  <tbody>
                    {list.length === 0 ? <tr><td colSpan={6}><div className="center muted" style={{ padding: '30px 0' }}>No operators for {factory}. Upload a list.</div></td></tr> : null}
                    {list.map(o => (
                      <tr key={o.id}>
                        <td className="mono muted">{o.id}</td>
                        <td><b>{o.name}</b></td>
                        <td><Badge tone={o.grade?.startsWith('A') ? 'green' : o.grade === 'B' ? 'blue' : 'amber'}>{o.grade || '—'}</Badge></td>
                        <td>{o.floor || '—'}</td>
                        <td>{o.line ? `Line ${o.line}` : '—'}</td>
                        <td>{o.machine ? <Badge tone={o.machine === 'Manual' ? 'gray' : 'blue'}>{o.machine}</Badge> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
