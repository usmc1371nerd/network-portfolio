import nodemailer from 'nodemailer'

function readRequiredEnv(name) {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function getMailerConfig() {
  const host = readRequiredEnv('SMTP_HOST')
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = readRequiredEnv('SMTP_USER')
  const pass = readRequiredEnv('SMTP_PASS')
  const secure = String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true'
  const from = readRequiredEnv('CONTACT_FROM_EMAIL')
  const to = readRequiredEnv('CONTACT_TO_EMAIL')

  if (!host || !user || !pass || !from || !to) {
    return null
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
    to,
  }
}

export async function sendContactEmail({ name, email, message }) {
  const config = getMailerConfig()

  if (!config) {
    const error = new Error('Contact email is not configured on the server.')
    error.status = 503
    throw error
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    replyTo: email,
    subject: `Portfolio contact from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
    `,
  })
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
