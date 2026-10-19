import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { signToken, authRequired } from '../auth.js'
import { ROLE_META } from '../rbac.js'

const r = Router()

const initials = (name) => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U'

// shape the user object the frontend expects
const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, role: u.role,
  factory: u.factory_code, crossFactory: u.cross_factory,
  roleLabel: ROLE_META[u.role]?.label || u.role,
  color: ROLE_META[u.role]?.color || '#2563eb',
  initials: initials(u.name),
})

// POST /api/auth/login  { username, password } -> { token, user }
r.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
    const { rows } = await query('SELECT * FROM users WHERE lower(username) = lower($1)', [String(username).trim()])
    const u = rows[0]
    // constant-ish time: always run a compare
    const ok = u ? await bcrypt.compare(password, u.password_hash) : await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000')
    if (!u || !ok) return res.status(401).json({ error: 'invalid username or password' })
    if (u.active === false) return res.status(403).json({ error: 'this account is disabled' })
    await query('INSERT INTO audit_log(actor, action, entity, entity_id) VALUES ($1,$2,$3,$4)', [u.username, 'login', 'user', u.id])
    res.json({ token: signToken(u), user: publicUser(u) })
  } catch (e) { next(e) }
})

// GET /api/auth/me  (restore session from a stored token)
r.get('/me', authRequired, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id])
    if (!rows[0]) return res.status(401).json({ error: 'user no longer exists' })
    res.json({ user: publicUser(rows[0]) })
  } catch (e) { next(e) }
})

export default r
