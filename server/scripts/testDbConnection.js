import mysql from 'mysql2/promise'

const config = {
  host: process.argv[2] || '31.97.208.96',
  port: process.argv[3] || 3306,
  user: process.argv[4] || 'u256145234_admin',
  password: process.argv[5] || 'Hoover2026',
  database: process.argv[6] || '',
}

async function test() {
  try {
    console.log(`Connecting to ${config.host}:${config.port} as ${config.user}...`)

    const connection = await mysql.createConnection(config)
    console.log('✓ Connected')

    const [result] = await connection.execute('SELECT NOW() AS now_ts, DATABASE() AS db_name')
    console.log('✓ Query successful:', result[0])

    await connection.end()
    console.log('✓ Disconnected')
  } catch (error) {
    console.error('✗ Connection failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

void test()
