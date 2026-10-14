import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useStore } from './store.jsx'
import { StepSidebar, Topbar } from './components/Shell.jsx'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NewOrder from './pages/NewOrder.jsx'
import Operators from './pages/Operators.jsx'
import OrderDetails from './pages/OrderDetails.jsx'
import ApprovedSample from './pages/ApprovedSample.jsx'
import OperationBreakdown from './pages/OperationBreakdown.jsx'
import OBApproval from './pages/OBApproval.jsx'
import LineLayout from './pages/LineLayout.jsx'
import LayoutVerification from './pages/LayoutVerification.jsx'
import ProductionPlan from './pages/ProductionPlan.jsx'
import Changeover from './pages/Changeover.jsx'
import CycleTime from './pages/CycleTime.jsx'
import SkillMatrix from './pages/SkillMatrix.jsx'

const STEP_PAGES = {
  order: OrderDetails, sample: ApprovedSample, ob: OperationBreakdown,
  approval: OBApproval, layout: LineLayout, verify: LayoutVerification,
  plan: ProductionPlan, changeover: Changeover, cycle: CycleTime, skill: SkillMatrix,
}

function StyleFlow() {
  const { id, step } = useParams()
  const { styleById } = useStore()
  const style = styleById(id)
  if (!style) return <Navigate to="/dashboard" />
  const Page = STEP_PAGES[step] || OrderDetails
  return (
    <div className="shell">
      <StepSidebar style={style} activeKey={step} />
      <div className="main">
        <Topbar crumbs={<><b>{style.styleNo}</b> · {style.item} · <span>{style.buyer}</span></>} />
        <div className="content"><Page style={style} /></div>
      </div>
    </div>
  )
}

export default function App() {
  const { user } = useStore()
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/new-order" element={<NewOrder />} />
      <Route path="/operators" element={<Operators />} />
      <Route path="/style/:id/:step" element={<StyleFlow />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}
