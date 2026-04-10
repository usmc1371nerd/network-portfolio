import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { authRouter } from './routes/auth.js'
import { postsRouter } from './routes/posts.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 4000)
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',')

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

app.use('/api', authRouter)
app.use('/api', postsRouter)

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
