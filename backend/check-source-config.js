const { Client } = require('pg')

async function checkSourceConfig() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await client.connect()

    // 检查信息源配置
    console.log('=== 信息源配置 ===\n')
    const sources = await client.query(`
      SELECT id, source, url
      FROM radar_sources
      WHERE source IN ('信通院', 'IDC', 'GARTNER')
      ORDER BY source
    `)

    sources.rows.forEach(r => {
      console.log(`${r.source}:`)
      console.log(`  URL: ${r.url}`)
      console.log('')
    })

    // 检查信通院的爬取日志
    console.log('=== 信通院爬取日志 ===\n')
    const logs = await client.query(`
      SELECT source, url, status, "errorMessage", "createdAt"
      FROM crawler_logs
      WHERE source = '信通院'
      ORDER BY "createdAt" DESC
      LIMIT 3
    `)

    logs.rows.forEach(log => {
      const time = new Date(log.createdAt).toLocaleString('zh-CN')
      console.log(`[${time}]`)
      console.log(`  URL: ${log.url}`)
      console.log(`  状态: ${log.status}`)
      console.log(`  错误: ${log.errorMessage || 'N/A'}`)
      console.log('')
    })

    // 检查爬取的内容
    console.log('=== 爬取的内容 ===\n')
    const content = await client.query(`
      SELECT source, url, title
      FROM raw_contents
      WHERE source = '信通院'
      ORDER BY "createdAt" DESC
      LIMIT 3
    `)

    content.rows.forEach(item => {
      console.log(`来源: ${item.source}`)
      console.log(`  URL: ${item.url}`)
      console.log(`  标题: ${item.title}`)
      console.log('')
    })

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

checkSourceConfig()
