/**
 * 修复推送记录的组织ID
 * 将推送的组织ID更新为当前用户的组织ID
 */

const { Client } = require('pg')

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'csaas',
})

async function fixPushOrganization() {
  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 用户的组织ID
    const userOrganizationId = '50664c3e-d1a4-4bc5-8b08-2ab48c1b15b9'

    // 查询当前推送的组织ID
    const currentPush = await client.query(`
      SELECT id, "organizationId", "radarType", status
      FROM radar_pushes
      ORDER BY "createdAt" DESC
      LIMIT 1
    `)

    if (currentPush.rows.length === 0) {
      console.log('⚠️  没有找到推送记录')
      return
    }

    const push = currentPush.rows[0]
    console.log('📊 当前推送记录:')
    console.log(`   ID: ${push.id}`)
    console.log(`   组织ID: ${push.organizationId}`)
    console.log(`   雷达类型: ${push.radarType}`)
    console.log(`   状态: ${push.status}\n`)

    if (push.organizationId === userOrganizationId) {
      console.log('✅ 推送的组织ID已经是用户的组织ID，无需修改')
      return
    }

    console.log(`🔧 更新推送的组织ID为: ${userOrganizationId}`)

    // 更新推送的组织ID
    await client.query(`
      UPDATE radar_pushes
      SET "organizationId" = $1, "updatedAt" = NOW()
      WHERE id = $2
    `, [userOrganizationId, push.id])

    console.log('✅ 推送组织ID已更新\n')

    // 验证更新
    const updatedPush = await client.query(`
      SELECT id, "organizationId", "radarType", status
      FROM radar_pushes
      WHERE id = $1
    `, [push.id])

    console.log('📊 更新后的推送记录:')
    console.log(`   ID: ${updatedPush.rows[0].id}`)
    console.log(`   组织ID: ${updatedPush.rows[0].organizationId}`)
    console.log(`   雷达类型: ${updatedPush.rows[0].radarType}`)
    console.log(`   状态: ${updatedPush.rows[0].status}\n`)

    console.log('✅ 修复完成！现在刷新前端页面应该能看到推送了')

  } catch (error) {
    console.error('❌ 错误:', error.message)
  } finally {
    await client.end()
  }
}

fixPushOrganization()
