import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { Topbar } from '../components/Shell.jsx'
import { Card, Note } from '../components/ui.jsx'
import { FACTORIES, getFactory } from '../data/seed.js'

const CATEGORIES = ['Long Pant', 'Short Pant', 'Jacket', 'T-Shirt', 'Shirt', 'Denim']

export default function NewOrder() {
  const { user, addStyle } = useStore()
  const nav = useNavigate()
  const facOptions = user.crossFactory ? FACTORIES : FACTORIES.filter(f => f.code === user.factory)

  const [f, setF] = useState({
    buyer: '', styleNo: '', item: '', category: 'Long Pant',
    factory: facOptions[0].code, line: facOptions[0].lines[0],
    lineShape: 'U', manpower: 50, order: 20000,
  })
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const lines = getFactory(f.factory)?.lines || []

  const submit = (e) => {
    e.preventDefault()
    if (!f.buyer || !f.styleNo || !f.item) { setErr('Buyer, Style No. and Item are required.'); return }
    const style = {
      id: 'S-' + Date.now().toString(36).toUpperCase(),
      factory: f.factory, styleNo: f.styleNo.trim(), item: f.item.trim(), category: f.category,
      buyer: f.buyer.trim(), line: f.line, lineShape: f.lineShape,
      manpower: Number(f.manpower) || 0, order: Number(f.order) || 0, smv: 0,
      step: 2, status: 'Approved Sample', sampleApproved: false, obApproved: false, layoutVerified: false,
      ops: [], cycle: null, preparedBy: user.name, approvedBy: null, isNew: true,
    }
    addStyle(style)
    nav(`/style/${style.id}/order`)
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="main">
        <Topbar crumbs={<><b>New Order</b> · create a style</>} />
        <div className="content" style={{ maxWidth: 820 }}>
          <div className="page-head">
            <div><h1>➕ New Order Details</h1><div className="sub">Step 1 · Get Order Details — Source: Planning Board</div></div>
            <button className="btn" onClick={() => nav('/dashboard')}>← Cancel</button>
          </div>

          <form onSubmit={submit}>
            <Card title="Order Information">
              <div className="grid cols-2">
                <div className="field"><label>Buyer *</label><input className="inp" value={f.buyer} onChange={e => set('buyer', e.target.value)} placeholder="e.g. Bestseller" /></div>
                <div className="field"><label>Style No. *</label><input className="inp" value={f.styleNo} onChange={e => set('styleNo', e.target.value)} placeholder="e.g. 10520" /></div>
                <div className="field"><label>Item *</label><input className="inp" value={f.item} onChange={e => set('item', e.target.value)} placeholder="e.g. Cargo Pant" /></div>
                <div className="field"><label>Product Category</label>
                  <select className="inp" value={f.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field"><label>Order Quantity (pcs)</label><input className="inp" type="number" value={f.order} onChange={e => set('order', e.target.value)} /></div>
                <div className="field"><label>Planned Manpower</label><input className="inp" type="number" value={f.manpower} onChange={e => set('manpower', e.target.value)} /></div>
              </div>
            </Card>

            <div style={{ height: 16 }} />
            <Card title="Assignment">
              <div className="grid cols-2">
                <div className="field"><label>Factory</label>
                  <select className="inp" value={f.factory} onChange={e => { const fac = getFactory(e.target.value); set('factory', e.target.value); set('line', fac.lines[0]) }} disabled={!user.crossFactory}>
                    {facOptions.map(x => <option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Line</label>
                  <select className="inp" value={f.line} onChange={e => set('line', e.target.value)}>
                    {lines.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="field"><label>Line Shape</label>
                  <select className="inp" value={f.lineShape} onChange={e => set('lineShape', e.target.value)}>
                    <option value="U">U-shape</option>
                    <option value="I">I-shape</option>
                  </select>
                </div>
                <div className="field"><label>Prepared By</label><input className="inp" value={user.name} disabled /></div>
              </div>
            </Card>

            {err ? <div style={{ marginTop: 14 }}><Note tone="">{err}</Note></div> : null}

            <div className="flex" style={{ marginTop: 18, gap: 10 }}>
              <button type="submit" className="btn primary">Create Order & Continue →</button>
              <button type="button" className="btn" onClick={() => nav('/dashboard')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
