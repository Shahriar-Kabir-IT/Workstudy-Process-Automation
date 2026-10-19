import { useNavigate } from 'react-router-dom'
import { ProgressRail } from '../components/Shell.jsx'
import { Card, KV, Badge } from '../components/ui.jsx'

export default function OrderDetails({ style }) {
  const nav = useNavigate()
  return (
    <div>
      <div className="page-head">
        <div><h1>1 · Order Details</h1><div className="sub">Source: Planning Board</div></div>
        <button className="btn primary" onClick={() => nav(`/style/${style.id}/sample`)}>Next: Approved Sample →</button>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressRail step={style.step} /></div>

      <div className="grid cols-2">
        <Card title="Order Information">
          <KV k="Buyer" v={style.buyer} />
          <KV k="Style No." v={style.styleNo} />
          <KV k="Item" v={style.item} />
          <KV k="Product Category" v={style.category} />
          <KV k="Order Quantity" v={<b>{style.order.toLocaleString()} pcs</b>} />
        </Card>
        <Card title="Assignment">
          <KV k="Factory" v={<Badge tone="blue">{style.factory}</Badge>} />
          <KV k="Floor / Line" v={style.line ? `${style.floor} · Line ${style.line}` : <span className="muted">assigned in Line Layout</span>} />
          <KV k="Line Shape" v={style.lineShape ? <Badge tone={style.lineShape === 'U' ? 'cyan' : 'blue'}>{style.lineShape}-shape</Badge> : <span className="muted">declared later</span>} />
          <KV k="Planned Manpower" v={style.manpower} />
          <KV k="Prepared By" v={style.preparedBy || '—'} />
        </Card>
      </div>
    </div>
  )
}
