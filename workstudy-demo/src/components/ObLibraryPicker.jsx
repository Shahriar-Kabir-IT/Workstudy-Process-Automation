import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Badge, Note } from './ui.jsx'

// Stepwise, gated OB-library picker:
// Category → Product Type → Fabric Type → Section → pick a process.
// Each choice reveals (and narrows) the next step; the process list appears last.
export default function ObLibraryPicker({ onAdd, existing = [] }) {
  const [f, setF] = useState({ category: '', productType: '', fabricType: '', section: '', q: '' })
  const [opts, setOpts] = useState({ categories: [], productTypes: [], fabricTypes: [], sections: [] })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [aml, setAml] = useState(1)
  const debounce = useRef()

  // selecting a step resets every step below it
  const set = (k, v) => setF(s => ({
    ...s, [k]: v,
    ...(k === 'category' ? { productType: '', fabricType: '', section: '', q: '' }
      : k === 'productType' ? { fabricType: '', section: '', q: '' }
      : k === 'fabricType' ? { section: '', q: '' }
      : k === 'section' ? { q: '' } : {}),
  }))

  // cascading option lists (each call narrows to the choices above it)
  useEffect(() => {
    api.obOptions({ category: f.category, productType: f.productType, fabricType: f.fabricType })
      .then(setOpts).catch(() => setErr('Cannot reach the API. Is the server running?'))
  }, [f.category, f.productType, f.fabricType])

  // process list — only once the full cascade (through Section) is chosen
  useEffect(() => {
    clearTimeout(debounce.current)
    if (!f.section) { setItems([]); setTotal(0); return }
    debounce.current = setTimeout(() => {
      setLoading(true); setErr('')
      api.obLibrary({ category: f.category, productType: f.productType, fabricType: f.fabricType, section: f.section, q: f.q, limit: 1000 })
        .then(d => { setItems(d.items); setTotal(d.total) })
        .catch(() => setErr('Cannot reach the API. Is the server running?'))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(debounce.current)
  }, [f.category, f.productType, f.fabricType, f.section, f.q])

  const added = new Set(existing.map(o => o.name))
  const step = (n, label, value, options, enabled, placeholder, key) => (
    <div className="field" style={{ minWidth: 150, opacity: enabled ? 1 : 0.45 }}>
      <label><span className="mono" style={{ color: 'var(--muted)' }}>{n}</span> · {label}</label>
      <select className="inp" value={value} disabled={!enabled} onChange={e => set(key, e.target.value)}>
        <option value="">{enabled ? placeholder : '—'}</option>
        {options.map(c => <option key={c}>{c}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <div className="flex wrap" style={{ gap: 10, alignItems: 'end' }}>
        {step('1', 'Product Category', f.category, opts.categories, true, 'Select category…', 'category')}
        {step('2', 'Product Type', f.productType, opts.productTypes, !!f.category, 'Select type…', 'productType')}
        {step('3', 'Fabric Type', f.fabricType, opts.fabricTypes, !!f.productType, 'Select fabric…', 'fabricType')}
        {step('4', 'Section', f.section, opts.sections, !!f.fabricType, 'Select section…', 'section')}
      </div>

      {err ? <div className="mt-s"><Note tone="">{err}</Note></div> : null}

      {!f.section ? (
        <div className="mt-s"><Note tone="blue">
          <span>Choose <b>category → type → fabric → section</b> — the process list appears once you reach Section.</span>
        </Note></div>
      ) : (
        <>
          <div className="flex wrap mt-s" style={{ gap: 10, alignItems: 'end' }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>5 · Process <span className="muted">(filter the list)</span></label>
              <input className="inp" value={f.q} onChange={e => set('q', e.target.value)} placeholder="type to filter… e.g. zipper" />
            </div>
            <div className="field" style={{ width: 80 }}><label>AML</label>
              <input className="inp" type="number" step="0.5" value={aml} onChange={e => setAml(e.target.value)} />
            </div>
          </div>

          <div className="mt-s" style={{ fontSize: 12 }}>
            {loading ? <span className="muted">Loading…</span>
              : <span className="muted">{total.toLocaleString()} process{total === 1 ? '' : 'es'}{total > items.length ? ` (showing ${items.length})` : ''} for {f.category} · {f.productType} · {f.fabricType} · {f.section}</span>}
          </div>

          {items.length ? (
            <div className="table-wrap mt-s" style={{ border: '1px solid var(--line)', maxHeight: 340 }}>
              <table>
                <thead><tr><th>Process</th><th>Machine</th><th className="num">SMV</th><th></th></tr></thead>
                <tbody>
                  {items.map(it => {
                    const dup = added.has(it.process_name)
                    return (
                      <tr key={it.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{it.process_name}</td>
                        <td>{it.machine_type ? <Badge tone="blue">{it.machine_type}</Badge> : '—'}</td>
                        <td className="num mono">{it.smv != null ? Number(it.smv).toFixed(2) : '—'}</td>
                        <td className="right">
                          <button className="btn sm primary" disabled={dup}
                            onClick={() => onAdd({ name: it.process_name, machine: it.machine_type || 'SNLS', smv: Number(it.smv) || 0, section: it.section, aml: Number(aml) || 1 })}>
                            {dup ? 'added' : '+ add'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : !loading ? <div className="mt-s"><Note>No processes match — try a different section or clear the filter.</Note></div> : null}
        </>
      )}
    </div>
  )
}
