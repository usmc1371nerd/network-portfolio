import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

let initialized = false

export function loadEnv() {
  if (initialized) {
    return
  }

  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(currentFilePath)
  const serverDir = path.resolve(currentDir, '..')

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(process.cwd(), 'server/.env.hostinger'),
    path.resolve(serverDir, '.env'),
    path.resolve(serverDir, '.env.hostinger'),
  ]

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) {
      continue
    }

    dotenv.config({ path: envPath, override: false })
    initialized = true
    return
  }

  dotenv.config()
  initialized = true
}