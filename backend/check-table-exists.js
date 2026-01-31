require('dotenv').config({ path: '.env.test' })
const { Client } = require('pg')

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
})

client
  .connect()
  .then(() =>
    client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%compliance%'
      ORDER BY table_name
    `),
  )
  .then((res) => {
    console.log('Compliance-related tables:')
    if (res.rows.length === 0) {
      console.log('  No compliance tables found')
    } else {
      res.rows.forEach((row) => console.log(`  - ${row.table_name}`))
    }
    return client.end()
  })
  .catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
