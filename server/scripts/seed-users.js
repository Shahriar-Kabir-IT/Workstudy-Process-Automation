// Seed factories and the initial user accounts.
// Each user gets a strong random password (unless SEED_PASSWORD is set for all).
// Passwords are written to server/SEED_CREDENTIALS.txt (git-ignored) — hand them
// out securely and rotate after first login.
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { writeFileSync, chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import bcrypt from 'bcryptjs'
import { pool, query } from '../src/db.js'

const here = dirname(fileURLToPath(import.meta.url))

const FACTORIES = [
  { code: 'AGL', name: 'Ananta Garments Ltd' },
  { code: 'AJL', name: 'Ananta Jeanswear Ltd' },
  { code: 'ABM', name: 'Ananta Apparel (ABM)' },
]

// the necessary accounts: a WSE per factory, a central approver, a verifier, and the super admin
const USERS = [
  { username: 'agl.wse',     name: 'Rahim Uddin',       role: 'WSE',              factory: 'AGL', cross: false },
  { username: 'ajl.wse',     name: 'Karim Hossain',     role: 'WSE',              factory: 'AJL', cross: false },
  { username: 'abm.wse',     name: 'Jalal Ahmed',       role: 'WSE',              factory: 'ABM', cross: false },
  { username: 'central.mgr', name: 'Hanif Mahmud',      role: 'ASST_MGR_CENTRAL', factory: 'AGL', cross: true  },
  { username: 'agl.srmgr',   name: 'Noman Chowdhury',   role: 'SR_MGR',           factory: 'AGL', cross: false },
  { username: 'admin',       name: 'Md. Shahriar Kabir',role: 'ADMIN',            factory: 'AGL', cross: true  },
  { username: 'sysadmin',    name: 'System Administrator', role: 'SYSADMIN',      factory: null,  cross: true  },
]

const genPassword = () => randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)

async function main() {
  for (const f of FACTORIES) {
    await query(
      `INSERT INTO factories (code, name) VALUES ($1,$2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`, [f.code, f.name])
  }

  const creds = []
  for (const u of USERS) {
    const password = process.env.SEED_PASSWORD || genPassword()
    const hash = await bcrypt.hash(password, 12)
    await query(
      `INSERT INTO users (username, name, password_hash, role, factory_code, cross_factory)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (username) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role, factory_code = EXCLUDED.factory_code, cross_factory = EXCLUDED.cross_factory`,
      [u.username, u.name, hash, u.role, u.factory, u.cross])
    creds.push({ ...u, password })
    console.log(`  ✓ ${u.username.padEnd(12)} ${u.role.padEnd(18)} ${u.cross ? 'all factories' : u.factory}`)
  }

  const file = join(here, '..', 'SEED_CREDENTIALS.txt')
  const body = [
    'Work Study — initial user credentials',
    'Generated: ' + new Date().toISOString(),
    'ROTATE THESE after first login. Do NOT commit this file.',
    '',
    ...creds.map(c => `${c.username}\t${c.password}\t(${c.role}, ${c.cross ? 'all factories' : c.factory}) — ${c.name}`),
    '',
  ].join('\n')
  writeFileSync(file, body)
  try { chmodSync(file, 0o600) } catch {}
  console.log(`\nCredentials written to ${file} (chmod 600). Hand them out securely.`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
