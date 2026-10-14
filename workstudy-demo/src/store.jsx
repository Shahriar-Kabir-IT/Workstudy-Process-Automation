import { createContext, useContext, useState } from 'react'
import { STYLES, OPERATORS } from './data/seed.js'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

function loadUser() {
  try { return JSON.parse(sessionStorage.getItem('ws_user')) } catch { return null }
}
function loadStyles() {
  try { return JSON.parse(sessionStorage.getItem('ws_styles_v2')) || [] } catch { return [] }
}
function loadOverrides() {
  try { return JSON.parse(sessionStorage.getItem('ws_overrides_v2')) || {} } catch { return {} }
}
function loadOperators() {
  try {
    const s = sessionStorage.getItem('ws_operators_v1')
    return s ? JSON.parse(s) : OPERATORS
  } catch { return OPERATORS }
}

export function StoreProvider({ children }) {
  const [user, setUser] = useState(loadUser)
  const [custom, setCustom] = useState(loadStyles)
  const [overrides, setOverrides] = useState(loadOverrides) // styleId -> partial patch
  const [photos, setPhotos] = useState({}) // styleId -> [dataURL] (in-memory for the session)
  const addPhotos = (id, urls) => setPhotos(p => ({ ...p, [id]: [...(p[id] || []), ...urls] }))
  const removePhoto = (id, idx) => setPhotos(p => ({ ...p, [id]: (p[id] || []).filter((_, i) => i !== idx) }))

  const [operators, setOperatorsState] = useState(loadOperators)
  const persistOps = (list) => { try { sessionStorage.setItem('ws_operators_v1', JSON.stringify(list)) } catch {} }
  const setOperators = (list) => { setOperatorsState(list); persistOps(list) }
  const addOperators = (list) => { const next = [...operators, ...list]; setOperatorsState(next); persistOps(next) }
  const operatorsFor = (code) => operators.filter(o => o.factory === code)

  // custom (user-created) orders first, then the seeded demo styles — with per-style overrides merged in
  const allStyles = [...custom, ...STYLES].map(s => (overrides[s.id] ? { ...s, ...overrides[s.id] } : s))

  const updateStyle = (id, patch) => {
    setOverrides(o => {
      const next = { ...o, [id]: { ...(o[id] || {}), ...patch } }
      try { sessionStorage.setItem('ws_overrides_v2', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const login = (u) => {
    setUser(u)
    try { sessionStorage.setItem('ws_user', JSON.stringify(u)) } catch {}
  }
  const logout = () => {
    setUser(null)
    try { sessionStorage.removeItem('ws_user') } catch {}
  }
  const addStyle = (s) => {
    const next = [s, ...custom]
    setCustom(next)
    try { sessionStorage.setItem('ws_styles_v2', JSON.stringify(next)) } catch {}
  }

  const styleById = (id) => allStyles.find(s => s.id === id)
  const stylesForUser = (u) =>
    u.crossFactory ? allStyles : allStyles.filter(s => s.factory === u.factory)

  return (
    <StoreCtx.Provider value={{ user, login, logout, allStyles, addStyle, updateStyle, styleById, stylesForUser, photos, addPhotos, removePhoto, operators, operatorsFor, setOperators, addOperators }}>
      {children}
    </StoreCtx.Provider>
  )
}
