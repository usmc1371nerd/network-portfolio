import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { db } from '../db/connection.js'

dotenv.config()

async function main() {
  const rl = readline.createInterface({ input, output })

  try {
    const email = (await rl.question('Admin email: ')).trim().toLowerCase()
    const password = await rl.question('Admin password (min 8 chars): ')

    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing.length > 0) {
      throw new Error('User already exists for that email')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await db.execute('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [
      email,
      passwordHash,
      'admin',
    ])

    console.log('Admin user created successfully.')
  } finally {
    rl.close()
    await db.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
