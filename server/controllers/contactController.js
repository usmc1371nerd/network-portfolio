import { validationResult } from 'express-validator'
import { sendContactEmail } from '../services/mailer.js'

export async function sendContactMessageController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid contact form payload', details: errors.array() })
  }

  const name = req.body.name.trim()
  const email = req.body.email.trim().toLowerCase()
  const message = req.body.message.trim()

  try {
    await sendContactEmail({ name, email, message })
    return res.status(201).json({ success: true })
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Unable to send contact message.',
    })
  }
}
