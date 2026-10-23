// ============================================================
//  Data adapter — everything here is sourced from CONFIG
//  (src/config.js + public/config/config.json). Do not hardcode
//  business data here; change it in the config instead.
// ============================================================
import { CONFIG } from '../config.js'

export const MACHINE_LEGEND = CONFIG.machineLegend
export const OB_LIBRARY = CONFIG.obLibrary
export const OB_FIELDS = CONFIG.fieldOptions
export const CATEGORIES = CONFIG.categories
export const NNVA_LIBRARY = CONFIG.nnvaLibrary || []
export const STEPS = CONFIG.steps
export const USERS = CONFIG.users
export const STYLES = []   // no seeded styles — created at runtime

// RBAC — driven by CONFIG.permissions
export const can = (action, role) => (CONFIG.permissions[action] || []).includes(role)

// a style is laid out on ONE line now (name + shape + machine count)
export const linesOf = (s) => s.layoutLine
  ? [{ no: s.layoutLine.name, shape: s.layoutLine.shape, machines: s.layoutLine.machines }]
  : (s.lines && s.lines.length ? s.lines : (s.line ? [{ no: s.line, shape: s.lineShape }] : []))

export function narrowFor(machine) {
  const cat = CONFIG.machineCategory[machine] || 'lock'
  return CONFIG.narrowing[cat] || CONFIG.narrowing.lock
}

// factories / lines (named lines, each with a shape U/I and a machine count)
export const FACTORIES = CONFIG.factories.map(f => ({ code: f.code, name: f.name }))
export const linesForFactory = (code) => (CONFIG.factories.find(f => f.code === code)?.lines) || []
export const lineCount = (code) => linesForFactory(code).length
export const getFactory = (code) => FACTORIES.find(f => f.code === code)
export const getLine = (code, name) => linesForFactory(code).find(l => l.name === String(name))

// group a factory's lines by shape → pseudo "floors" for boards that expect floor groups
export const floorsForFactory = (code) => {
  const lines = linesForFactory(code)
  return [['U-Shape', 'U'], ['I-Shape', 'I']]
    .map(([name, sh]) => ({ name, lines: lines.filter(l => l.shape === sh).map(l => ({ no: l.name, shape: l.shape, machines: l.machines })) }))
    .filter(g => g.lines.length)
}

// seed operators (generated from config pools)
function genOperators(c) {
  if (!c) return []
  return Array.from({ length: c.count }, (_, i) => ({
    id: 'OP-' + (401 + i),
    name: `${c.firstNames[i % c.firstNames.length]} ${c.lastNames[i % c.lastNames.length]}`,
    grade: c.grades[i % c.grades.length],
    factory: c.factory,
    floor: c.floor,
    line: c.lineStart + (i % c.lineSpan),
    machine: c.machines[i % c.machines.length],
  }))
}
export const OPERATORS = genOperators(CONFIG.operatorSeed)
export const operatorsForFactory = (code) => OPERATORS.filter(o => o.factory === code)
