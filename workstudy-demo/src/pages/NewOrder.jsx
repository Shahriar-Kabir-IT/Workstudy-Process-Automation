import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { Topbar } from '../components/Shell.jsx'
import { Card, Note } from '../components/ui.jsx'
import { CATEGORIES } from '../data/seed.js'
import { api } from '../api.js'

export default function NewOrder() {
  const { user, addStyle } = useStore()
  const nav = useNavigate()

  const [cats, setCats] = useState(CATEGORIES)
  const [f, setF] = useState({
    buyer: '', styleNo: '', item: '', category: CATEGORIES[0] || '', order: 20000, manpower: 50,
  })
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  // Product categories mirror the OB Library (Excel) — load them live from the API.
  useEffect(() => {
    api.obOptions({}).then(d => {
      if (d?.categories?.length) {
        setCats(d.categories)
        setF(s => (d.categories.includes(s.category) ? s : { ...s, category: d.categories[0] }))
      }
    }).catch(() => { /* keep config fallback */ })
  }, [])

  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!f.buyer || !f.styleNo || !f.item) { setErr('Buyer, Style No. and Item are required.'); return }
    setErr(''); setBusy(true)
    const style = {
      factory: user.factory,                 // enforced server-side from the logged-in user
      styleNo: f.styleNo.trim(), item: f.item.trim(), category: f.category,
      buyer: f.buyer.trim(),
      order: Number(f.order) || 0, manpower: Number(f.manpower) || 0, smv: 0,
      lines: [], floor: null, line: null, lineShape: null,   // assigned later in Line Layout (can be multiple, any floor)
      step: 2, status: 'Approved Sample', sampleApproved: false, obApproved: false, obVersion: 1, layoutVerified: false,
      ops: [], cycle: null, isNew: true,
    }
    try {
      const created = await addStyle(style)
      nav(`/style/${created.id}/order`)
    } catch (ex) {
      setErr(ex.message || 'Could not create the order. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="main">
        <Topbar crumbs={<><b>New Order</b> · create a style</>} />
        <div className="content" style={{ maxWidth: 760 }}>
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
                  <select className="inp" value={f.category} onChange={e => set('category', e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select>
                </div>
                <div className="field"><label>Order Quantity (pcs)</label><input className="inp" type="number" value={f.order} onChange={e => set('order', e.target.value)} /></div>
                <div className="field"><label>Planned Manpower</label><input className="inp" type="number" value={f.manpower} onChange={e => set('manpower', e.target.value)} /></div>
              </div>
            </Card>

            <Note tone="blue" >Factory is your assigned <b>{user.factory}</b>. <b>Floor, line and line-shape are assigned later</b> in the Line Layout step.</Note>

            {err ? <div style={{ marginTop: 14 }}><Note tone="">{err}</Note></div> : null}

            <div className="flex" style={{ marginTop: 18, gap: 10 }}>
              <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create Order & Continue →'}</button>
              <button type="button" className="btn" onClick={() => nav('/dashboard')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
