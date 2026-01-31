const { Client } = require('pg')

async function viewCrawledContent() {
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

    // 查询信通院爬取的内容
    const result = await client.query(`
      SELECT
        id,
        source,
        category,
        "contentType",
        title,
        summary,
        "fullContent",
        url,
        "publishDate",
        author,
        status,
        "createdAt"
      FROM raw_contents
      WHERE source = '信通院'
      ORDER BY "createdAt" DESC
    `)

    if (result.rows.length === 0) {
      console.log('未找到信通院的爬取内容\n')
      return
    }

    console.log(`=== 信通院爬取内容 (共 ${result.rows.length} 条) ===\n`)

    result.rows.forEach((item, index) => {
      console.log(`\n========== 内容 ${index + 1} ==========\n`)
      console.log(`ID: ${item.id}`)
      console.log(`来源: ${item.source}`)
      console.log(`类别: ${item.category}`)
      console.log(`内容类型: ${item.contentType || 'N/A'}`)
      console.log(`标题: ${item.title || 'N/A'}`)
      console.log(`URL: ${item.url}`)
      console.log(`发布日期: ${item.publishDate ? new Date(item.publishDate).toLocaleString('zh-CN') : 'N/A'}`)
      console.log(`作者: ${item.author || 'N/A'}`)
      console.log(`状态: ${item.status}`)
      console.log(`爬取时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}`)

      console.log(`\n--- 摘要 ---`)
      if (item.summary) {
        console.log(item.summary.substring(0, 500))
        if (item.summary.length > 500) {
          console.log(`... (共 ${item.summary.length} 字符)`)
        }
      } else {
        console.log('无摘要')
      }

      console.log(`\n--- 完整内容 ---`)
      if (item.fullContent) {
        console.log(item.fullContent.substring(0, 1000))
        if (item.fullContent.length > 1000) {
          console.log(`\n... (共 ${item.fullContent.length} 字符，已截断显示前1000字符)`)
        }
      } else {
        console.log('无完整内容')
      }
    })

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

viewCrawledContent()
