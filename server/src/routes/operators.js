import { Router } from 'express'
import { query } from '../db.js'
import { authRequired, requireAction } from '../auth.js'

const r = Router()
r.use(authRequired)

const mapRow = (o) => ({
  id: o.op_code || o.id, name: o.name, grade: o.grade,
  factory: o.factory_code, floor: o.floor,
  line: o.line_no, machine: o.machine,
})

const allowedFactory = (u, code) => u.crossFactory || u.factory === code

// GET /api/operators — operators visible to the user
r.get('/', async (req, res, next) => {
  try {
    const sql = req.user.crossFactory
      ? 'SELECT * FROM operators ORDER BY factory_code, line_no, name'
      : 'SELECT * FROM operators WHERE factory_code = $1 ORDER BY line_no, name'
    const { rows } = await query(sql, req.user.crossFactory ? [] : [req.user.factory])
    res.json(rows.map(mapRow))
  } catch (e) { next(e) }
})

async function insertOperators(factory, list) {
  const clean = (list || []).filter(o => o && o.name)
  for (const o of clean) {
    await query(
      `INSERT INTO operators (factory_code, op_code, name, grade, floor, line_no, machine)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [factory, o.id || null, o.name, o.grade || null, o.floor || null,
        Number.isFinite(Number(o.line)) && o.line !== '' ? Number(o.line) : null, o.machine || null],
    )
  }
  return clean.length
}

// PUT /api/operators/:factory — replace that factory's operators
r.put('/:factory', requireAction('operatorManage'), async (req, res, next) => {
  const factory = req.params.factory
  if (!allowedFactory(req.user, factory)) return res.status(403).json({ error: 'forbidden for this factory' })
  const client = await (await import('../db.js')).pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM operators WHERE factory_code = $1', [factory])
    await client.query('COMMIT')
    const n = await insertOperators(factory, req.body?.operators)
    const { rows } = await query('SELECT * FROM operators WHERE factory_code = $1 ORDER BY line_no, name', [factory])
    res.json({ factory, count: n, operators: rows.map(mapRow) })
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e) }
  finally { client.release() }
})

// POST /api/operators/:factory — append to that factory's operators
r.post('/:factory', requireAction('operatorManage'), async (req, res, next) => {
  const factory = req.params.factory
  if (!allowedFactory(req.user, factory)) return res.status(403).json({ error: 'forbidden for this factory' })
  try {
    const n = await insertOperators(factory, req.body?.operators)
    const { rows } = await query('SELECT * FROM operators WHERE factory_code = $1 ORDER BY line_no, name', [factory])
    res.json({ factory, count: n, operators: rows.map(mapRow) })
  } catch (e) { next(e) }
})

// DELETE /api/operators/:factory — clear that factory's operators
r.delete('/:factory', requireAction('operatorManage'), async (req, res, next) => {
  const factory = req.params.factory
  if (!allowedFactory(req.user, factory)) return res.status(403).json({ error: 'forbidden for this factory' })
  try {
    await query('DELETE FROM operators WHERE factory_code = $1', [factory])
    res.json({ factory, count: 0, operators: [] })
  } catch (e) { next(e) }
})

export default r
