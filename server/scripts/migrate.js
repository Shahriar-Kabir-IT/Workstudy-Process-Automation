import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

for (const f of files) {
  process.stdout.write(`applying ${f} ... `)
  await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'))
  console.log('ok')
}
await pool.end()
console.log('migrations complete')
