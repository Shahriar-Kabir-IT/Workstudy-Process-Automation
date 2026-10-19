import { Badge } from './ui.jsx'
import { diffOps } from '../engine/obdiff.js'

// A clean, readable OB operations table (zebra rows, sticky header, section grouping).
export function ObTable({ ob, maxHeight = 420 }) {
  if (!ob) return null
  return (
    <div className="ob-table-wrap" style={{ maxHeight }}>
      <table className="ob-table">
        <thead>
          <tr>
            <th style={{ width: 38 }}>#</th>
            <th>Process</th>
            <th>Section</th>
            <th>Machine</th>
            <th className="num">SMV</th>
            <th className="num">TML</th>
            <th className="num">AML</th>
            <th className="num">Tgt/hr</th>
          </tr>
        </thead>
        <tbody>
          {ob.rows.map(r => (
            <tr key={r.sl}>
              <td className="mono muted">{r.sl}</td>
              <td className="ob-proc">{r.name}</td>
              <td><span className="muted" style={{ fontSize: 11.5 }}>{r.section || '—'}</span></td>
              <td><Badge tone={r.machine === 'Manual' || r.machine === 'HP' ? 'gray' : 'blue'}>{r.machine}</Badge></td>
              <td className="num mono">{r.smv.toFixed(2)}</td>
              <td className="num mono" style={{ color: '#2563eb', fontWeight: 600 }}>{r.tml.toFixed(2)}</td>
              <td className="num mono">{r.aml}</td>
              <td className="num mono" style={{ color: '#16a34a', fontWeight: 600 }}>{r.target}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ fontWeight: 700 }}>Total · {ob.rows.length} operations</td>
            <td className="num mono" style={{ fontWeight: 700 }}>{ob.totalSMV}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// Version history: v1, v2, v3 … with the current one highlighted.
export function ObVersionList({ style }) {
  const history = style.obHistory || []
  const current = style.obVersion || 1
  const rows = []
  history.forEach(h => rows.push({ v: h.version, approvedBy: h.approvedBy, at: h.approvedAt, approved: true }))
  if (!style.obApproved) rows.push({ v: current, draft: true })   // a draft in progress
  rows.sort((a, b) => b.v - a.v)
  if (!rows.length) return <span className="muted" style={{ fontSize: 13 }}>No versions yet.</span>
  return (
    <div className="ob-versions">
      {rows.map(r => (
        <div key={`${r.v}-${r.draft ? 'd' : 'a'}`} className="ob-ver-row">
          <span className="ob-ver-tag">v{r.v}</span>
          {r.draft
            ? <><Badge tone="amber">Draft</Badge><span className="muted">being prepared</span></>
            : <><Badge tone="green">Approved</Badge><span className="muted">by {r.approvedBy || '—'}{r.at ? ' · ' + new Date(r.at).toLocaleDateString() : ''}</span></>}
          {r.v === current ? <span className="ob-ver-current">current</span> : null}
        </div>
      ))}
    </div>
  )
}

// Visual diff between the previously approved OB and the new one.
export function ObDiff({ prev, next, prevLabel = 'previous', nextLabel = 'new' }) {
  const d = diffOps(prev, next)
  if (!d.hasChanges) return <div className="ob-diff-none">No changes vs the {prevLabel} version — the operations are identical.</div>
  return (
    <div className="ob-diff">
      <div className="ob-diff-sum">
        {d.added.length ? <span className="chip add">+{d.added.length} added</span> : null}
        {d.removed.length ? <span className="chip rem">−{d.removed.length} removed</span> : null}
        {d.changed.length ? <span className="chip chg">~{d.changed.length} changed</span> : null}
        <span className="chip same">{d.same} unchanged</span>
      </div>
      <div className="ob-diff-list">
        {d.added.map((o, i) => (
          <div key={'a' + i} className="ob-diff-item add"><span className="mk">＋</span><b>{o.name}</b>
            <span className="meta">{o.machine} · SMV {Number(o.smv).toFixed(2)}</span></div>
        ))}
        {d.changed.map((o, i) => (
          <div key={'c' + i} className="ob-diff-item chg"><span className="mk">～</span><b>{o.name}</b>
            <span className="meta">{o.fields.map((f, j) => <span key={j}>{f.k}: <s>{f.from}</s> → <b>{f.to}</b>{j < o.fields.length - 1 ? ' · ' : ''}</span>)}</span></div>
        ))}
        {d.removed.map((o, i) => (
          <div key={'r' + i} className="ob-diff-item rem"><span className="mk">－</span><b>{o.name}</b>
            <span className="meta">{o.machine} · SMV {Number(o.smv).toFixed(2)}</span></div>
        ))}
      </div>
    </div>
  )
}
