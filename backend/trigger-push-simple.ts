/**
 * 手动触发雷达推送任务的脚本（简化版）
 *
 * 使用方法:
 * npx ts-node trigger-push-simple.ts
 */

import { Queue } from 'bullmq'

// 连接到Redis的推送队列
const PUSH_QUEUE_NAME = 'radar-push'
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

async function triggerPush() {
  console.log('🚀 手动触发雷达推送任务\n')

  // 创建队列实例
  const pushQueue = new Queue(PUSH_QUEUE_NAME, {
    connection: REDIS_CONFIG,
  })

  try {
    // 查询当前队列状态
    const waiting = await pushQueue.getWaiting()
    const active = await pushQueue.getActive()
    const delayed = await pushQueue.getDelayed()

    console.log('📊 队列状态:')
    console.log(`   - 等待中: ${waiting.length}`)
    console.log(`   - 进行中: ${active.length}`)
    console.log(`   - 延迟: ${delayed.length}\n`)

    // 添加技术雷达推送任务
    console.log('📤 添加技术雷达推送任务...')
    const techJob = await pushQueue.add(
      'push-tech',
      { radarType: 'tech' },
      {
        jobId: `tech-push-${Date.now()}`, // 唯一任务ID
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 300000, // 5分钟后重试
        },
      }
    )

    console.log('✅ 技术雷达推送任务已添加:')
    console.log(`   - Job ID: ${techJob.id}`)
    console.log(`   - 雷达类型: tech\n`)

    // 也可以触发行业雷达
    console.log('📤 添加行业雷达推送任务...')
    const industryJob = await pushQueue.add(
      'push-industry',
      { radarType: 'industry' },
      {
        jobId: `industry-push-${Date.now()}`,
      }
    )

    console.log('✅ 行业雷达推送任务已添加:')
    console.log(`   - Job ID: ${industryJob.id}\n`)

    console.log('💡 提示:')
    console.log('   1. 查看后端日志查看推送进度')
    console.log('   2. 在前端页面 http://localhost:3001/radar/tech 查看实时推送')
    console.log('   3. WebSocket连接状态会显示在页面顶部')
    console.log('   4. 收到推送时会自动添加到列表顶部\n')

    console.log('⏳ 等待3秒，检查任务状态...')

    // 等待几秒让任务执行
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 检查任务状态
    const jobState = await techJob.getState()
    console.log(`\n📋 任务状态: ${jobState}`)

    if (jobState === 'completed') {
      console.log('✅ 推送任务完成!')
      const result = await techJob.returnvalue
      if (result) {
        console.log('返回结果:', result)
      }
    } else if (jobState === 'failed') {
      const failed = await techJob.failedReason
      console.error('❌ 推送任务失败:', failed)
    } else {
      console.log('⏳ 任务仍在执行或等待中...')
      console.log('💡 请查看后端日志获取详细信息')
    }

  } catch (error) {
    console.error('❌ 错误:', error)
    process.exit(1)
  } finally {
    await pushQueue.close()
  }
}

// 运行
triggerPush()
