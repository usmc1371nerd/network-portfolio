import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (typeof payload !== 'object' || payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function optionalAdminAuth(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
    if (typeof payload === 'object' && payload.role === 'admin') {
      return payload
    }

    return null
  } catch {
    return null
  }
}
