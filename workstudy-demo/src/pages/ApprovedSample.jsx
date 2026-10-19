import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ProgressRail } from '../components/Shell.jsx'
import { Card, KV, Badge, Note } from '../components/ui.jsx'
import { can } from '../data/seed.js'

export default function ApprovedSample({ style }) {
  const nav = useNavigate()
  const { user, photos, addPhotos, removePhoto, updateStyle } = useStore()
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const list = photos[style.id] || []
  const approved = style.sampleApproved
  const canManage = can('sampleManage', user.role)   // upload photos (WSE)
  const canDecide = can('sampleDecide', user.role)    // approve / reject

  const approve = () => updateStyle(style.id, { sampleApproved: true, sampleRejected: null, step: Math.max(style.step, 3) })
  const reject = () => updateStyle(style.id, { sampleApproved: false, sampleRejected: { by: user.name }, step: 2 })

  const onFiles = (files) => {
    setErr('')
    if (!files || !files.length) return
    const arr = Array.from(files)
    const bad = arr.find(f => !f.type.startsWith('image/'))
    if (bad) { setErr('Only image files are allowed (JPG, PNG, …).'); return }
    const big = arr.find(f => f.size > 6 * 1024 * 1024)
    if (big) { setErr('Each image must be under 6 MB.'); return }
    Promise.all(arr.map(f => new Promise(res => {
      const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f)
    }))).then(urls => addPhotos(style.id, urls))
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>2 · Collect Approved Sample</h1><div className="sub">Source: Production Co-ordinator</div></div>
        <button className="btn primary" disabled={!approved} title={approved ? '' : 'Approve the sample first'}
          onClick={() => nav(`/style/${style.id}/ob`)}>Next: Operation Breakdown →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-2">
        <Card title="Sample Photos" hint={`${list.length} photo${list.length === 1 ? '' : 's'}`}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { onFiles(e.target.files); e.target.value = '' }} />

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files) }}>
            {list.length === 0 ? (
              canManage ? (
                <div onClick={() => fileRef.current.click()}
                  style={{ height: 200, borderRadius: 10, border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center', color: '#64748b' }}>
                  <div>
                    <div style={{ fontSize: 32 }}>📷⬆️</div>
                    <div style={{ fontWeight: 600, marginTop: 6, color: '#334155' }}>Click to upload sample photos</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>select multiple · or drag &amp; drop (JPG / PNG, up to 6 MB each)</div>
                  </div>
                </div>
              ) : <div style={{ height: 160, borderRadius: 10, background: '#f8fafc', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>No sample photos uploaded yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 }}>
                {list.map((src, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--line)', aspectRatio: '1', background: '#0f172a' }}>
                    <img src={src} alt={`Sample ${i + 1}`} onClick={() => setLightbox(src)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                    {canManage ? <button onClick={() => removePhoto(style.id, i)} title="Remove"
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,.75)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>×</button> : null}
                    <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: '#fff', textShadow: '0 1px 2px #000' }}>#{i + 1}</span>
                  </div>
                ))}
                {canManage ? <button onClick={() => fileRef.current.click()}
                  style={{ borderRadius: 9, border: '2px dashed #cbd5e1', background: '#f8fafc', aspectRatio: '1', cursor: 'pointer', color: '#64748b', display: 'grid', placeItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22 }}>＋</div><div style={{ fontSize: 11 }}>Add more</div></div>
                </button> : null}
              </div>
            )}
          </div>
          {err ? <div style={{ marginTop: 10 }}><Note tone="">{err}</Note></div> : null}
        </Card>

        <Card title="Sample Details">
          <KV k="Item" v={style.item} />
          <KV k="Category" v={style.category} />
          <KV k="Buyer" v={style.buyer} />
          <KV k="Photos attached" v={list.length} />
          <KV k="Sample Status" v={approved ? <Badge tone="green">Approved ✓</Badge> : style.sampleRejected ? <Badge tone="red">Rejected</Badge> : <Badge tone="amber">Pending</Badge>} />
          <div className="flex wrap" style={{ marginTop: 14, gap: 8 }}>
            {canDecide ? (
              <>
                <button className="btn primary" disabled={approved || !list.length} onClick={approve}>{approved ? 'Approved ✓' : '✓ Approve'}</button>
                {!approved ? <button className="btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} disabled={!list.length} onClick={reject}>✕ Reject</button> : null}
              </>
            ) : null}
            {approved ? <button className="btn" onClick={() => nav(`/style/${style.id}/ob`)}>Go to Operation Breakdown →</button> : null}
          </div>
          {style.sampleRejected && !approved ? <div style={{ marginTop: 8 }}><Note tone="">Sample rejected by {style.sampleRejected.by} — re-upload / resubmit.</Note></div> : null}
          {!list.length ? <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Upload at least one photo to enable approval.</div>
            : !approved ? <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Approving the sample unlocks the Operation Breakdown.</div> : null}
          <Note tone="blue">Attach multiple angles (front, back, detail). The sample defines <b>which operations</b> the garment needs — SMV comes from the master database.</Note>
        </Card>
      </div>

      {lightbox ? (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,23,.8)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 30 }}>
          <img src={lightbox} alt="Sample" style={{ maxWidth: '92%', maxHeight: '90%', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
        </div>
      ) : null}
    </div>
  )
}
