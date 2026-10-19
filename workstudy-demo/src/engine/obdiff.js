// OB version history + diff between two OB versions.

// Append the current OB as an approved version snapshot (immutable copy).
export const appendVersion = (style, by) => ([
  ...(style.obHistory || []),
  {
    version: style.obVersion || 1,
    ops: (style.ops || []).map(o => ({ ...o })),
    approvedBy: by,
    approvedAt: new Date().toISOString(),
  },
])

// The operations of the most recently approved version (for diffing a new version against).
export const prevApprovedOps = (style) => {
  const h = style.obHistory || []
  return h.length ? h[h.length - 1].ops : null
}

const key = (o) => (o.name || '').trim().toLowerCase()
const num = (v) => (v == null || v === '' ? 0 : Number(v))

// Compare two OB operation lists → added / removed / changed.
export function diffOps(prev = [], next = []) {
  const pm = new Map((prev || []).map(o => [key(o), o]))
  const nm = new Map((next || []).map(o => [key(o), o]))
  const added = [], removed = [], changed = []
  for (const o of next || []) if (!pm.has(key(o))) added.push(o)
  for (const o of prev || []) if (!nm.has(key(o))) removed.push(o)
  for (const o of next || []) {
    const p = pm.get(key(o))
    if (!p) continue
    const fields = []
    if (num(p.smv) !== num(o.smv)) fields.push({ k: 'SMV', from: num(p.smv).toFixed(2), to: num(o.smv).toFixed(2) })
    if ((p.machine || '') !== (o.machine || '')) fields.push({ k: 'Machine', from: p.machine || '—', to: o.machine || '—' })
    if (num(p.aml || 1) !== num(o.aml || 1)) fields.push({ k: 'AML', from: p.aml || 1, to: o.aml || 1 })
    if (fields.length) changed.push({ name: o.name, fields })
  }
  const same = (next || []).length - added.length - changed.length
  return { added, removed, changed, same, hasChanges: !!(added.length || removed.length || changed.length) }
}
