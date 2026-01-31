const { Client } = require('pg')

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'csaas'
})

client.connect()
  .then(() => {
    console.log('Connected to database')
    return client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'radar_sources'
      ORDER BY ordinal_position
    `)
  })
  .then(res => {
    console.log('\nradar_sources table columns:')
    res.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`)
    })
    return client.query('SELECT * FROM radar_sources LIMIT 1')
  })
  .then(res => {
    console.log('\nSample row:')
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2))
    } else {
      console.log('  (no data)')
    }
    client.end()
  })
  .catch(err => {
    console.error('Error:', err.message)
    client.end()
    process.exit(1)
  })
