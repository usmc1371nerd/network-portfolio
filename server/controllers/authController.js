import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { validationResult } from 'express-validator'
import { db } from '../db/connection.js'

export async function loginController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid login payload', details: errors.array() })
  }

  const { email, password } = req.body

  const [rows] = await db.execute('SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1', [
    email,
  ])

  const user = rows[0]
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash)
  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    },
  )

  return res.json({ token })
}
