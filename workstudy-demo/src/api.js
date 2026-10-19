// API client for the Work Study backend (PostgreSQL-backed, authenticated).
// Set VITE_API_URL to the API server, e.g. http://api-host:4000
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'ws_token'

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {} },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch {} },
}

// notified on 401 so the app can drop to the login screen
let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, { params, body } = {}) {
  const url = new URL(BASE + path)
  if (params) Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, v) })
  const headers = {}
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  if (body != null) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, { method, headers, body: body != null ? JSON.stringify(body) : undefined })
  if (!res.ok) {
    let msg = `API ${res.status}`
    try { msg = (await res.json()).error || msg } catch {}
    // Only treat a 401 on an AUTHENTICATED request as a session expiry (log out).
    // A 401 on login (no token sent) is just a bad password — surface its message.
    if (res.status === 401 && t) { token.clear(); if (onUnauthorized) onUnauthorized() }
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}

const get = (path, params) => request('GET', path, { params })

export const api = {
  base: BASE,
  health: () => get('/api/health'),
  machines: () => get('/api/machines'),
  obOptions: (p) => get('/api/ob-library/options', p),
  obLibrary: (p) => get('/api/ob-library', p),

  auth: {
    login: (username, password) => request('POST', '/api/auth/login', { body: { username, password } }),
    me: () => get('/api/auth/me'),
  },

  styles: {
    list: () => get('/api/styles'),
    get: (id) => get(`/api/styles/${id}`),
    create: (style) => request('POST', '/api/styles', { body: style }),
    patch: (id, patch) => request('PATCH', `/api/styles/${id}`, { body: patch }),
  },

  operators: {
    list: () => get('/api/operators'),
    replace: (factory, operators) => request('PUT', `/api/operators/${factory}`, { body: { operators } }),
    append: (factory, operators) => request('POST', `/api/operators/${factory}`, { body: { operators } }),
    clear: (factory) => request('DELETE', `/api/operators/${factory}`),
  },

  admin: {
    system: () => get('/api/admin/system'),
    meta: () => get('/api/admin/meta'),
    users: () => get('/api/admin/users'),
    createUser: (u) => request('POST', '/api/admin/users', { body: u }),
    updateUser: (id, u) => request('PUT', `/api/admin/users/${id}`, { body: u }),
    deleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
  },
}
