import jwt from 'jsonwebtoken'
import { can } from './rbac.js'

const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 16) {
  console.error('[api] FATAL: JWT_SECRET is missing or too short. Set a strong JWT_SECRET in .env (32+ random chars).')
  process.exit(1)
}
const EXPIRES = process.env.JWT_EXPIRES || '8h'

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name, role: user.role, factory: user.factory_code, crossFactory: user.cross_factory },
    SECRET, { expiresIn: EXPIRES },
  )
}

// verify Bearer token → req.user; 401 if missing/invalid
export function authRequired(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'authentication required' })
  try {
    const p = jwt.verify(token, SECRET)
    req.user = { id: p.sub, username: p.username, name: p.name, role: p.role, factory: p.factory, crossFactory: p.crossFactory }
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

// gate a route on an RBAC action — 403 even if the UI is bypassed
export const requireAction = (action) => (req, res, next) =>
  can(action, req.user?.role) ? next() : res.status(403).json({ error: `forbidden: requires '${action}'` })
