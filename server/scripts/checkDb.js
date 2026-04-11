import { db } from '../db/connection.js'
import { loadEnv } from '../config/loadEnv.js'

loadEnv()

async function run() {
  try {
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
    const missingVars = requiredVars.filter((name) => !process.env[name])
    if (missingVars.length > 0) {
      throw new Error(`Missing required env vars: ${missingVars.join(', ')}`)
    }

    const [rows] = await db.execute('SELECT 1 AS ok')
    if (!rows?.length || rows[0].ok !== 1) {
      throw new Error('Unexpected database response')
    }

    const [postColumns] = await db.execute('SHOW COLUMNS FROM posts LIKE "published_at"')
    const hasPublishedAt = Array.isArray(postColumns) && postColumns.length > 0

    if (!hasPublishedAt) {
      throw new Error('posts.published_at column is missing')
    }

    console.log('Database check passed')
    process.exit(0)
  } catch (error) {
    console.error('Database check failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

void run()