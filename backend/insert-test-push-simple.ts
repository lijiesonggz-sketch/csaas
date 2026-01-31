/**
 * 简化版插入测试推送数据的脚本 v2
 * 使用原生SQL，移除ON CONFLICT
 *
 * 使用方法:
 * npx ts-node insert-test-push-simple.ts
 */

import { DataSource } from 'typeorm'

async function insertTestData() {
  console.log('🔧 准备插入测试推送数据...\n')

  // 创建数据库连接（使用后端的配置）
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
    synchronize: false,
  })

  try {
    // 连接数据库
    await AppDataSource.initialize()
    console.log('✅ 数据库连接成功\n')

    const queryRunner = AppDataSource.createQueryRunner()

    try {
      // 使用事务确保数据一致性
      await queryRunner.startTransaction()

      // 1. 检查并插入 raw_contents
      console.log('📝 插入测试原始内容...')
      let rawContentId

      const existingRaw = await queryRunner.query(`
        SELECT id FROM raw_contents WHERE url = $1 LIMIT 1
      `, ['https://example.com/test-tech-article'])

      if (existingRaw.length > 0) {
        rawContentId = existingRaw[0].id
        console.log(`ℹ️  原始内容已存在 (ID: ${rawContentId})`)
      } else {
        // 生成contentHash（SHA-256的模拟，这里简化为固定值）
        const contentHash = 'test-websocket-article-hash-' + Date.now()

        const rawContentResult = await queryRunner.query(`
          INSERT INTO raw_contents (
            url, title, summary, "fullContent", source, category,
            "contentHash", "publishDate", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          'https://example.com/test-tech-article',
          '测试技术文章: WebSocket实时推送最佳实践',
          '本文介绍如何在项目中使用WebSocket实现实时推送功能，包括连接管理、错误处理和重连机制。',
          '本文介绍如何在项目中使用WebSocket实现实时推送功能。WebSocket是一种全双工通信协议，可以在单个TCP连接上进行全双工通信。本文将详细介绍WebSocket的连接管理、错误处理机制、以及重连策略。通过本文，你将学会如何在项目中实现稳定可靠的实时推送功能。',
          '测试来源',
          'tech', // category: tech | industry | compliance
          contentHash,
          new Date(),
          new Date(),
          new Date(),
        ])
        rawContentId = rawContentResult[0].id
        console.log(`✅ 原始内容创建成功 (ID: ${rawContentId})`)
      }

      // 2. 检查并插入 analyzed_contents
      console.log('\n📝 插入测试分析内容...')
      let analyzedContentId

      const existingAnalyzed = await queryRunner.query(`
        SELECT id FROM analyzed_contents WHERE "contentId" = $1 LIMIT 1
      `, [rawContentId])

      if (existingAnalyzed.length > 0) {
        analyzedContentId = existingAnalyzed[0].id
        console.log(`ℹ️  分析内容已存在 (ID: ${analyzedContentId})`)
      } else {
        const analyzedContentResult = await queryRunner.query(`
          INSERT INTO analyzed_contents (
            "contentId", "aiSummary", categories, keywords,
            "targetAudience", "aiModel", "tokensUsed", status, "analyzedAt", "createdAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          rawContentId,
          '这是一篇关于WebSocket最佳实践的技术文章，适合需要实现实时功能的项目参考。',
          JSON.stringify(['技术架构']), // categories: jsonb
          JSON.stringify(['WebSocket', '实时通信', '前端开发', '推送']), // keywords: jsonb
          '技术团队',
          'test-model',
          1000,
          'success',
          new Date(),
          new Date(),
        ])
        analyzedContentId = analyzedContentResult[0].id
        console.log(`✅ 分析内容创建成功 (ID: ${analyzedContentId})`)
      }

      // 3. 获取一个有效的组织ID
      console.log('\n📝 查找有效的组织ID...')
      const orgs = await queryRunner.query(`
        SELECT id FROM organizations LIMIT 1
      `)

      let organizationId
      if (orgs.length > 0) {
        organizationId = orgs[0].id
        console.log(`✅ 找到组织ID: ${organizationId}`)
      } else {
        // 如果没有组织，创建一个测试组织
        console.log('⚠️  没有找到组织，创建测试组织...')
        const orgResult = await queryRunner.query(`
          INSERT INTO organizations (name, "industrySector", "organizationSize", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, ['测试组织', 'bank', 'medium', new Date(), new Date()])
        organizationId = orgResult[0].id
        console.log(`✅ 测试组织创建成功 (ID: ${organizationId})`)
      }

      // 4. 检查并插入 radar_pushes
      console.log('\n📝 插入测试推送记录...')
      let radarPushId

      const existingPush = await queryRunner.query(`
        SELECT id FROM radar_pushes
        WHERE "contentId" = $1 AND "radarType" = 'tech'
        LIMIT 1
      `, [analyzedContentId])

      if (existingPush.length > 0) {
        radarPushId = existingPush[0].id
        // 更新为scheduled状态
        await queryRunner.query(`
          UPDATE radar_pushes
          SET status = 'scheduled', "scheduledAt" = $1, "updatedAt" = $2
          WHERE id = $3
        `, [new Date(), new Date(), radarPushId])
        console.log(`ℹ️  推送记录已存在，更新为scheduled状态 (ID: ${radarPushId})`)
      } else {
        const radarPushResult = await queryRunner.query(`
          INSERT INTO radar_pushes (
            "organizationId", "contentId", "radarType", status,
            "relevanceScore", "priorityLevel", "scheduledAt", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          organizationId, // 使用实际的数据库组织ID
          analyzedContentId,
          'tech',
          'scheduled',
          0.95,
          'high',
          new Date(),
          new Date(),
          new Date(),
        ])
        radarPushId = radarPushResult[0].id
        console.log(`✅ 推送记录创建成功 (ID: ${radarPushId})`)
      }

      // 提交事务
      await queryRunner.commitTransaction()
      console.log('\n✅ 事务提交成功')

      // 4. 查询待推送的记录
      console.log('\n📊 查询待推送的记录:')
      const pendingPushes = await queryRunner.query(`
        SELECT
          id,
          "organizationId",
          "radarType",
          status,
          "relevanceScore",
          "priorityLevel",
          "scheduledAt"
        FROM radar_pushes
        WHERE status = 'scheduled' AND "radarType" = 'tech'
        ORDER BY "scheduledAt" DESC
        LIMIT 10
      `)

      if (pendingPushes.length === 0) {
        console.log('⚠️  没有找到待推送的记录')
      } else {
        console.log(`找到 ${pendingPushes.length} 条待推送记录:\n`)
        pendingPushes.forEach((push: any, index: number) => {
          console.log(`${index + 1}. ${push.id}`)
          console.log(`   组织: ${push.organizationId}`)
          console.log(`   类型: ${push.radarType}`)
          console.log(`   状态: ${push.status}`)
          console.log(`   优先级: ${push.priorityLevel}`)
          console.log(`   相关性: ${push.relevanceScore}`)
          console.log(`   计划时间: ${push.scheduledAt}\n`)
        })
      }

      console.log('✅ 测试数据插入完成!')
      console.log('\n💡 下一步:')
      console.log('   运行: npx ts-node trigger-push.ts')
      console.log('   来触发推送任务\n')

    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }

  } catch (error) {
    console.error('❌ 错误:', error)
    process.exit(1)
  } finally {
    await AppDataSource.destroy()
  }
}

// 运行脚本
insertTestData()
