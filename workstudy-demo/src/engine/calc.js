// ============================================================
//  Work Study calculation engine
//  Formulas derived from the Ananta Excel templates.
//  NOTE: Standard working hour = 60 min for OB & Layout.
//        Skill Matrix & Efficiency use an EFFECTIVE hour of
//        51 min (85%) — per factory practice.
// ============================================================

import { CONFIG } from '../config.js'

export const MIN_PER_HOUR = CONFIG.engine.minutesPerHour              // OB / Layout / Cycle-time
export const MATRIX_MIN_PER_HOUR = CONFIG.engine.matrixMinutesPerHour // Skill matrix & efficiency only
const UCL_F = CONFIG.engine.uclFactor, LCL_F = CONFIG.engine.lclFactor

const safe = (n) => (isFinite(n) && !isNaN(n) ? n : 0)
export const round = (n, d = 2) => {
  const f = Math.pow(10, d)
  return safe(Math.round(n * f) / f)
}

// ---- totals ----
export const totalSMV = (ops) => round(ops.reduce((s, o) => s + (o.smv || 0), 0), 2)
export const machineSMV = (ops) => round(ops.filter(o => !o.manual).reduce((s, o) => s + (o.smv || 0), 0), 2)
export const manualSMV = (ops) => round(ops.filter(o => o.manual).reduce((s, o) => s + (o.smv || 0), 0), 2)

// ---- OB-level ----
export const pitchTime = (tSMV, manpower) => safe(tSMV / manpower)          // min/piece per station
export const tml = (smv, pitch) => round(safe(smv / pitch), 2)             // theoretical machines
export const targetPerHour = (smv, aml = 1) => Math.floor(safe((MIN_PER_HOUR / smv) * aml)) // pcs/hr

// ---- Line targets ----
export const lineTargetPerHour = (manpower, tSMV, eff = 1) =>
  Math.floor(safe((manpower * MIN_PER_HOUR) / tSMV) * eff)
export const targetPerDay = (perHour, hours = 10) => Math.round(perHour * hours)

// ---- Layout / station ----
export const stationCapacity = (smv, machines = 1) => Math.floor(safe((MIN_PER_HOUR / smv) * machines))

// ---- Cycle time ----
export const bpt = (totalObservedMin, stations) => round(safe(totalObservedMin / stations), 4)
export const ucl = (b) => round(b * UCL_F, 4)
export const lcl = (b) => round(b * LCL_F, 4)
export const workerPotentialPerHour = (b) => Math.floor(safe(MIN_PER_HOUR / b))
export const workerPotentialPer10 = (b) => workerPotentialPerHour(b) * 10
export const workerPerformance = (current, potential) => round(safe(current / potential) * 100, 1) // %
export const productivityGap = (current, potential) => round((1 - safe(current / potential)) * 100, 1) // %

// ---- Skill Matrix & Efficiency  (uses 51-min effective hour) ----
export const matrixCapacity = (smv, machines = 1) =>
  Math.floor(safe((MATRIX_MIN_PER_HOUR / smv) * machines))  // realistic pcs/hr at 85% hour
// operator efficiency % on a process:  earned minutes / available minutes
// available minutes per hour = 51 (effective)
export const operatorEfficiency = (outputPerHour, smv) =>
  round(safe((outputPerHour * smv) / MATRIX_MIN_PER_HOUR) * 100, 0)
// line efficiency over a shift using the 51-min effective hour
export const lineEfficiency = (output, smv, manpower, hours) =>
  round(safe((output * smv) / (manpower * MATRIX_MIN_PER_HOUR * hours)) * 100, 1)

// grade from efficiency
export const gradeFromEff = (eff) =>
  eff >= 90 ? 'A+' : eff >= 80 ? 'A' : eff >= 70 ? 'B' : eff >= 55 ? 'C' : 'D'

// ---- derived OB table rows ----
export function computeOB(ops, manpower) {
  const tSMV = totalSMV(ops)
  const pt = pitchTime(tSMV, manpower)
  const rows = ops.map(o => ({
    ...o,
    tml: tml(o.smv, pt),
    target: targetPerHour(o.smv, o.aml || 1),
  }))
  return {
    rows,
    totalSMV: tSMV,
    machineSMV: machineSMV(ops),
    manualSMV: manualSMV(ops),
    pitchTime: round(pt, 3),
    target100: lineTargetPerHour(manpower, tSMV, 1),
    target80: lineTargetPerHour(manpower, tSMV, 0.8),
    perDay80: targetPerDay(lineTargetPerHour(manpower, tSMV, 0.8)),
  }
}
