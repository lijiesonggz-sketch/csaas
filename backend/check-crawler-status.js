const { Client } = require('pg')

async function checkCrawlerStatus() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await client.connect()
    console.log('Connected to database\n')

    // 检查最近的爬虫日志
    console.log('=== 最近的爬虫日志 ===\n')
    const logs = await client.query(`
      SELECT id, source, status, "errorMessage", "createdAt"
      FROM crawler_logs
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)

    if (logs.rows.length === 0) {
      console.log('暂无爬虫日志\n')
    } else {
      logs.rows.forEach(log => {
        const time = new Date(log.createdAt).toLocaleString('zh-CN')
        console.log(`[${time}] ${log.source}`)
        console.log(`  状态: ${log.status}`)
        console.log(`  消息: ${log.errorMessage || 'N/A'}`)
        console.log('')
      })
    }

    // 检查最近爬取的内容
    console.log('=== 最近爬取的内容 ===\n')
    const content = await client.query(`
      SELECT id, source, category, "contentType", title, url, "createdAt"
      FROM raw_contents
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)

    if (content.rows.length === 0) {
      console.log('暂无爬取内容\n')
    } else {
      content.rows.forEach(item => {
        const time = new Date(item.createdAt).toLocaleString('zh-CN')
        console.log(`[${time}] ${item.source} (${item.category})`)
        console.log(`  类型: ${item.contentType}`)
        console.log(`  标题: ${item.title || 'N/A'}`)
        console.log(`  URL: ${item.url}`)
        console.log('')
      })
    }

    // 检查 BullMQ 队列状态
    console.log('=== 爬虫队列统计 ===\n')
    const queueStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM (
        SELECT data->>'status' as status
        FROM bullmq_jobs
        WHERE queue_name = 'radar-crawler'
      ) as jobs
    `)

    if (queueStats.rows.length > 0) {
      const stats = queueStats.rows[0]
      console.log(`等待中: ${stats.waiting || 0}`)
      console.log(`执行中: ${stats.active || 0}`)
      console.log(`已完成: ${stats.completed || 0}`)
      console.log(`失败: ${stats.failed || 0}`)
    } else {
      console.log('无法获取队列统计（可能表不存在）')
    }

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

checkCrawlerStatus()
