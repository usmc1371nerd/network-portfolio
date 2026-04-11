import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import { authRouter } from './routes/auth.js'
import { postsRouter } from './routes/posts.js'
import { db } from './db/connection.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 4000)
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',')

app.set('trust proxy', 1)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin: origins,
    credentials: false,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/debug/db-config', async (req, res) => {
  const setupSecret = process.env.SETUP_SECRET ?? ''
  const providedSecret = req.headers['x-setup-secret']

  if (!setupSecret || providedSecret !== setupSecret) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const [rows] = await db.execute('SELECT 1 AS ok')

    return res.json({
      dbHost: process.env.DB_HOST ?? null,
      dbPort: process.env.DB_PORT ?? null,
      dbUser: process.env.DB_USER ?? null,
      dbName: process.env.DB_NAME ?? null,
      hasPassword: Boolean(process.env.DB_PASSWORD),
      connectionOk: rows[0]?.ok === 1,
    })
  } catch (error) {
    return res.status(500).json({
      dbHost: process.env.DB_HOST ?? null,
      dbPort: process.env.DB_PORT ?? null,
      dbUser: process.env.DB_USER ?? null,
      dbName: process.env.DB_NAME ?? null,
      hasPassword: Boolean(process.env.DB_PASSWORD),
      error: error instanceof Error ? error.message : 'Unknown database error',
    })
  }
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
