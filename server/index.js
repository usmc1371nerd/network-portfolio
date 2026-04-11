import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './routes/auth.js'
import { postsRouter } from './routes/posts.js'
import { db } from './db/connection.js'
import { loadEnv } from './config/loadEnv.js'

loadEnv()

const app = express()
const port = Number(process.env.PORT ?? 4000)
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) {
    return true
  }

  const normalizedOrigin = origin.replace(/\/$/, '')
  return origins.includes(normalizedOrigin)
}

app.set('trust proxy', 1)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true)
      }

      return callback(new Error('CORS blocked for origin'))
    },
    credentials: false,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await db.execute('SELECT 1 AS ok')
    return res.json({ ok: true, db: true })
  } catch (error) {
    console.error('Health check DB failure:', error)
    return res.status(503).json({ ok: false, db: false, error: 'Database unavailable' })
  }
})

app.get('/api/debug/db-config', async (req, res) => {
  const setupSecret = process.env.SETUP_SECRET ?? ''
  const providedSecret = req.headers['x-setup-secret']

  if (!setupSecret || providedSecret !== setupSecret) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let connectionOk = false
  let connectionError = null
  try {
    const [rows] = await db.execute('SELECT 1 AS ok')
    connectionOk = rows[0]?.ok === 1
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Unknown database error'
  }

  // Always return 200 so Hostinger's proxy does not strip the response body
  return res.json({
    dbHost: process.env.DB_HOST ?? null,
    dbPort: process.env.DB_PORT ?? null,
    dbUser: process.env.DB_USER ?? null,
    dbName: process.env.DB_NAME ?? null,
    hasPassword: Boolean(process.env.DB_PASSWORD),
    setupEnabled: process.env.SETUP_ENABLED ?? null,
    hasSetupSecret: Boolean(process.env.SETUP_SECRET),
    connectionOk,
    connectionError,
  })
})

app.use('/api', authRouter)
app.use('/api', postsRouter)

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
