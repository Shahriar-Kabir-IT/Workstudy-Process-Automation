import { Router } from 'express'
import { query } from '../db.js'
import { authRequired, requireAction } from '../auth.js'
import { can } from '../rbac.js'

const r = Router()
r.use(authRequired)

const audit = (actor, action, id) =>
  query('INSERT INTO audit_log(actor, action, entity, entity_id) VALUES ($1,$2,$3,$4)', [actor, action, 'style', String(id)]).catch(() => {})

// a style is visible if the user is cross-factory or it belongs to their factory
const visibleTo = (u, factoryCode) => u.crossFactory || u.factory === factoryCode

// GET /api/styles  — list styles the user may see
r.get('/', async (req, res, next) => {
  try {
    const sql = req.user.crossFactory
      ? 'SELECT doc FROM styles ORDER BY updated_at DESC'
      : 'SELECT doc FROM styles WHERE factory_code = $1 ORDER BY updated_at DESC'
    const { rows } = await query(sql, req.user.crossFactory ? [] : [req.user.factory])
    res.json(rows.map(x => x.doc))
  } catch (e) { next(e) }
})

// GET /api/styles/:id
r.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT factory_code, doc FROM styles WHERE id = $1', [req.params.id])
    if (!rows[0] || !visibleTo(req.user, rows[0].factory_code)) return res.status(404).json({ error: 'not found' })
    res.json(rows[0].doc)
  } catch (e) { next(e) }
})

// POST /api/styles  — create a new order/style  (RBAC: orderCreate)
r.post('/', requireAction('orderCreate'), async (req, res, next) => {
  try {
    const b = req.body || {}
    // a non-cross-factory user can only create in their own factory
    const factory = req.user.crossFactory ? (b.factory || req.user.factory) : req.user.factory
    const { rows } = await query('SELECT gen_random_uuid() AS id')
    const id = rows[0].id
    const doc = {
      ...b, id, factory,
      step: b.step ?? 2, status: b.status || 'Approved Sample',
      sampleApproved: !!b.sampleApproved, obApproved: !!b.obApproved,
      obVersion: b.obVersion || 1, layoutVerified: !!b.layoutVerified,
      ops: b.ops || [], lines: b.lines || [], photos: b.photos || [],
      preparedBy: req.user.name, approvedBy: null, isNew: true,
      createdAt: new Date().toISOString(),
    }
    await query(
      `INSERT INTO styles (id, factory_code, style_no, item, buyer, category, product_type, fabric_type,
         order_qty, manpower, step, status, sample_approved, ob_approved, ob_version, layout_verified,
         prepared_by, updated_by, doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [id, factory, b.styleNo || '', b.item || '', b.buyer || null, b.category || null,
        b.productType || null, b.fabricType || null, Number(b.order) || 0, Number(b.manpower) || 0,
        doc.step, doc.status, doc.sampleApproved, doc.obApproved, doc.obVersion, doc.layoutVerified,
        req.user.name, req.user.name, doc],
    )
    audit(req.user.name, 'style.create', id)
    res.status(201).json(doc)
  } catch (e) { next(e) }
})

// map a patch's keys to the sensitive RBAC action it requires (if any)
function actionFor(patch) {
  if ('ops' in patch) return 'obPrepare'
  if ('lines' in patch) return 'obPrepare'
  if ('photos' in patch) return 'sampleManage'
  if (patch.sampleApproved === true) return 'sampleDecide'
  if (patch.obApproved === true) return 'obApprove'
  if (patch.obApproved === false) return 'obPrepare'          // creating a new OB version
  if (patch.layoutVerified === true) return 'layoutVerify'
  if (patch.changeRequest && ['approved', 'rejected'].includes(patch.changeRequest.status)) return 'changeDecide'
  if (patch.changeRequest && patch.changeRequest.status === 'pending') return 'changeRequest'
  if (patch.obRejected) return 'obReject'
  return null   // non-sensitive (e.g. just editing draft fields)
}

// PATCH /api/styles/:id  — merge a partial patch into the style's doc
r.patch('/:id', async (req, res, next) => {
  try {
    const patch = req.body || {}
    const { rows } = await query('SELECT factory_code, doc FROM styles WHERE id = $1', [req.params.id])
    const row = rows[0]
    if (!row || !visibleTo(req.user, row.factory_code)) return res.status(404).json({ error: 'not found' })

    const need = actionFor(patch)
    if (need && !can(need, req.user.role)) return res.status(403).json({ error: `forbidden: requires '${need}'` })

    // sync queryable core columns when present in the patch
    const sets = ['doc = doc || $2::jsonb', 'updated_by = $3']
    const params = [req.params.id, JSON.stringify(patch), req.user.name]
    const col = (name, val) => { params.push(val); sets.push(`${name} = $${params.length}`) }
    if ('step' in patch) col('step', patch.step)
    if ('status' in patch) col('status', patch.status)
    if ('sampleApproved' in patch) col('sample_approved', patch.sampleApproved)
    if ('obApproved' in patch) col('ob_approved', patch.obApproved)
    if ('obVersion' in patch) col('ob_version', patch.obVersion)
    if ('layoutVerified' in patch) col('layout_verified', patch.layoutVerified)
    if ('approvedBy' in patch) col('approved_by', patch.approvedBy)

    const upd = await query(`UPDATE styles SET ${sets.join(', ')} WHERE id = $1 RETURNING doc`, params)
    audit(req.user.name, `style.patch:${need || 'edit'}`, req.params.id)
    res.json(upd.rows[0].doc)
  } catch (e) { next(e) }
})

export default r
