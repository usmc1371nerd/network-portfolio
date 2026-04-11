import bcrypt from 'bcryptjs'

function escapeSql(value) {
  return String(value).replace(/'/g, "''")
}

async function main() {
  const emailArg = process.argv[2]
  const passwordArg = process.argv[3]

  if (!emailArg || !passwordArg) {
    console.error('Usage: node scripts/generateAdminSql.js <email> <password>')
    process.exit(1)
  }

  const email = emailArg.trim().toLowerCase()
  const password = passwordArg

  if (!email.includes('@')) {
    console.error('Invalid email format')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const sql = `INSERT INTO users (email, password_hash, role)
VALUES ('${escapeSql(email)}', '${escapeSql(passwordHash)}', 'admin')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = 'admin';`

  console.log('Copy/paste this SQL into phpMyAdmin (SQL tab):\n')
  console.log(sql)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
