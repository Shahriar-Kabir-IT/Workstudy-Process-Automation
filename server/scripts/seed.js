import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db.js'

const seedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../db/seed')

// minimal RFC-4180 CSV parser (handles quotes, commas, newlines)
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* skip */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
}

async function loadCSV(file, table, cols) {
  const rows = parseCSV(fs.readFileSync(path.join(seedDir, file), 'utf8'))
  rows.shift() // header
  const CHUNK = 1000
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = [], params = []
    chunk.forEach((r, k) => {
      const base = k * cols.length
      values.push('(' + cols.map((_, j) => `$${base + j + 1}`).join(',') + ')')
      cols.forEach((_, j) => params.push(r[j] === '' ? null : r[j]))
    })
    await pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')}`, params)
    inserted += chunk.length
  }
  return inserted
}

await pool.query('TRUNCATE machines, ob_library')
const m = await loadCSV('machines.csv', 'machines', ['code', 'name'])
const o = await loadCSV('ob_library.csv', 'ob_library',
  ['category', 'product_type', 'fabric_type', 'section', 'process_name', 'machine_type', 'smv'])
await pool.query('ANALYZE machines; ANALYZE ob_library')
console.log(`seeded: ${m} machines, ${o} ob_library rows`)
await pool.end()
