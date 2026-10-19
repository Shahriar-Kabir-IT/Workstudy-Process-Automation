import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { pool, query } from './db.js'
import obLibrary from './routes/obLibrary.js'
import auth from './routes/auth.js'
import styles from './routes/styles.js'
import operators from './routes/operators.js'
import admin from './routes/admin.js'

const app = express()
const PORT = Number(process.env.API_PORT || 4000)

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '2mb' }))
// CORS_ORIGIN: unset or "*" → reflect any origin; otherwise a comma-separated whitelist.
const corsOrigin = !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*'
  ? true
  : process.env.CORS_ORIGIN.split(',').map(s => s.trim())
app.use(cors({ origin: corsOrigin }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// health / readiness
app.get('/api/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, db: 'up', ts: new Date().toISOString() }) }
  catch { res.status(503).json({ ok: false, db: 'down' }) }
})

// reference data
app.get('/api/machines', async (_req, res, next) => {
  try { const { rows } = await query('SELECT code, name FROM machines ORDER BY code'); res.json(rows) }
  catch (e) { next(e) }
})

app.use('/api/ob-library', obLibrary)
app.use('/api/auth', auth)
app.use('/api/styles', styles)
app.use('/api/operators', operators)
app.use('/api/admin', admin)

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: 'not found' }))
app.use((err, _req, res, _next) => {
  console.error('[api] error', err)
  res.status(500).json({ error: 'internal error' })
})

const server = app.listen(PORT, () => console.log(`[api] listening on :${PORT}`))

// graceful shutdown
const shutdown = async (sig) => {
  console.log(`[api] ${sig} — shutting down`)
  server.close(async () => { await pool.end(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
