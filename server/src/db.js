import pg from 'pg'

// Connection pool. In production set DATABASE_URL to the DB server, e.g.
//   postgresql://user:pass@db-host:5432/workstudy?sslmode=require
const connectionString = process.env.DATABASE_URL

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (err) => {
  console.error('[pg] idle client error', err.message)
})

export const query = (text, params) => pool.query(text, params)
