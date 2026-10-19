import { Router } from 'express'
import { query } from '../db.js'

const r = Router()

// GET /api/ob-library/options?category=&productType=&fabricType=
// returns the distinct filter values (cascading) for the dropdowns
r.get('/options', async (req, res, next) => {
  try {
    const { category, productType, fabricType } = req.query
    const where = []
    const params = []
    const add = (col, val) => { if (val) { params.push(val); where.push(`${col} = $${params.length}`) } }
    add('category', category); add('product_type', productType); add('fabric_type', fabricType)
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [cats, prods, fabs, secs] = await Promise.all([
      query(`SELECT DISTINCT category FROM ob_library ORDER BY category`),
      query(`SELECT DISTINCT product_type FROM ob_library ${category ? 'WHERE category=$1' : ''} ORDER BY product_type`, category ? [category] : []),
      query(`SELECT DISTINCT fabric_type FROM ob_library ${w} ORDER BY fabric_type`, params.slice(0, where.length)),
      query(`SELECT DISTINCT section FROM ob_library ${w} ORDER BY section`, params.slice(0, where.length)),
    ])
    res.json({
      categories: cats.rows.map(x => x.category).filter(Boolean),
      productTypes: prods.rows.map(x => x.product_type).filter(Boolean),
      fabricTypes: fabs.rows.map(x => x.fabric_type).filter(Boolean),
      sections: secs.rows.map(x => x.section).filter(Boolean),
    })
  } catch (e) { next(e) }
})

// GET /api/ob-library?category=&productType=&fabricType=&section=&q=&limit=&offset=
r.get('/', async (req, res, next) => {
  try {
    const { category, productType, fabricType, section, q } = req.query
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    const offset = Number(req.query.offset) || 0
    const where = []
    const params = []
    const add = (col, val) => { if (val) { params.push(val); where.push(`${col} = $${params.length}`) } }
    add('category', category); add('product_type', productType)
    add('fabric_type', fabricType); add('section', section)
    if (q) { params.push(`%${q}%`); where.push(`process_name ILIKE $${params.length}`) }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const countRes = await query(`SELECT count(*)::int AS total FROM ob_library ${w}`, params)
    params.push(limit); params.push(offset)
    const rows = await query(
      `SELECT id, category, product_type, fabric_type, section, process_name, machine_type, smv
       FROM ob_library ${w} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    res.json({ total: countRes.rows[0].total, limit, offset, items: rows.rows })
  } catch (e) { next(e) }
})

export default r
