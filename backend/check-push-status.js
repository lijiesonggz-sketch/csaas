/**
 * 检查推送记录状态
 */

const { Client } = require('pg')

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'csaas',
})

async function checkPushStatus() {
  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 查询所有推送记录及其状态
    const result = await client.query(`
      SELECT
        id,
        "organizationId",
        "radarType",
        status,
        "relevanceScore",
        "priorityLevel",
        "scheduledAt",
        "sentAt",
        "createdAt"
      FROM radar_pushes
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)

    console.log('📊 推送记录状态:')
    console.log('='.repeat(100))

    if (result.rows.length === 0) {
      console.log('⚠️  没有找到任何推送记录\n')
    } else {
      result.rows.forEach((push, index) => {
        console.log(`\n${index + 1}. ${push.id.substring(0, 8)}...`)
        console.log(`   雷达类型: ${push.radarType}`)
        console.log(`   状态: ${push.status}`)
        console.log(`   优先级: ${push.priorityLevel}`)
        console.log(`   相关性: ${push.relevanceScore}`)
        console.log(`   计划时间: ${push.scheduledAt}`)
        console.log(`   发送时间: ${push.sentAt || '未发送'}`)
        console.log(`   创建时间: ${push.createdAt}`)
      })
    }

    console.log('\n' + '='.repeat(100))

    // 统计各状态的推送数量
    const stats = await client.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM radar_pushes
      GROUP BY status
      ORDER BY status
    `)

    console.log('\n📈 状态统计:')
    stats.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} 条`)
    })

    console.log('')

  } catch (error) {
    console.error('❌ 错误:', error.message)
  } finally {
    await client.end()
  }
}

checkPushStatus()
