import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, token, setUnauthorizedHandler } from './api.js'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

const USER_KEY = 'ws_user'
const loadCachedUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } }
const cacheUser = (u) => { try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY) } catch {} }

export function StoreProvider({ children }) {
  const [user, setUser] = useState(loadCachedUser)      // cached for instant UI; verified on mount
  const [styles, setStyles] = useState([])
  const [operators, setOperators] = useState([])
  const [ready, setReady] = useState(false)

  const loadAll = useCallback(async () => {
    const [st, ops] = await Promise.all([
      api.styles.list().catch(() => []),
      api.operators.list().catch(() => []),
    ])
    setStyles(st || []); setOperators(ops || [])
  }, [])

  // restore session from a stored token on first load
  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); cacheUser(null); setStyles([]); setOperators([]) })
    let cancelled = false
    ;(async () => {
      if (token.get()) {
        try {
          const { user: me } = await api.auth.me()
          if (cancelled) return
          setUser(me); cacheUser(me)
          await loadAll()
        } catch { if (!cancelled) { setUser(null); cacheUser(null); token.clear() } }
      }
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [loadAll])

  const login = async (username, password) => {
    const { token: tok, user: u } = await api.auth.login(username, password)
    token.set(tok); setUser(u); cacheUser(u)
    await loadAll()
    return u
  }
  const logout = () => { token.clear(); cacheUser(null); setUser(null); setStyles([]); setOperators([]) }

  // ---- styles ----
  const addStyle = async (s) => {
    const created = await api.styles.create(s)
    setStyles(list => [created, ...list])
    return created
  }
  const updateStyle = (id, patch) => {
    setStyles(list => list.map(s => (s.id === id ? { ...s, ...patch } : s)))   // optimistic
    api.styles.patch(id, patch)
      .then(doc => setStyles(list => list.map(s => (s.id === id ? doc : s))))
      .catch(() => api.styles.list().then(st => setStyles(st || [])).catch(() => {}))   // reconcile on error
  }
  const styleById = (id) => styles.find(s => s.id === id)
  const stylesForUser = (u) => (u?.crossFactory ? styles : styles.filter(s => s.factory === u.factory))

  // ---- sample photos (persisted inside the style's doc) ----
  const photos = Object.fromEntries(styles.map(s => [s.id, s.photos || []]))
  const addPhotos = (id, urls) => { const cur = styleById(id)?.photos || []; updateStyle(id, { photos: [...cur, ...urls] }) }
  const removePhoto = (id, idx) => { const cur = styleById(id)?.photos || []; updateStyle(id, { photos: cur.filter((_, i) => i !== idx) }) }

  // ---- operators ----
  const operatorsFor = (code) => operators.filter(o => o.factory === code)
  const mergeFactory = (factory, list) => setOperators(prev => [...prev.filter(o => o.factory !== factory), ...list])
  const replaceFactoryOperators = async (factory, list) => { const r = await api.operators.replace(factory, list); mergeFactory(factory, r.operators) }
  const appendOperators = async (factory, list) => { const r = await api.operators.append(factory, list); mergeFactory(factory, r.operators) }
  const clearFactoryOperators = async (factory) => { await api.operators.clear(factory); mergeFactory(factory, []) }

  return (
    <StoreCtx.Provider value={{
      user, ready, login, logout,
      allStyles: styles, addStyle, updateStyle, styleById, stylesForUser,
      photos, addPhotos, removePhoto,
      operators, operatorsFor, replaceFactoryOperators, appendOperators, clearFactoryOperators,
    }}>
      {children}
    </StoreCtx.Provider>
  )
}
