import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { timingSafeEqual } from 'node:crypto'
import { validationResult } from 'express-validator'
import { db } from '../db/connection.js'

async function adminExists() {
  const [rows] = await db.execute(
    "SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'",
  )

  return Number(rows[0]?.adminCount ?? 0) > 0
}

function isSetupEnabled() {
  const setupEnabled = (process.env.SETUP_ENABLED ?? 'true').toLowerCase()
  return Boolean(process.env.SETUP_SECRET) && setupEnabled !== 'false'
}

function setupSecretMatches(secret) {
  const expectedSecret = process.env.SETUP_SECRET ?? ''
  const providedSecret = secret ?? ''

  const expectedBuffer = Buffer.from(expectedSecret)
  const providedBuffer = Buffer.from(providedSecret)

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

function signAdminToken(user) {
  return jwt.sign(
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
}

export async function setupStatusController(_req, res) {
  const setupEnabled = isSetupEnabled()
  const hasAdmin = await adminExists()

  return res.json({
    adminExists: hasAdmin,
    setupEnabled,
  })
}

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

  const token = signAdminToken(user)

  return res.json({ token })
}

export async function bootstrapAdminController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid setup payload', details: errors.array() })
  }

  if (!isSetupEnabled()) {
    return res.status(403).json({ error: 'Admin setup is not enabled' })
  }

  if (await adminExists()) {
    return res.status(409).json({ error: 'Admin user already exists' })
  }

  const { email, password, setupSecret } = req.body

  if (!setupSecretMatches(setupSecret)) {
    return res.status(403).json({ error: 'Invalid setup secret' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(password, 12)

  const [result] = await db.execute(
    'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
    [normalizedEmail, passwordHash, 'admin'],
  )

  const user = {
    id: result.insertId,
    email: normalizedEmail,
    role: 'admin',
  }

  return res.status(201).json({
    token: signAdminToken(user),
  })
}

export async function changePasswordController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid password payload', details: errors.array() })
  }

  const { currentPassword, newPassword } = req.body

  const [rows] = await db.execute(
    'SELECT id, email, password_hash, role FROM users WHERE id = ? LIMIT 1',
    [req.user.id],
  )

  const user = rows[0]
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.password_hash)
  if (!passwordOk) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }

  const nextPasswordHash = await bcrypt.hash(newPassword, 12)

  await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [nextPasswordHash, user.id])

  return res.json({ success: true })
}
