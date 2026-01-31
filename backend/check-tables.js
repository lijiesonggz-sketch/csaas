/**
 * 检查数据库中实际存在的表
 */

const { Client } = require('pg')

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'csaas',
})

async function checkTables() {
  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 查询所有表名
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    console.log('📊 数据库中的表:')
    console.log('='.repeat(60))
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`)
    })
    console.log('='.repeat(60))
    console.log(`\n总共 ${result.rows.length} 个表\n`)

    // 检查是否有雷达相关的表
    const radarTables = result.rows
      .filter(row => row.table_name.toLowerCase().includes('radar') ||
                       row.table_name.toLowerCase().includes('content') ||
                       row.table_name.toLowerCase().includes('push'))

    if (radarTables.length > 0) {
      console.log('🎯 雷达相关表:')
      radarTables.forEach(row => console.log(`   - ${row.table_name}`))
      console.log('')
    }

  } catch (error) {
    console.error('❌ 错误:', error.message)
  } finally {
    await client.end()
  }
}

checkTables()
