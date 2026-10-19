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
export const STEPS = CONFIG.steps
export const USERS = CONFIG.users
export const STYLES = []   // no seeded styles — created at runtime

// RBAC — driven by CONFIG.permissions
export const can = (action, role) => (CONFIG.permissions[action] || []).includes(role)

// a style's assigned lines — supports the new multi-line array and the old single-line fields
export const linesOf = (s) => (s.lines && s.lines.length)
  ? s.lines
  : (s.line ? [{ floor: s.floor, no: s.line, shape: s.lineShape }] : [])

export function narrowFor(machine) {
  const cat = CONFIG.machineCategory[machine] || 'lock'
  return CONFIG.narrowing[cat] || CONFIG.narrowing.lock
}

// factories / floors / lines
export const FACTORIES = CONFIG.factories.map(f => ({ code: f.code, name: f.name }))
export const FLOORS = Object.fromEntries(CONFIG.factories.map(f => [f.code, f.floors]))
export const floorsForFactory = (code) => FLOORS[code] || []
export const lineCount = (code) => floorsForFactory(code).reduce((s, f) => s + f.lines.length, 0)
export const getFactory = (code) => FACTORIES.find(f => f.code === code)

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
