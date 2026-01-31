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
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'compliance_checklist_submissions'
      ORDER BY ordinal_position
    `),
  )
  .then((res) => {
    console.log('Columns in compliance_checklist_submissions:')
    res.rows.forEach((row) =>
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`),
    )
    return client.end()
  })
  .catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
