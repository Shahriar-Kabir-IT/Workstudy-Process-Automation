import { Router } from 'express'
import os from 'node:os'
import { execSync } from 'node:child_process'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { authRequired, requireAction } from '../auth.js'
import { ROLES, ROLE_META } from '../rbac.js'

const r = Router()
r.use(authRequired)

const mb = (bytes) => Math.round(bytes / 1024 / 1024)
const gb = (bytes) => +(bytes / 1024 / 1024 / 1024).toFixed(1)

function diskUsage() {
  try {
    const out = execSync('df -kP .', { encoding: 'utf8' }).trim().split('\n')
    const cols = out[out.length - 1].split(/\s+/)
    const totalKb = Number(cols[1]), usedKb = Number(cols[2])
    return { usedGb: +(usedKb / 1024 / 1024).toFixed(0), totalGb: +(totalKb / 1024 / 1024).toFixed(0), pct: Math.round((usedKb / totalKb) * 100) }
  } catch { return { usedGb: null, totalGb: null, pct: null } }
}

function connInfo() {
  try {
    const u = new URL(process.env.DATABASE_URL)
    return { host: u.hostname, port: u.port || '5432', database: (u.pathname || '/').slice(1) }
  } catch { return { host: 'localhost', port: '5432', database: 'workstudy' } }
}

// GET /api/admin/system — live server + database health
r.get('/system', requireAction('systemAdmin'), async (_req, res, next) => {
  try {
    const t0 = Date.now()
    await query('SELECT 1')
    const dbLatency = Date.now() - t0

    const [ver, dbinfo, conns, cache] = await Promise.all([
      query('SELECT version() AS v, current_setting($1) AS sv', ['server_version']),
      query('SELECT current_database() AS db, pg_database_size(current_database()) AS size'),
      query(`SELECT
                (SELECT count(*) FROM pg_stat_activity) AS total,
                (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max,
                (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active`),
      query(`SELECT round(sum(blks_hit)*100.0 / nullif(sum(blks_hit)+sum(blks_read),0), 2) AS ratio FROM pg_stat_database`),
    ])

    const memNode = process.memoryUsage()
    const info = connInfo()
    res.json({
      overview: {
        status: 'OK',
        dbLatencyMs: dbLatency,
        uptimeSec: Math.round(process.uptime()),
        heapMb: mb(memNode.heapUsed),
        db: `PostgreSQL / ${dbinfo.rows[0].db}`,
        node: process.version,
        lastCheck: new Date().toISOString(),
      },
      server: {
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        cpu: os.cpus()[0]?.model || 'unknown',
        cores: os.cpus().length,
        loadAvg: os.loadavg().map(x => +x.toFixed(2)),
        ramUsedGb: gb(os.totalmem() - os.freemem()),
        ramTotalGb: gb(os.totalmem()),
        ramPct: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        disk: diskUsage(),
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        pid: process.pid,
        rssMb: mb(memNode.rss),
        heapUsedMb: mb(memNode.heapUsed),
        heapTotalMb: mb(memNode.heapTotal),
      },
      database: {
        sizeMb: mb(Number(dbinfo.rows[0].size)),
        connections: Number(conns.rows[0].total),
        maxConnections: Number(conns.rows[0].max),
        activeQueries: Number(conns.rows[0].active),
        cacheHitRatio: cache.rows[0].ratio != null ? Number(cache.rows[0].ratio) : null,
        version: ver.rows[0].v,
        serverVersion: ver.rows[0].sv,
        ...info,
      },
    })
  } catch (e) { next(e) }
})

// GET /api/admin/meta — roles + factories for the user forms
r.get('/meta', requireAction('userManage'), async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT code, name FROM factories ORDER BY code')
    res.json({ roles: ROLES.map(code => ({ code, label: ROLE_META[code]?.label || code })), factories: rows })
  } catch (e) { next(e) }
})

const publicUser = (u) => ({
  id: u.id, name: u.name, username: u.username, role: u.role,
  roleLabel: ROLE_META[u.role]?.label || u.role,
  factory: u.factory_code, crossFactory: u.cross_factory,
  lines: u.lines, active: u.active, email: u.email, createdAt: u.created_at,
})

// GET /api/admin/users
r.get('/users', requireAction('userManage'), async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC, name')
    res.json(rows.map(publicUser))
  } catch (e) { next(e) }
})

// POST /api/admin/users — create
r.post('/users', requireAction('userManage'), async (req, res, next) => {
  try {
    const b = req.body || {}
    if (!b.username || !b.password || !b.role) return res.status(400).json({ error: 'username, password and role are required' })
    if (!ROLES.includes(b.role)) return res.status(400).json({ error: `unknown role '${b.role}'` })
    const hash = await bcrypt.hash(b.password, 12)
    const { rows } = await query(
      `INSERT INTO users (username, name, password_hash, role, factory_code, cross_factory, lines, email, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [String(b.username).trim(), b.name || b.username, hash, b.role, b.factory || null,
        !!b.crossFactory, b.lines || null, b.email || null, b.active !== false])
    await query('INSERT INTO audit_log(actor, action, entity, entity_id) VALUES ($1,$2,$3,$4)', [req.user.name, 'user.create', 'user', rows[0].id])
    res.status(201).json(publicUser(rows[0]))
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'username already exists' })
    next(e)
  }
})

// PUT /api/admin/users/:id — update (password optional)
r.put('/users/:id', requireAction('userManage'), async (req, res, next) => {
  try {
    const b = req.body || {}
    if (b.role && !ROLES.includes(b.role)) return res.status(400).json({ error: `unknown role '${b.role}'` })
    const sets = [], params = []
    const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`) }
    if ('name' in b) set('name', b.name)
    if ('username' in b) set('username', String(b.username).trim())
    if ('role' in b) set('role', b.role)
    if ('factory' in b) set('factory_code', b.factory || null)
    if ('crossFactory' in b) set('cross_factory', !!b.crossFactory)
    if ('lines' in b) set('lines', b.lines || null)
    if ('email' in b) set('email', b.email || null)
    if ('active' in b) set('active', !!b.active)
    if (b.password) set('password_hash', await bcrypt.hash(b.password, 12))
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
    params.push(req.params.id)
    const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    if (!rows[0]) return res.status(404).json({ error: 'user not found' })
    await query('INSERT INTO audit_log(actor, action, entity, entity_id) VALUES ($1,$2,$3,$4)', [req.user.name, 'user.update', 'user', req.params.id])
    res.json(publicUser(rows[0]))
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'username already exists' })
    next(e)
  }
})

// DELETE /api/admin/users/:id
r.delete('/users/:id', requireAction('userManage'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'you cannot delete your own account' })
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'user not found' })
    await query('INSERT INTO audit_log(actor, action, entity, entity_id) VALUES ($1,$2,$3,$4)', [req.user.name, 'user.delete', 'user', req.params.id])
    res.status(204).end()
  } catch (e) { next(e) }
})

export default r
