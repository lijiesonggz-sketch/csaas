/**
 * Connection Test Script
 * Tests PostgreSQL and Redis connections with 127.0.0.1
 */

const { Client } = require('pg')
const Redis = require('ioredis')

async function testConnections() {
  console.log('🔍 Testing database connections...\n')

  // Test PostgreSQL
  console.log('1️⃣ Testing PostgreSQL...')
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await pgClient.connect()
    const result = await pgClient.query('SELECT version()')
    console.log('✅ PostgreSQL Connected Successfully')
    console.log(`   Version: ${result.rows[0].version.split(',')[0]}\n`)
    await pgClient.end()
  } catch (err) {
    console.error('❌ PostgreSQL Connection Failed:', err.message, '\n')
    process.exit(1)
  }

  // Test Redis
  console.log('2️⃣ Testing Redis...')
  const redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379,
    retryStrategy: () => null, // Don't retry
  })

  try {
    await redisClient.ping()
    const info = await redisClient.info('server')
    const version = info.match(/redis_version:(.*)/)[1]
    console.log('✅ Redis Connected Successfully')
    console.log(`   Version: ${version}\n`)
    redisClient.disconnect()
  } catch (err) {
    console.error('❌ Redis Connection Failed:', err.message, '\n')
    process.exit(1)
  }

  console.log('🎉 All connections successful!\n')
  console.log('Configuration Summary:')
  console.log('  - DB_HOST: 127.0.0.1 (changed from localhost)')
  console.log('  - DB_PORT: 5432')
  console.log('  - REDIS_HOST: 127.0.0.1 (changed from localhost)')
  console.log('  - REDIS_PORT: 6379\n')
}

testConnections().catch(console.error)
